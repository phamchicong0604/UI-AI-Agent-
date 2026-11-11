import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import http from 'http';
import net from 'net';
import { app } from '../app.js';
import { db, dbRepository } from '../database/db.js';
import { signUserSession, computePbkdf2Hash } from '../common/auth.js';

describe('Test case creation never overwrites an existing test case', () => {
  let server: http.Server;
  let baseUrl: string;

  const prjA = 'PRJ-TCID-A';
  const prjB = 'PRJ-TCID-B';
  const memberB = { id: 'usr_tcid_member_b', username: 'tcid_member_b', name: 'TcId Member B', role: 'QA' as const };
  let tokenB: string;

  const countTestCases = () =>
    (db.prepare('SELECT count(*) AS n FROM test_cases').get() as { n: number }).n;

  const readRow = (id: string) =>
    db.prepare('SELECT project_id, requirement_id, data FROM test_cases WHERE id = ?').get(id) as
      { project_id: string | null; requirement_id: string | null; data: string } | undefined;

  const postInB = (title: string) =>
    fetch(`${baseUrl}/api/v1/testcases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ title, requirementId: 'REQ-TCID-B', projectId: prjB })
    });

  const createInB = async (title: string) => {
    const res = await postInB(title);
    return { status: res.status, body: (await res.json()) as any };
  };

  const seedInA = (id: string, title: string) => {
    dbRepository.testCases.upsert({
      id,
      requirementId: 'REQ-TCID-A',
      requirementTitle: 'Requirement of project A',
      title,
      scenario: 'Belongs to project A',
      preconditions: '',
      testData: '',
      type: 'Positive',
      priority: 'High',
      status: 'Approved',
      version: 'v1.0',
      sourceReferences: [],
      steps: [{ stepNumber: 1, action: 'Step of project A', expectedResult: 'Result of project A' }],
      reviewComments: [],
      relatedEvidenceIds: [],
      createdAt: '2026-11-01',
      updatedAt: '2026-11-01 09:00',
      projectId: prjA
    } as any);
  };

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as net.AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    const now = new Date().toISOString();
    for (const pid of [prjA, prjB]) {
      db.prepare(`
        INSERT OR REPLACE INTO projects (id, name, key, description, version, author, members_count, ai_policy, data, created_at, updated_at)
        VALUES (?, ?, ?, 'Test case id test', 'v1.0.0', 'Admin', 1, 'OFFLINE_ONLY', '{}', ?, ?)
      `).run(pid, pid, pid.replace(/-/g, ''), now, now);
    }

    const salt = 'tcid_salt_16bytes___';
    db.prepare(`
      INSERT OR REPLACE INTO users (id, username, password_hash, password_salt, name, role, must_change_password, password_changed_at, token_version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, 1, ?)
    `).run(memberB.id, memberB.username, computePbkdf2Hash('tcid-test-only-password', salt), salt, memberB.name, memberB.role, now);
    db.prepare(`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run(`pm_${prjB}_${memberB.id}`, prjB, memberB.id, 'QA', now);

    tokenB = signUserSession({ ...memberB, projectId: prjB });
  });

  // Each test starts without test cases of the two test projects, so no test depends on another
  const clearTestCases = () =>
    db.prepare('DELETE FROM test_cases WHERE project_id IN (?, ?)').run(prjA, prjB);

  beforeEach(clearTestCases);
  afterEach(() => vi.restoreAllMocks());

  afterAll(async () => {
    clearTestCases();
    db.prepare('DELETE FROM project_members WHERE user_id = ?').run(memberB.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(memberB.id);
    db.prepare('DELETE FROM projects WHERE id IN (?, ?)').run(prjA, prjB);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('keeps another project\'s test case intact when the row count points at its id', async () => {
    // The old generator used `TC-CUSTOM-00${count + 1}`. Seed project A with exactly that id
    // as it will be computed once this row exists.
    const victimId = `TC-CUSTOM-00${countTestCases() + 2}`;
    seedInA(victimId, 'Victim test case of project A');
    const before = readRow(victimId)!;

    const { status, body } = await createInB('Created by a member of project B');

    expect(status).toBe(201);
    expect(readRow(victimId)).toEqual(before);
    expect(body.data.id).not.toBe(victimId);
    expect(readRow(body.data.id)?.project_id).toBe(prjB);
  });

  it('does not reuse the id of a test case that still exists after an earlier one was deleted', async () => {
    const first = await createInB('First');
    const second = await createInB('Second');
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.id).not.toBe(first.body.data.id);

    // Deleting an older row lowers the row count; the old generator then pointed at `second`.
    dbRepository.testCases.delete(first.body.data.id);
    const secondBefore = readRow(second.body.data.id)!;

    const third = await createInB('Third');

    expect(third.status).toBe(201);
    expect(readRow(second.body.data.id)).toEqual(secondBefore);
    expect(third.body.data.id).not.toBe(second.body.data.id);
    expect(JSON.parse(readRow(third.body.data.id)!.data).title).toBe('Third');
  });

  it('issues ids in the TC-CUSTOM-NNN format above the highest existing number', async () => {
    seedInA('TC-CUSTOM-9041', 'High numbered test case of project A');

    const { status, body } = await createInB('After a high number');

    expect(status).toBe(201);
    expect(body.data.id).toBe('TC-CUSTOM-9042');
  });

  it('counts ids written by the old generator and ignores other TC id families', async () => {
    // The old generator wrote `TC-CUSTOM-00${n}`: the tenth test case got TC-CUSTOM-0010
    seedInA('TC-CUSTOM-009', 'Ninth legacy test case');
    seedInA('TC-CUSTOM-0010', 'Tenth legacy test case');
    seedInA('TC-AI-950', 'AI drafted test case');
    seedInA('TC-TCID-7777', 'Hand named test case');

    const { status, body } = await createInB('After legacy ids');

    expect(status).toBe(201);
    expect(body.data.id).toBe('TC-CUSTOM-011');
  });

  it('returns and stores the created test case in the same shape as before', async () => {
    const { status, body } = await createInB('Shape check');

    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      projectId: prjB,
      requirementId: 'REQ-TCID-B',
      requirementTitle: 'REQ-TCID-B',
      title: 'Shape check',
      type: 'Positive',
      priority: 'High',
      status: 'Draft',
      version: 'v1.0',
      steps: [],
      sourceReferences: [],
      reviewComments: [],
      relatedEvidenceIds: [],
      isAiDrafted: false
    });
    expect(body.data.id).toMatch(/^TC-CUSTOM-\d{3,}$/);

    const row = readRow(body.data.id)!;
    expect(row.project_id).toBe(prjB);
    expect(row.requirement_id).toBe('REQ-TCID-B');
    expect(JSON.parse(row.data)).toEqual(body.data);
  });

  it('refuses to create over an existing id at the repository level', () => {
    seedInA('TC-REPO-GUARD', 'Guarded');
    const before = readRow('TC-REPO-GUARD')!;

    expect(() => dbRepository.testCases.insert({ ...JSON.parse(before.data), title: 'Overwrite attempt', projectId: prjB })).toThrow(/UNIQUE constraint/);
    expect(readRow('TC-REPO-GUARD')).toEqual(before);
  });

  it('ignores ids whose number is too large to count safely', async () => {
    seedInA('TC-CUSTOM-9007199254740993', 'Beyond the safe integer range');
    seedInA(`TC-CUSTOM-${'9'.repeat(400)}`, 'Absurdly long number');
    seedInA('TC-CUSTOM-7001', 'Highest countable test case');

    const first = await createInB('First after oversized ids');
    const second = await createInB('Second after oversized ids');

    expect([first.status, second.status]).toEqual([201, 201]);
    expect([first.body.data.id, second.body.data.id]).toEqual(['TC-CUSTOM-7002', 'TC-CUSTOM-7003']);
  });

  describe('when the issued id is taken by the time of the insert (another process won the race)', () => {
    const takenId = 'TC-RACE-TAKEN';

    beforeEach(() => {
      seedInA(takenId, 'Created first by the other process');
      vi.spyOn(dbRepository.testCases, 'nextId').mockReturnValue(takenId);
    });

    it('create() throws instead of overwriting', () => {
      const before = readRow(takenId)!;

      expect(() => dbRepository.testCases.create({ ...JSON.parse(before.data), title: 'Loser of the race', projectId: prjB }))
        .toThrow(/UNIQUE constraint/);
      expect(readRow(takenId)).toEqual(before);
    });

    it('the route answers 409 as JSON without database details', async () => {
      const before = readRow(takenId)!;
      const res = await postInB('Loser of the race');
      const text = await res.text();

      expect(res.status).toBe(409);
      expect(res.headers.get('content-type')).toContain('application/json');
      expect(JSON.parse(text).success).toBe(false);
      expect(text).not.toMatch(/SqliteError|UNIQUE|\.ts|\/Users/);
      expect(readRow(takenId)).toEqual(before);
    });
  });
});
