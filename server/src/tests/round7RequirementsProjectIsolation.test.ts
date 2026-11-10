import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import net from 'net';
import Database from 'better-sqlite3';
import { app } from '../app.js';
import { db } from '../database/db.js';
import { signUserSession, computePbkdf2Hash } from '../common/auth.js';
import { migration014BackfillRequirementsProjectId } from '../database/migrations/014_backfill_requirements_project_id.js';
import { DatabaseMigrator } from '../database/migrator.js';
import { allMigrations } from '../database/migrations/index.js';

describe('Round 7 R7-02: Requirements fail-closed project isolation', () => {
  let server: http.Server;
  let baseUrl: string;

  const prjA = 'PRJ-R7-A';
  const prjB = 'PRJ-R7-B';

  const memberA = { id: 'usr_r7_member_a', username: 'r7_member_a', name: 'R7 Member A', role: 'QA' as const };
  const memberB = { id: 'usr_r7_member_b', username: 'r7_member_b', name: 'R7 Member B', role: 'QA' as const };

  const reqInA = 'REQ-R7-IN-A';
  const reqNoProject = 'REQ-R7-NO-PROJECT';

  let tokenA: string;
  let tokenB: string;
  let tokenBNoProject: string;

  const getStatus = (id: string) =>
    (db.prepare('SELECT status FROM requirements WHERE id = ?').get(id) as { status: string }).status;

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
        VALUES (?, ?, ?, 'R7 Security Test', 'v1.0.0', 'Admin', 1, 'OFFLINE_ONLY', '{}', ?, ?)
      `).run(pid, pid, pid.replace(/-/g, ''), now, now);
    }

    const salt = 'r7_salt_16bytes_long';
    const pwdHash = computePbkdf2Hash('r7-test-only-password', salt);
    for (const u of [memberA, memberB]) {
      db.prepare(`
        INSERT OR REPLACE INTO users (id, username, password_hash, password_salt, name, role, must_change_password, password_changed_at, token_version, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, 0, 1, ?)
      `).run(u.id, u.username, pwdHash, salt, u.name, u.role, now);
    }

    db.prepare(`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)`).run(`pm_${prjA}_${memberA.id}`, prjA, memberA.id, 'QA', now);
    db.prepare(`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)`).run(`pm_${prjB}_${memberB.id}`, prjB, memberB.id, 'QA', now);

    db.prepare(`
      INSERT OR REPLACE INTO requirements (id, project_id, type, priority, status, data, updated_at)
      VALUES (?, ?, 'Functional', 'High', 'In Review', ?, ?)
    `).run(reqInA, prjA, JSON.stringify({ id: reqInA, title: 'R7 requirement in project A', type: 'Functional', priority: 'High', status: 'In Review', updatedAt: now }), now);

    // Legacy-shaped row: no project_id column value and no projectId in the JSON payload
    db.prepare(`
      INSERT OR REPLACE INTO requirements (id, project_id, type, priority, status, data, updated_at)
      VALUES (?, NULL, 'Functional', 'High', 'In Review', ?, ?)
    `).run(reqNoProject, JSON.stringify({ id: reqNoProject, title: 'R7 requirement without project', type: 'Functional', priority: 'High', status: 'In Review', updatedAt: now }), now);

    tokenA = signUserSession({ id: memberA.id, username: memberA.username, name: memberA.name, role: 'QA', projectId: prjA });
    tokenB = signUserSession({ id: memberB.id, username: memberB.username, name: memberB.name, role: 'QA', projectId: prjB });
    tokenBNoProject = signUserSession({ id: memberB.id, username: memberB.username, name: memberB.name, role: 'QA' });
  });

  afterAll(async () => {
    db.prepare('DELETE FROM requirements WHERE id IN (?, ?)').run(reqInA, reqNoProject);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('Requirement with NULL project_id is denied (fail-closed)', () => {
    it('GET /requirements/:id returns 403 for a non-admin user', async () => {
      const res = await fetch(`${baseUrl}/api/v1/requirements/${reqNoProject}`, {
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      expect(res.status).toBe(403);
    });

    it('PATCH /requirements/:id/status returns 403 and does not write', async () => {
      const res = await fetch(`${baseUrl}/api/v1/requirements/${reqNoProject}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Draft' })
      });
      expect(res.status).toBe(403);
      expect(getStatus(reqNoProject)).toBe('In Review');
    });

    it('GET /requirements without a target project does not list it for a non-admin user', async () => {
      const res = await fetch(`${baseUrl}/api/v1/requirements`, {
        headers: { Authorization: `Bearer ${tokenBNoProject}` }
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { data: Array<{ id: string }> };
      const ids = body.data.map(r => r.id);
      expect(ids).not.toContain(reqNoProject);
      expect(ids).not.toContain(reqInA);
    });
  });

  describe('Requirement of another project is denied', () => {
    it('GET /requirements/:id returns 403 for a user of another project', async () => {
      const res = await fetch(`${baseUrl}/api/v1/requirements/${reqInA}`, {
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      expect(res.status).toBe(403);
    });

    it('PATCH /requirements/:id/status returns 403 for a user of another project and does not write', async () => {
      const res = await fetch(`${baseUrl}/api/v1/requirements/${reqInA}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Draft' })
      });
      expect(res.status).toBe(403);
      expect(getStatus(reqInA)).toBe('In Review');
    });

    it('GET /requirements?projectId= returns 403 for a user of another project', async () => {
      const res = await fetch(`${baseUrl}/api/v1/requirements?projectId=${prjA}`, {
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      expect(res.status).toBe(403);
    });
  });

  describe('Member of the owning project keeps access', () => {
    it('GET /requirements/:id returns 200', async () => {
      const res = await fetch(`${baseUrl}/api/v1/requirements/${reqInA}`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { data: { id: string; projectId: string } };
      expect(body.data.id).toBe(reqInA);
      expect(body.data.projectId).toBe(prjA);
    });

    it('PATCH /requirements/:id/status returns 200 and persists', async () => {
      const res = await fetch(`${baseUrl}/api/v1/requirements/${reqInA}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Draft' })
      });
      expect(res.status).toBe(200);
      expect(getStatus(reqInA)).toBe('Draft');
    });

    it('GET /requirements lists the requirement of the member project', async () => {
      const res = await fetch(`${baseUrl}/api/v1/requirements`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { data: Array<{ id: string }> };
      expect(body.data.map(r => r.id)).toContain(reqInA);
    });
  });

  describe('Baseline seed data', () => {
    it('seed requirement REQ-001 is written with a project_id', () => {
      const row = db.prepare('SELECT project_id FROM requirements WHERE id = ?').get('REQ-001') as { project_id: string | null } | undefined;
      expect(row).toBeDefined();
      expect(row!.project_id).toBe('PRJ-01');
    });
  });

  describe('Migration 014 up() backfills requirements.project_id', () => {
    it('resolves project from JSON payload, then source document, then PRJ-01, and keeps existing values', () => {
      const memDb = new Database(':memory:');
      memDb.exec(`
        CREATE TABLE projects (id TEXT PRIMARY KEY);
        CREATE TABLE documents (id TEXT PRIMARY KEY, project_id TEXT, data TEXT);
        CREATE TABLE requirements (
          id TEXT PRIMARY KEY,
          project_id TEXT,
          type TEXT, priority TEXT, status TEXT,
          data TEXT NOT NULL,
          updated_at TEXT
        );
        INSERT INTO projects VALUES ('PRJ-01'), ('PRJ-02');
        INSERT INTO documents VALUES ('DOC-M-02', 'PRJ-02', '{}');
      `);
      const insert = memDb.prepare(`INSERT INTO requirements (id, project_id, type, priority, status, data, updated_at) VALUES (?, ?, 'Functional', 'High', 'Draft', ?, '2026-11-01')`);
      insert.run('REQ-M-JSON', null, JSON.stringify({ id: 'REQ-M-JSON', projectId: 'PRJ-02' }));
      insert.run('REQ-M-DOC', null, JSON.stringify({ id: 'REQ-M-DOC', sourceReferences: [{ documentId: 'DOC-M-02' }] }));
      insert.run('REQ-M-NONE', null, JSON.stringify({ id: 'REQ-M-NONE' }));
      insert.run('REQ-M-KEEP', 'PRJ-02', JSON.stringify({ id: 'REQ-M-KEEP' }));

      migration014BackfillRequirementsProjectId.up(memDb);
      // Idempotent on a second run
      migration014BackfillRequirementsProjectId.up(memDb);

      const rows = memDb.prepare(`SELECT id, project_id, json_extract(data, '$.projectId') AS json_project FROM requirements ORDER BY id`).all() as Array<{ id: string; project_id: string | null; json_project: string | null }>;
      const byId = Object.fromEntries(rows.map(r => [r.id, r]));

      expect(byId['REQ-M-JSON'].project_id).toBe('PRJ-02');
      expect(byId['REQ-M-DOC'].project_id).toBe('PRJ-02');
      expect(byId['REQ-M-NONE'].project_id).toBe('PRJ-01');
      expect(byId['REQ-M-KEEP'].project_id).toBe('PRJ-02');
      for (const r of rows) {
        expect(r.project_id).not.toBeNull();
        expect(r.json_project).toBe(r.project_id);
      }
      memDb.close();
    });

    it('never violates the projects foreign key on a schema built by the real migrations (PR 4 review F-02)', () => {
      const memDb = new Database(':memory:');
      new DatabaseMigrator(memDb, allMigrations.filter(m => m.version <= '013')).runPendingMigrations();
      expect(memDb.pragma('foreign_keys', { simple: true })).toBe(1);

      memDb.prepare(`
        INSERT OR REPLACE INTO projects (id, name, key, description, version, author, members_count, data, created_at, updated_at)
        VALUES ('PRJ-01', 'Default', 'P1', 'Desc', 'v1.0', 'Admin', 1, '{}', datetime('now'), datetime('now'))
      `).run();
      const insert = memDb.prepare(`INSERT INTO requirements (id, project_id, type, priority, status, data, updated_at) VALUES (?, NULL, 'Functional', 'High', 'Draft', ?, '2026-11-01')`);
      const projectOf = (id: string) =>
        memDb.prepare(`SELECT project_id, json_extract(data, '$.projectId') AS json_project FROM requirements WHERE id = ?`).get(id) as { project_id: string | null; json_project: string | null };

      // JSON names a project that no longer exists: must not throw; falls back to an existing project
      insert.run('REQ-FK-GHOST', JSON.stringify({ id: 'REQ-FK-GHOST', projectId: 'PRJ-GHOST' }));
      expect(() => migration014BackfillRequirementsProjectId.up(memDb)).not.toThrow();
      expect(projectOf('REQ-FK-GHOST')).toEqual({ project_id: 'PRJ-01', json_project: 'PRJ-01' });

      // No resolvable project at all (PRJ-01 was deleted): must not throw; the requirement stays unassigned
      memDb.prepare(`DELETE FROM projects WHERE id = 'PRJ-01'`).run();
      insert.run('REQ-FK-NONE', JSON.stringify({ id: 'REQ-FK-NONE' }));
      insert.run('REQ-FK-GHOST2', JSON.stringify({ id: 'REQ-FK-GHOST2', projectId: 'PRJ-GHOST' }));
      expect(() => migration014BackfillRequirementsProjectId.up(memDb)).not.toThrow();
      expect(projectOf('REQ-FK-NONE').project_id).toBeNull();
      expect(projectOf('REQ-FK-GHOST2').project_id).toBeNull();
      memDb.close();
    });
  });
});
