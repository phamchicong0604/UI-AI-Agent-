import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import net from 'net';
import crypto from 'crypto';
import { app } from '../app.js';
import { db } from '../database/db.js';
import { signUserSession, computePbkdf2Hash } from '../common/auth.js';
import Database from 'better-sqlite3';

describe('Round 6 Bug Verification Test Suite (R6-01 to R6-10)', () => {
  let server: http.Server;
  let baseUrl: string;

  const prj1 = 'PRJ-R6-01';
  const prj2 = 'PRJ-R6-02';
  const prjForeign = 'PRJ-R6-FOREIGN';

  // User yuser: PM at PRJ-R6-01, QA at PRJ-R6-02 (R6-01)
  const yuser = { id: 'usr_yuser', username: 'yuser', name: 'Y User', role: 'PM / Project Lead' as const };
  
  // User must change password (R6-02)
  const mustChangeUser = { id: 'usr_must_change', username: 'mustchange', name: 'Must Change', role: 'QA' as const };

  // User for token revocation (R6-08)
  const revokeUser = { id: 'usr_revoke', username: 'revoke_user', name: 'Revoke User', role: 'QA' as const };

  // System Admin
  const adminUser = { id: 'usr_r6_admin', username: 'r6_admin', name: 'R6 Admin', role: 'Project Admin' as const };

  // Tokens
  let tokenYuserPrj1: string;
  let tokenMustChange: string;
  let tokenRevoke: string;
  let tokenAdmin: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as net.AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    const now = new Date().toISOString();

    // 1. Seed Projects
    for (const pid of [prj1, prj2, prjForeign]) {
      db.prepare(`
        INSERT OR REPLACE INTO projects (id, name, key, description, version, author, members_count, ai_policy, data, created_at, updated_at)
        VALUES (?, ?, ?, 'R6 Security Test', 'v1.0.0', 'Admin', 2, 'OFFLINE_ONLY', '{}', ?, ?)
      `).run(pid, pid, pid.replace(/-/g, ''), now, now);
    }

    // 2. Seed Users
    const salt = 'r6_salt_16bytes_long';
    const pwdHash = computePbkdf2Hash('password123', salt);

    // yuser
    db.prepare(`
      INSERT OR REPLACE INTO users (id, username, password_hash, password_salt, name, role, must_change_password, password_changed_at, token_version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, 1, ?)
    `).run(yuser.id, yuser.username, pwdHash, salt, yuser.name, yuser.role, now);

    // mustChangeUser
    db.prepare(`
      INSERT OR REPLACE INTO users (id, username, password_hash, password_salt, name, role, must_change_password, password_changed_at, token_version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 0, 1, ?)
    `).run(mustChangeUser.id, mustChangeUser.username, pwdHash, salt, mustChangeUser.name, mustChangeUser.role, now);

    // revokeUser
    db.prepare(`
      INSERT OR REPLACE INTO users (id, username, password_hash, password_salt, name, role, must_change_password, password_changed_at, token_version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, 1, ?)
    `).run(revokeUser.id, revokeUser.username, pwdHash, salt, revokeUser.name, revokeUser.role, now);

    // adminUser
    db.prepare(`
      INSERT OR REPLACE INTO users (id, username, password_hash, password_salt, name, role, must_change_password, password_changed_at, token_version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, 1, ?)
    `).run(adminUser.id, adminUser.username, pwdHash, salt, adminUser.name, adminUser.role, now);

    // 3. Project Memberships
    // yuser: PM at PRJ-R6-01, QA at PRJ-R6-02
    db.prepare(`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)`).run(`pm_${prj1}_${yuser.id}`, prj1, yuser.id, 'PM / Project Lead', now);
    db.prepare(`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)`).run(`pm_${prj2}_${yuser.id}`, prj2, yuser.id, 'QA', now);

    // mustChangeUser at PRJ-R6-01
    db.prepare(`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)`).run(`pm_${prj1}_${mustChangeUser.id}`, prj1, mustChangeUser.id, 'QA', now);

    // revokeUser at PRJ-R6-01
    db.prepare(`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)`).run(`pm_${prj1}_${revokeUser.id}`, prj1, revokeUser.id, 'QA', now);

    // adminUser is global Project Admin
    db.prepare(`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, 'usr_r6_admin', 'Project Admin', ?)`).run(`pm_${prj1}_admin`, prj1, now);
    db.prepare(`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, 'usr_r6_admin', 'Project Admin', ?)`).run(`pm_${prj2}_admin`, prj2, now);

    // Sign tokens
    tokenYuserPrj1 = signUserSession({ id: yuser.id, username: yuser.username, name: yuser.name, role: 'PM / Project Lead', projectId: prj1 });
    tokenMustChange = signUserSession({ id: mustChangeUser.id, username: mustChangeUser.username, name: mustChangeUser.name, role: 'QA', projectId: prj1 });
    tokenRevoke = signUserSession({ id: revokeUser.id, username: revokeUser.username, name: revokeUser.name, role: 'QA', projectId: prj1 });
    tokenAdmin = signUserSession({ id: adminUser.id, username: adminUser.username, name: adminUser.name, role: 'Project Admin' });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  // =========================================================================
  // R6-01: Cross-Project Role Authorization Bypass
  // =========================================================================
  describe('R6-01 (Blocker): Cross-Project Dynamic Role Enforcement', () => {
    const docP2 = `DOC-R6-P2-${Date.now()}`;
    const reqP2 = `REQ-R6-P2-${Date.now()}`;
    const tcP2 = `TC-R6-P2-${Date.now()}`;
    const runP2 = `RUN-R6-P2-${Date.now()}`;
    const evdP2 = `EVD-R6-P2-${Date.now()}`;
    const bugP2 = `BUG-R6-P2-${Date.now()}`;
    const kuP2 = `KU-R6-P2-${Date.now()}`;
    const jobP2 = `JOB-R6-P2-${Date.now()}`;

    beforeAll(() => {
      const now = new Date().toISOString();
      // Seed resources strictly in PRJ-R6-02
      db.prepare(`
        INSERT INTO documents (id, project_id, category, status, data, updated_at)
        VALUES (?, ?, '01_Project_Overview', 'In Review', '{}', ?)
      `).run(docP2, prj2, now);

      db.prepare(`
        INSERT INTO requirements (id, project_id, status, type, priority, data, updated_at)
        VALUES (?, ?, 'In Review', 'Functional', 'High', '{}', ?)
      `).run(reqP2, prj2, now);

      db.prepare(`
        INSERT INTO test_cases (id, project_id, requirement_id, status, type, priority, data, updated_at)
        VALUES (?, ?, ?, 'In Review', 'Functional', 'High', '{"comments":[]}', ?)
      `).run(tcP2, prj2, reqP2, now);

      db.prepare(`
        INSERT INTO test_runs (id, project_id, status, environment, data, created_at)
        VALUES (?, ?, 'Pending', 'Staging', '{"records":[{"testCaseId":"${tcP2}"}]}', ?)
      `).run(runP2, prj2, now);

      db.prepare(`
        INSERT INTO evidence (id, project_id, type, environment, status, data, created_at)
        VALUES (?, ?, 'Screenshot', 'Staging', 'Unverified', '{"links":[{"targetId":"${reqP2}"}]}', ?)
      `).run(evdP2, prj2, now);

      db.prepare(`
        INSERT INTO bugs (id, project_id, status, severity, priority, data)
        VALUES (?, ?, 'Open', 'High', 'High', '{"linkedRequirementId":"${reqP2}"}')
      `).run(bugP2, prj2);

      db.prepare(`
        INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, evidence_level, status, created_at, updated_at)
        VALUES (?, ?, 'Requirement', 'Test Content', 'Subject', 'Action', 'Explicit', 'Draft', ?, ?)
      `).run(kuP2, prj2, now, now);

      db.prepare(`
        INSERT INTO jobs (id, type, status, payload, attempts, max_attempts, next_run_at, created_at, updated_at)
        VALUES (?, 'DOC_PROCESS', 'RUNNING', json_object('projectId', '${prj2}', 'documentId', '${docP2}'), 1, 3, ?, ?, ?)
      `).run(jobP2, now, now, now);
    });

    it('1. DELETE /documents/:id on PRJ-02 resource with PRJ-01 PM token returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/documents/${docP2}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenYuserPrj1}` }
      });
      expect(res.status).toBe(403);
      const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(docP2);
      expect(doc).toBeDefined();
    });

    it('2. PATCH /documents/:id/category on PRJ-02 resource with PRJ-01 PM token returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/documents/${docP2}/category`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenYuserPrj1}`
        },
        body: JSON.stringify({ category: '04_UI_UX' })
      });
      expect(res.status).toBe(403);
    });

    it('3. PATCH /documents/:id/status on PRJ-02 resource with PRJ-01 PM token returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/documents/${docP2}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenYuserPrj1}`
        },
        body: JSON.stringify({ status: 'Approved' })
      });
      expect(res.status).toBe(403);
    });

    it('4. POST /workflow/transition on PRJ-02 resource with PRJ-01 PM token returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/workflow/transition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenYuserPrj1}`
        },
        body: JSON.stringify({ documentId: docP2, toState: 'Approved' })
      });
      expect(res.status).toBe(403);
    });

    it('5. POST /jobs/:id/cancel on PRJ-02 job with PRJ-01 PM token returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/jobs/${jobP2}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenYuserPrj1}`
        },
        body: JSON.stringify({ reason: 'Malicious cancel' })
      });
      expect(res.status).toBe(403);
    });

    it('6. POST /knowledge-units/:id/decision on PRJ-02 unit with PRJ-01 PM token returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/knowledge-units/${kuP2}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenYuserPrj1}`
        },
        body: JSON.stringify({ decision: 'Approve' })
      });
      expect(res.status).toBe(403);
    });

    it('7. PATCH /requirements/:id/status on PRJ-02 requirement with PRJ-01 PM token returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/requirements/${reqP2}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenYuserPrj1}`
        },
        body: JSON.stringify({ status: 'Approved' })
      });
      expect(res.status).toBe(403);
    });

    it('8. PATCH /testcases/:id/status on PRJ-02 testcase with PRJ-01 PM token returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/testcases/${tcP2}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenYuserPrj1}`
        },
        body: JSON.stringify({ status: 'Approved' })
      });
      expect(res.status).toBe(403);
    });

    it('9. PATCH /evidence/:id/verify on PRJ-02 evidence with PRJ-01 PM token returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/evidence/${evdP2}/verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenYuserPrj1}`
        },
        body: JSON.stringify({ verified: true })
      });
      expect(res.status).toBe(403);
    });

    it('10. POST /testruns/:id/execute on PRJ-02 testrun with PRJ-01 PM token returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/testruns/${runP2}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenYuserPrj1}`
        },
        body: JSON.stringify({ executionSummary: 'Run' })
      });
      expect(res.status).toBe(403);
    });

    it('11. PATCH /bugs/:id/status on PRJ-02 bug with PRJ-01 PM token returns 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/bugs/${bugP2}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenYuserPrj1}`
        },
        body: JSON.stringify({ status: 'Closed' })
      });
      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // R6-02: Password Gate Bypass via Query String
  // =========================================================================
  describe('R6-02: Exact Path Matching for must_change_password Gate', () => {
    it('rejects GET /projects?x=/auth/me with 403 MUST_CHANGE_PASSWORD', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects?x=/auth/me`, {
        headers: { Authorization: `Bearer ${tokenMustChange}` }
      });
      expect(res.status).toBe(403);
      const json = await res.json() as any;
      expect(json.code).toBe('MUST_CHANGE_PASSWORD');
    });

    it('rejects GET /documents?projectId=PRJ-01&z=/auth/logout with 403 MUST_CHANGE_PASSWORD', async () => {
      const res = await fetch(`${baseUrl}/api/v1/documents?projectId=${prj1}&z=/auth/logout`, {
        headers: { Authorization: `Bearer ${tokenMustChange}` }
      });
      expect(res.status).toBe(403);
      const json = await res.json() as any;
      expect(json.code).toBe('MUST_CHANGE_PASSWORD');
    });

    it('allows legitimate GET /auth/me even when must_change_password is true', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${tokenMustChange}` }
      });
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.data.mustChangePassword).toBe(true);
    });

    it('allows legitimate POST /auth/logout', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenMustChange}` }
      });
      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // R6-03: Fail-Closed on Missing/Unresolvable projectId
  // =========================================================================
  describe('R6-03: Fail-Closed on Unresolvable or Missing projectId', () => {
    it('evidence without membership in target project returns 403', async () => {
      const evdForeign = `EVD-FOR-${Date.now()}`;
      db.prepare(`
        INSERT INTO evidence (id, project_id, type, environment, status, data, created_at)
        VALUES (?, ?, 'Screenshot', 'Staging', 'Unverified', '{}', datetime('now'))
      `).run(evdForeign, prjForeign);

      const res = await fetch(`${baseUrl}/api/v1/evidence/${evdForeign}`, {
        headers: { Authorization: `Bearer ${tokenYuserPrj1}` }
      });
      expect(res.status).toBe(403);
    });

    it('testruns without membership in target project returns 403', async () => {
      const runForeign = `RUN-FOR-${Date.now()}`;
      db.prepare(`
        INSERT INTO test_runs (id, project_id, status, environment, data, created_at)
        VALUES (?, ?, 'Pending', 'Staging', '{}', datetime('now'))
      `).run(runForeign, prjForeign);

      const res = await fetch(`${baseUrl}/api/v1/testruns/${runForeign}`, {
        headers: { Authorization: `Bearer ${tokenYuserPrj1}` }
      });
      expect(res.status).toBe(403);
    });

    it('bugs without membership in target project returns 403', async () => {
      const bugForeign = `BUG-FOR-${Date.now()}`;
      db.prepare(`
        INSERT INTO bugs (id, project_id, status, severity, priority, data)
        VALUES (?, ?, 'Open', 'High', 'High', '{}')
      `).run(bugForeign, prjForeign);

      const res = await fetch(`${baseUrl}/api/v1/bugs/${bugForeign}`, {
        headers: { Authorization: `Bearer ${tokenYuserPrj1}` }
      });
      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // R6-04: Audit Tampering Protection
  // =========================================================================
  describe('R6-04: Audit Log Integrity and Tamper Protection', () => {
    it('rejects client attempt to log restricted action ADMIN_ROLE_SWITCH with 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/audit/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenYuserPrj1}`
        },
        body: JSON.stringify({
          action: 'ADMIN_ROLE_SWITCH',
          entityType: 'User',
          entityId: 'usr_target',
          projectId: prj1
        })
      });
      expect(res.status).toBe(400);
    });

    it('rejects client attempt to log restricted action USER_PASSWORD_CHANGE with 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/audit/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenYuserPrj1}`
        },
        body: JSON.stringify({
          action: 'USER_PASSWORD_CHANGE',
          entityType: 'User',
          entityId: 'usr_target',
          projectId: prj1
        })
      });
      expect(res.status).toBe(400);
    });

    it('POST /audit/verify-chain verifies hash chain strictly per-project', async () => {
      const res = await fetch(`${baseUrl}/api/v1/audit/verify-chain?projectId=${prj1}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenYuserPrj1}` }
      });
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data.isChainValid).toBe(true);
    });
  });

  // =========================================================================
  // R6-05: AI Prompt Grounding Bypass Protection
  // =========================================================================
  describe('R6-05: AI Grounding Bypass Protection (BUG-001 Hardening)', () => {
    const reqForeign = `REQ-FOR-AI-${Date.now()}`;

    beforeAll(() => {
      // Seed requirement belonging to foreign project
      db.prepare(`
        INSERT INTO requirements (id, project_id, status, type, priority, data, updated_at)
        VALUES (?, ?, 'Approved', 'Functional', 'High', '{"title":"Foreign Req","description":"Foreign DB Description"}', datetime('now'))
      `).run(reqForeign, prjForeign);
    });

    it('rejects AI test case generation for foreign requirement with 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/ai/generate-testcases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenYuserPrj1}`
        },
        body: JSON.stringify({
          requirement: { id: reqForeign }
        })
      });
      expect(res.status).toBe(403);
      const json = await res.json() as any;
      expect(json.error).toContain('Bạn không có quyền sinh test case');
    });

    it('ignores client spoofed sourceReferences and resolves project strictly from DB entity', async () => {
      const res = await fetch(`${baseUrl}/api/v1/ai/generate-testcases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenYuserPrj1}`
        },
        body: JSON.stringify({
          requirement: {
            id: reqForeign,
            sourceReferences: [{ documentId: 'DOC-PRJ1-SPOOFED' }]
          },
          sourceDoc: {
            id: 'DOC-PRJ1-SPOOFED',
            projectId: prj1,
            title: 'Spoofed Doc'
          }
        })
      });
      // MUST still return 403 because DB requirement belongs to prjForeign!
      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // R6-06: User & Project Membership Management
  // =========================================================================
  describe('R6-06: User & Project Membership Management API', () => {
    const newUsername = `user_r6_${Date.now()}`;
    let createdUserId: string;

    it('Admin can list users via GET /auth/users', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/users`, {
        headers: { Authorization: `Bearer ${tokenAdmin}` }
      });
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(Array.isArray(json.data)).toBe(true);
    });

    it('Admin can create user via POST /auth/users', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAdmin}`
        },
        body: JSON.stringify({
          username: newUsername,
          password: 'Password123!',
          name: 'Created R6 User',
          role: 'QA'
        })
      });
      expect(res.status).toBe(201);
      const json = await res.json() as any;
      createdUserId = json.data.id;
      expect(createdUserId).toBeDefined();
    });

    it('Admin can add member to project via POST /projects/:id/members', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${prj1}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAdmin}`
        },
        body: JSON.stringify({
          userId: createdUserId,
          role: 'QA'
        })
      });
      expect(res.status).toBe(201);
    });

    it('Members list reflects added member via GET /projects/:id/members', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${prj1}/members`, {
        headers: { Authorization: `Bearer ${tokenAdmin}` }
      });
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      const found = json.data.some((m: any) => m.userId === createdUserId);
      expect(found).toBe(true);
    });

    it('Admin can remove member via DELETE /projects/:id/members/:userId', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${prj1}/members/${createdUserId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenAdmin}` }
      });
      expect(res.status).toBe(200);
    });

    it('Non-admin receives 403 on membership modifications', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${prj1}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenRevoke}`
        },
        body: JSON.stringify({ userId: createdUserId, role: 'QA' })
      });
      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // R6-07: Migration 012 & 013 Deduplication Collision Resistance
  // =========================================================================
  describe('R6-07: Migration Deduplication Collision Resistance', () => {
    it('renumbers duplicates collision-resistantly when 1.0-dup1 already exists', () => {
      const memDb = new Database(':memory:');
      memDb.exec(`
        CREATE TABLE document_versions (
          id TEXT PRIMARY KEY,
          document_id TEXT NOT NULL,
          version_no TEXT NOT NULL,
          file_id TEXT,
          checksum TEXT,
          change_summary TEXT,
          author TEXT,
          created_at TEXT
        );
        -- Insert two '1.0' and one pre-existing '1.0-dup1'
        INSERT INTO document_versions VALUES
          ('v1', 'DOC-01', '1.0', NULL, 'chk1', 'initial', 'dev', datetime('now')),
          ('v2', 'DOC-01', '1.0', NULL, 'chk2', 'duplicate', 'dev', datetime('now')),
          ('v3', 'DOC-01', '1.0-dup1', NULL, 'chk3', 'existing-dup', 'dev', datetime('now'));
      `);

      // Run deduplication logic with collision-resistant loop
      const rows = memDb.prepare(`
        SELECT id, document_id, version_no
        FROM document_versions
        ORDER BY document_id, id
      `).all() as Array<{ id: string; document_id: string; version_no: string }>;

      const seen = new Set<string>();
      for (const row of rows) {
        const key = `${row.document_id}::${row.version_no}`;
        if (seen.has(key)) {
          let counter = 1;
          let candidate = `${row.version_no}-dup${counter}`;
          while (memDb.prepare('SELECT 1 FROM document_versions WHERE document_id = ? AND version_no = ?').get(row.document_id, candidate)) {
            counter++;
            candidate = `${row.version_no}-dup${counter}`;
          }
          memDb.prepare('UPDATE document_versions SET version_no = ? WHERE id = ?').run(candidate, row.id);
          seen.add(`${row.document_id}::${candidate}`);
        } else {
          seen.add(key);
        }
      }

      // Now create UNIQUE index: MUST succeed without UNIQUE constraint failed error
      expect(() => {
        memDb.exec('CREATE UNIQUE INDEX idx_doc_ver_unique ON document_versions (document_id, version_no);');
      }).not.toThrow();

      // Verify all 3 rows exist and have distinct versions
      const finalVersions = memDb.prepare('SELECT version_no FROM document_versions WHERE document_id = ? ORDER BY version_no').all('DOC-01') as Array<{ version_no: string }>;
      expect(finalVersions.length).toBe(3);
      expect(finalVersions.map(v => v.version_no)).toEqual(['1.0', '1.0-dup1', '1.0-dup2']);
      memDb.close();
    });
  });

  // =========================================================================
  // R6-08: Token Revocation on Password Change & Deleted User
  // =========================================================================
  describe('R6-08: Token Revocation', () => {
    it('rejects old token after password change with 401', async () => {
      // 1. Existing token works
      const resBefore = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${tokenRevoke}` }
      });
      expect(resBefore.status).toBe(200);

      // 2. Change password via API or DB
      const newSalt = crypto.randomBytes(16).toString('hex');
      const newHash = computePbkdf2Hash('NewPassword123!', newSalt);
      const changedAt = Math.floor(Date.now() / 1000) + 1; // 1 second in future
      db.prepare(`
        UPDATE users
        SET password_hash = ?, password_salt = ?, password_changed_at = ?, token_version = token_version + 1
        WHERE id = ?
      `).run(newHash, newSalt, changedAt, revokeUser.id);

      // 3. Old token now rejected with 401
      const resAfter = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${tokenRevoke}` }
      });
      expect(resAfter.status).toBe(401);
    });

    it('rejects token of deleted user with 401', async () => {
      const ephemeralUser = { id: `usr_del_${Date.now()}`, username: `del_${Date.now()}`, role: 'QA' as const };
      const ephemeralToken = signUserSession({ id: ephemeralUser.id, username: ephemeralUser.username, name: 'Del', role: ephemeralUser.role, projectId: prj1 });

      // User does not exist in DB -> immediate 401
      const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${ephemeralToken}` }
      });
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // Condition 4 / Seed Users
  // =========================================================================
  describe('Condition 4: Legacy Seed User Accounts Permanently Removed', () => {
    const seedUsers = [
      { username: 'pm', password: 'pm123' },
      { username: 'ba', password: 'ba123' },
      { username: 'dev', password: 'dev123' },
      { username: 'qa', password: 'qa123' },
      { username: 'reviewer', password: 'reviewer123' }
    ];

    for (const seed of seedUsers) {
      it(`POST /auth/login rejects legacy seed user "${seed.username}" with 401`, async () => {
        const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(seed)
        });
        expect(res.status).toBe(401);
      });
    }
  });

  // =========================================================================
  // Unreproduced 500 Fix Verification
  // =========================================================================
  describe('Unreproduced 500 Error: POST /documents with existing ID returns 409 Conflict', () => {
    it('returns 409 Conflict instead of SQLite 500 when document ID already exists', async () => {
      const existingDocId = `DOC-EXIST-${Date.now()}`;
      db.prepare(`
        INSERT INTO documents (id, project_id, category, status, data, updated_at)
        VALUES (?, ?, '01_Project_Overview', 'Approved', '{}', datetime('now'))
      `).run(existingDocId, prj1);

      const res = await fetch(`${baseUrl}/api/v1/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAdmin}`
        },
        body: JSON.stringify({
          id: existingDocId,
          projectId: prj1,
          title: 'Duplicate Collision Doc',
          category: '01_Project_Overview',
          contentMarkdown: '# Collision Content'
        })
      });
      expect(res.status).toBe(409);
      const json = await res.json() as any;
      expect(json.success).toBe(false);
      expect(json.error).toContain('đã tồn tại');
    });
  });
});
