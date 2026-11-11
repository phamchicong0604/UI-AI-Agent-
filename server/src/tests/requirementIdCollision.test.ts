import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import http from 'http';
import net from 'net';
import { app } from '../app.js';
import { db, dbRepository } from '../database/db.js';
import { signUserSession, computePbkdf2Hash } from '../common/auth.js';

describe('Requirement creation never overwrites an existing requirement', () => {
  let server: http.Server;
  let baseUrl: string;

  const prjA = 'PRJ-REQID-A';
  const prjB = 'PRJ-REQID-B';
  const memberB = { id: 'usr_reqid_member_b', username: 'reqid_member_b', name: 'ReqId Member B', role: 'QA' as const };
  let tokenB: string;

  const countRequirements = () =>
    (db.prepare('SELECT count(*) AS n FROM requirements').get() as { n: number }).n;

  const readRow = (id: string) =>
    db.prepare('SELECT project_id, data FROM requirements WHERE id = ?').get(id) as { project_id: string | null; data: string } | undefined;

  const createInB = async (title: string) => {
    const res = await fetch(`${baseUrl}/api/v1/requirements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ title, projectId: prjB })
    });
    return { status: res.status, body: (await res.json()) as any };
  };

  const seedInA = (id: string, title: string) => {
    dbRepository.requirements.upsert({
      id,
      title,
      description: 'Belongs to project A',
      type: 'Functional',
      priority: 'High',
      businessRules: [],
      acceptanceCriteria: [],
      sourceReferences: [],
      status: 'Approved',
      owner: 'Owner A',
      approver: 'Approver A',
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
        VALUES (?, ?, ?, 'Requirement id test', 'v1.0.0', 'Admin', 1, 'OFFLINE_ONLY', '{}', ?, ?)
      `).run(pid, pid, pid.replace(/-/g, ''), now, now);
    }

    const salt = 'reqid_salt_16bytes__';
    db.prepare(`
      INSERT OR REPLACE INTO users (id, username, password_hash, password_salt, name, role, must_change_password, password_changed_at, token_version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, 1, ?)
    `).run(memberB.id, memberB.username, computePbkdf2Hash('reqid-test-only-password', salt), salt, memberB.name, memberB.role, now);
    db.prepare(`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run(`pm_${prjB}_${memberB.id}`, prjB, memberB.id, 'QA', now);

    tokenB = signUserSession({ ...memberB, projectId: prjB });
  });

  // Each test starts without requirements of the two test projects, so no test depends on another
  const clearTestRequirements = () =>
    db.prepare('DELETE FROM requirements WHERE project_id IN (?, ?)').run(prjA, prjB);

  beforeEach(clearTestRequirements);
  afterEach(() => vi.restoreAllMocks());

  afterAll(async () => {
    clearTestRequirements();
    db.prepare('DELETE FROM project_members WHERE user_id = ?').run(memberB.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(memberB.id);
    db.prepare('DELETE FROM projects WHERE id IN (?, ?)').run(prjA, prjB);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('keeps another project\'s requirement intact when the row count points at its id', async () => {
    // The old generator used `REQ-00${count + 1}`. Seed project A with exactly that id
    // as it will be computed once this row exists.
    const victimId = `REQ-00${countRequirements() + 2}`;
    seedInA(victimId, 'Victim requirement of project A');
    const before = readRow(victimId)!;

    const { status, body } = await createInB('Created by a member of project B');

    expect(status).toBe(201);
    expect(body.data.id).not.toBe(victimId);
    expect(readRow(victimId)).toEqual(before);
    expect(readRow(body.data.id)?.project_id).toBe(prjB);
  });

  it('does not reuse the id of a requirement that still exists after an earlier one was deleted', async () => {
    const first = await createInB('First');
    const second = await createInB('Second');
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.id).not.toBe(first.body.data.id);

    // Deleting an older row lowers the row count; the old generator then pointed at `second`.
    dbRepository.requirements.delete(first.body.data.id);
    const secondBefore = readRow(second.body.data.id)!;

    const third = await createInB('Third');

    expect(third.status).toBe(201);
    expect(third.body.data.id).not.toBe(second.body.data.id);
    expect(readRow(second.body.data.id)).toEqual(secondBefore);
    expect(JSON.parse(readRow(third.body.data.id)!.data).title).toBe('Third');
  });

  it('issues ids in the REQ-NNN format above the highest existing number', async () => {
    seedInA('REQ-9041', 'High numbered requirement of project A');

    const { status, body } = await createInB('After a high number');

    expect(status).toBe(201);
    expect(body.data.id).toBe('REQ-9042');
  });

  it('refuses to create over an existing id at the repository level', () => {
    seedInA('REQ-REPO-GUARD', 'Guarded');
    const before = readRow('REQ-REPO-GUARD')!;

    expect(() => dbRepository.requirements.insert({ ...JSON.parse(before.data), title: 'Overwrite attempt', projectId: prjB })).toThrow(/UNIQUE constraint/);
    expect(readRow('REQ-REPO-GUARD')).toEqual(before);
  });

  it('ignores ids whose number is too large to count safely', async () => {
    seedInA('REQ-9007199254740993', 'Beyond the safe integer range');
    seedInA(`REQ-${'9'.repeat(400)}`, 'Absurdly long number');
    seedInA('REQ-7001', 'Highest countable requirement');

    const first = await createInB('First after oversized ids');
    const second = await createInB('Second after oversized ids');

    expect([first.status, second.status]).toEqual([201, 201]);
    expect([first.body.data.id, second.body.data.id]).toEqual(['REQ-7002', 'REQ-7003']);
  });

  describe('when the issued id is taken by the time of the insert (another process won the race)', () => {
    const takenId = 'REQ-RACE-TAKEN';

    beforeEach(() => {
      seedInA(takenId, 'Created first by the other process');
      vi.spyOn(dbRepository.requirements, 'nextId').mockReturnValue(takenId);
    });

    it('create() throws instead of overwriting', () => {
      const before = readRow(takenId)!;

      expect(() => dbRepository.requirements.create({ ...JSON.parse(before.data), title: 'Loser of the race', projectId: prjB }))
        .toThrow(/UNIQUE constraint/);
      expect(readRow(takenId)).toEqual(before);
    });

    it('the route answers 409 as JSON without database details', async () => {
      const before = readRow(takenId)!;
      const res = await fetch(`${baseUrl}/api/v1/requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({ title: 'Loser of the race', projectId: prjB })
      });
      const text = await res.text();

      expect(res.status).toBe(409);
      expect(res.headers.get('content-type')).toContain('application/json');
      expect(JSON.parse(text).success).toBe(false);
      expect(text).not.toMatch(/SqliteError|UNIQUE|\.ts|\/Users/);
      expect(readRow(takenId)).toEqual(before);
    });
  });
});
