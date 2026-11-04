import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import net from 'net';
import { app } from '../app.js';
import { db, dbRepository } from '../database/db.js';
import { signUserSession, computePbkdf2Hash } from '../common/auth.js';

describe('Auth Security Gate & Role Authorization (Condition 1, 2, 3, 4 - R4-01, R4-02, R4-06)', () => {
  let server: http.Server;
  let baseUrl: string;

  const proj1 = 'PRJ-AUTH-01';
  const proj2 = 'PRJ-AUTH-02';

  // Seed two distinct users for project isolation testing
  const user1 = { id: 'usr_auth_p1', username: 'user_p1', name: 'User P1', role: 'Reviewer / Approver' as const };
  const user2 = { id: 'usr_auth_p2', username: 'user_p2', name: 'User P2', role: 'QA' as const };

  // Multi-role user: Reviewer in proj1, but only QA in proj2 (Condition 3)
  const multiRoleUser = { id: 'usr_multirole', username: 'multirole', name: 'Multi Role User', role: 'Reviewer / Approver' as const };

  const tokenUser1 = signUserSession({ id: user1.id, username: user1.username, name: user1.name, role: user1.role, projectId: proj1 });
  const tokenUser2 = signUserSession({ id: user2.id, username: user2.username, name: user2.name, role: user2.role, projectId: proj2 });
  const tokenMultiRole = signUserSession({ id: multiRoleUser.id, username: multiRoleUser.username, name: multiRoleUser.name, role: 'Reviewer / Approver', projectId: proj1 });
  const adminToken = signUserSession({ id: 'usr_admin', username: 'admin', name: 'Admin', role: 'Project Admin' });

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as net.AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // Seed baseline projects
    const now = new Date().toISOString();
    for (const pid of [proj1, proj2]) {
      db.prepare(`
        INSERT OR REPLACE INTO projects (id, name, key, description, version, author, members_count, ai_policy, data, created_at, updated_at)
        VALUES (?, ?, ?, 'Auth test project', 'v1.0.0', 'Admin', 2, 'OFFLINE_ONLY', '{}', ?, ?)
      `).run(pid, pid, pid.replace('-', ''), now, now);
    }

    // Seed users into users table
    for (const u of [user1, user2, multiRoleUser]) {
      db.prepare(`
        INSERT OR REPLACE INTO users (id, username, password_hash, password_salt, name, role, must_change_password, created_at)
        VALUES (?, ?, 'hash', 'salt', ?, ?, 0, ?)
      `).run(u.id, u.username, u.name, u.role, now);
    }

    const adminSalt = 'admin_salt_auth_test_16bytes';
    const adminHash = computePbkdf2Hash('admin123', adminSalt);
    db.prepare(`
      INSERT OR REPLACE INTO users (id, username, password_hash, password_salt, name, role, must_change_password, created_at)
      VALUES ('usr_admin', 'admin', ?, ?, 'Admin', 'Project Admin', 0, ?)
    `).run(adminHash, adminSalt, now);

    // Assign project memberships
    // user1 in proj1
    db.prepare(`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)`).run(`pm_${proj1}_${user1.id}`, proj1, user1.id, 'Reviewer / Approver', now);
    // user2 in proj2
    db.prepare(`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)`).run(`pm_${proj2}_${user2.id}`, proj2, user2.id, 'QA', now);

    // multiRoleUser: Reviewer in proj1, QA in proj2 (Condition 3)
    db.prepare(`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)`).run(`pm_${proj1}_${multiRoleUser.id}`, proj1, multiRoleUser.id, 'Reviewer / Approver', now);
    db.prepare(`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)`).run(`pm_${proj2}_${multiRoleUser.id}`, proj2, multiRoleUser.id, 'QA', now);

    // Admin member of both
    db.prepare(`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, 'usr_admin', 'Project Admin', ?)`).run(`pm_${proj1}_admin`, proj1, now);
    db.prepare(`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, 'usr_admin', 'Project Admin', ?)`).run(`pm_${proj2}_admin`, proj2, now);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('Condition 1: Global Authentication Gate (R4-01, R4-02)', () => {
    it('/health is publicly accessible without token', async () => {
      const res = await fetch(`${baseUrl}/health`);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.status).toBe('healthy');
    });

    it('Automated route crawler: ALL mounted routes under /api/v1 strictly return 401 when called without a valid Bearer token', async () => {
      // Crawl all registered routes from Express internal router stack
      const discoveredRoutes: Array<{ method: string; path: string }> = [];

      function extractRoutes(stack: any[], prefix = '') {
        for (const layer of stack) {
          if (layer.route && layer.route.path) {
            const methods = Object.keys(layer.route.methods);
            for (const m of methods) {
              discoveredRoutes.push({
                method: m.toUpperCase(),
                path: (prefix + layer.route.path).replace(/\/+/g, '/')
              });
            }
          } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
            let subPrefix = prefix;
            if (layer.regexp) {
              const cleaned = layer.regexp.source
                .replace('^\\/', '/')
                .replace('^', '')
                .replace(/\\\//g, '/')
                .replace('(?:/(?=$))?(?=/|$)', '')
                .replace('/?(?=/|$)', '')
                .replace('/?$', '');
              subPrefix = (prefix + '/' + cleaned).replace(/\/+/g, '/');
            }
            extractRoutes(layer.handle.stack, subPrefix);
          }
        }
      }

      extractRoutes((app as any)._router.stack);

      // Filter routes under /api/v1 excluding /api/v1/auth/login
      const protectedEndpoints = discoveredRoutes.filter(r => 
        r.path.startsWith('/api/v1') && 
        !r.path.startsWith('/api/v1/auth/login')
      );

      expect(protectedEndpoints.length).toBeGreaterThanOrEqual(25);

      for (const endpoint of protectedEndpoints) {
        // Substitute route params like :id, :batchId with test IDs
        const testPath = endpoint.path
          .replace(':id', 'TEST-ID-999')
          .replace(':batchId', 'BATCH-999');

        const res = await fetch(`${baseUrl}${testPath}`, {
          method: endpoint.method === 'GET' ? 'GET' : endpoint.method,
          headers: { 'Content-Type': 'application/json' },
          body: ['POST', 'PUT', 'PATCH'].includes(endpoint.method) ? JSON.stringify({}) : undefined
        });

        expect(
          res.status,
          `Expected route ${endpoint.method} ${testPath} to return 401 Unauthorized without token, received ${res.status}`
        ).toBe(401);
      }
    });

    it('Agent router endpoints strictly require Project Admin role (R4-02)', async () => {
      // 1. Without token -> 401
      const resNoAuth = await fetch(`${baseUrl}/api/v1/agent/config`);
      expect(resNoAuth.status).toBe(401);

      // 2. With QA token -> 403
      const resForbidden = await fetch(`${baseUrl}/api/v1/agent/config`, {
        headers: { Authorization: `Bearer ${tokenUser2}` }
      });
      expect(resForbidden.status).toBe(403);

      // 3. With Admin token -> 200
      const resAdmin = await fetch(`${baseUrl}/api/v1/agent/config`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      expect(resAdmin.status).toBe(200);
    });
  });

  describe('Condition 2: Cross-Project Access Isolation (R4-01, R3-05)', () => {
    it('User of Project A receives 403 when reading documents of Project B', async () => {
      // Seed document in proj2
      const docId = `DOC-P2-${Date.now()}`;
      db.prepare(`
        INSERT INTO documents (id, project_id, category, status, data, updated_at)
        VALUES (?, ?, '01_Project_Overview', 'Draft', '{}', datetime('now'))
      `).run(docId, proj2);

      // User1 (member of proj1 only) attempts to read doc in proj2
      const res = await fetch(`${baseUrl}/api/v1/documents/${docId}`, {
        headers: { Authorization: `Bearer ${tokenUser1}` }
      });
      expect(res.status).toBe(403);
      const json = await res.json() as any;
      expect(json.error).toContain('Bạn không có quyền truy cập');
    });

    it('User of Project A receives 403 when downloading original file of Project B', async () => {
      const docId = `DOC-P2-FILE-${Date.now()}`;
      db.prepare(`
        INSERT INTO documents (id, project_id, category, status, data, updated_at)
        VALUES (?, ?, '01_Project_Overview', 'Draft', '{}', datetime('now'))
      `).run(docId, proj2);

      const res = await fetch(`${baseUrl}/api/v1/documents/${docId}/file`, {
        headers: { Authorization: `Bearer ${tokenUser1}` }
      });
      expect(res.status).toBe(403);
    });

    it('User of Project A receives 403 when creating resources in Project B', async () => {
      const res = await fetch(`${baseUrl}/api/v1/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenUser1}`
        },
        body: JSON.stringify({
          title: 'Illicit Document',
          category: '01_Project_Overview',
          projectId: proj2
        })
      });
      expect(res.status).toBe(403);
    });
  });

  describe('Condition 3: Dynamic Role Evaluation per Target Project (R4-06, R4-07)', () => {
    it('User with Reviewer in Project A cannot approve test cases in Project B where they are QA (POST /testcases/:id/comments)', async () => {
      // Create test case in Project B (proj2)
      const tcId = `TC-PROJ2-${Date.now()}`;
      dbRepository.testCases.upsert({
        id: tcId,
        projectId: proj2,
        title: 'Project B Test Case',
        description: 'Verify login behavior',
        type: 'Functional',
        priority: 'P1',
        status: 'Draft',
        preconditions: '',
        steps: [],
        expectedResult: 'Success',
        actualResult: '',
        requirementId: 'REQ-1',
        linkedRequirementId: 'REQ-1',
        reviewComments: [],
        createdAt: '2026-11-04',
        updatedAt: '2026-11-04'
      } as any);

      // multiRoleUser calls approval on test case in proj2:
      // In proj2 their role in database is 'QA' -> strictly 403 Forbidden!
      const res = await fetch(`${baseUrl}/api/v1/testcases/${tcId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenMultiRole}`
        },
        body: JSON.stringify({
          content: 'Approving this test case',
          decision: 'Approved'
        })
      });

      expect(res.status).toBe(403);
      const json = await res.json() as any;
      expect(json.error).toContain('mới có quyền phê duyệt');

      const tcAfter = dbRepository.testCases.getById(tcId);
      expect(tcAfter?.status).toBe('Draft');
    });

    it('User with Reviewer in Project A cannot approve test cases in Project B where they are QA (PATCH /testcases/:id/status)', async () => {
      const tcId = `TC-PROJ2-PATCH-${Date.now()}`;
      dbRepository.testCases.upsert({
        id: tcId,
        projectId: proj2,
        title: 'Project B Patch Test Case',
        description: 'Verify patch status',
        type: 'Functional',
        priority: 'P1',
        status: 'Draft',
        preconditions: '',
        steps: [],
        expectedResult: 'Success',
        actualResult: '',
        requirementId: 'REQ-1',
        linkedRequirementId: 'REQ-1',
        reviewComments: [],
        createdAt: '2026-11-04',
        updatedAt: '2026-11-04'
      } as any);

      const res = await fetch(`${baseUrl}/api/v1/testcases/${tcId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenMultiRole}`
        },
        body: JSON.stringify({ status: 'Approved' })
      });

      expect(res.status).toBe(403);
      const tcAfter = dbRepository.testCases.getById(tcId);
      expect(tcAfter?.status).toBe('Draft');
    });

    it('User with Reviewer in Project A cannot approve documents in Project B where they are QA (PATCH /documents/:id/status)', async () => {
      const docId = `DOC-PROJ2-STATUS-${Date.now()}`;
      db.prepare(`
        INSERT INTO documents (id, project_id, category, status, data, updated_at)
        VALUES (?, ?, '01_Project_Overview', 'Draft', '{}', datetime('now'))
      `).run(docId, proj2);

      const res = await fetch(`${baseUrl}/api/v1/documents/${docId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenMultiRole}`
        },
        body: JSON.stringify({ status: 'Approved' })
      });

      expect(res.status).toBe(403);
      const docAfter = dbRepository.documents.getById(docId);
      expect(docAfter?.status).toBe('Draft');
    });

    it('User with Reviewer in Project A cannot approve knowledge units in Project B where they are QA (POST /knowledge-units/:id/decision)', async () => {
      const kuId = `KU-PROJ2-${Date.now()}`;
      db.prepare(`
        INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, evidence_level, status, created_at, updated_at)
        VALUES (?, ?, 'BusinessRule', 'Test Rule in Proj2', 'Rule', 'Approve', 'Explicit', 'Draft', datetime('now'), datetime('now'))
      `).run(kuId, proj2);

      const res = await fetch(`${baseUrl}/api/v1/knowledge-units/${kuId}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenMultiRole}`
        },
        body: JSON.stringify({ decision: 'Approve' })
      });

      expect(res.status).toBe(403);
      const kuAfter = db.prepare('SELECT status FROM knowledge_units WHERE id = ?').get(kuId) as any;
      expect(kuAfter?.status).toBe('Draft');
    });
  });

  describe('R5-02: Protection of Session Generation & System Admin Global Routes', () => {
    it('Non-system admin cannot create elevated role session tokens via POST /auth/session', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenUser2}`
        },
        body: JSON.stringify({ role: 'Project Admin', projectId: proj1 })
      });

      expect(res.status).toBe(403);
      const json = await res.json() as any;
      expect(json.error).toMatch(/Quản trị viên hệ thống/i);
    });
  });

  describe('BUG-001: AI Router Project Isolation & Requirement Grounding', () => {
    it('POST /ai/generate-testcases strictly blocks generation if user is not a member of requirement project', async () => {
      const reqId = `REQ-P2-${Date.now()}`;
      dbRepository.requirements.upsert({
        id: reqId,
        projectId: proj2,
        title: 'Project 2 Payment Processing',
        description: 'Process payments via gateway',
        type: 'Functional',
        priority: 'High',
        status: 'Draft',
        sourceReferences: [],
        businessRules: [],
        acceptanceCriteria: [],
        createdAt: '2026-11-04',
        updatedAt: '2026-11-04'
      } as any);

      // User1 (member of proj1 only) attempts to generate test cases from proj2 requirement
      const res = await fetch(`${baseUrl}/api/v1/ai/generate-testcases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenUser1}`
        },
        body: JSON.stringify({
          requirement: { id: reqId, projectId: proj2, title: 'Injected Fake Title' },
          userPrompt: 'Generate test cases'
        })
      });

      expect(res.status).toBe(403);
      const json = await res.json() as any;
      expect(json.error).toMatch(/Bạn không có quyền sinh test case|Bạn không có quyền truy cập/i);
    });

    it('POST /ai/impact-analysis strictly blocks document blast-radius analysis across projects', async () => {
      const docId = `DOC-P2-IMPACT-${Date.now()}`;
      db.prepare(`
        INSERT INTO documents (id, project_id, category, status, data, updated_at)
        VALUES (?, ?, '01_Project_Overview', 'Draft', '{}', datetime('now'))
      `).run(docId, proj2);

      const res = await fetch(`${baseUrl}/api/v1/ai/impact-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenUser1}`
        },
        body: JSON.stringify({ documentId: docId })
      });

      expect(res.status).toBe(403);
    });
  });

  describe('Condition 4: Password Security and Change Enforcement (R4-15, Condition 4)', () => {
    it('Seed demo users (pm, ba, dev, qa, reviewer, ducpham) cannot log in', async () => {
      const seedUsers = ['pm', 'ba', 'dev', 'qa', 'reviewer', 'ducpham'];
      for (const username of seedUsers) {
        const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password: 'password123', projectId: 'PRJ-01' })
        });
        expect(res.status).toBe(401);
      }
    });

    it('User with mustChangePassword = 1 is blocked from resource endpoints with 403 MUST_CHANGE_PASSWORD until password is changed', async () => {
      // Set admin must_change_password = 1
      db.prepare("UPDATE users SET must_change_password = 1 WHERE username = 'admin'").run();

      const resLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123', projectId: 'PRJ-01' })
      });

      expect(resLogin.status).toBe(200);
      const loginJson = await resLogin.json() as any;
      expect(loginJson.data.mustChangePassword).toBe(true);
      const tempToken = loginJson.data.token;

      // 1. Calling resource endpoints returns 403 MUST_CHANGE_PASSWORD
      const resDocs = await fetch(`${baseUrl}/api/v1/documents`, {
        headers: { Authorization: `Bearer ${tempToken}` }
      });
      expect(resDocs.status).toBe(403);
      const docsJson = await resDocs.json() as any;
      expect(docsJson.code).toBe('MUST_CHANGE_PASSWORD');

      // 2. Reject weak password change (< 8 chars)
      const resWeak = await fetch(`${baseUrl}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tempToken}`
        },
        body: JSON.stringify({ currentPassword: 'admin123', newPassword: '123' })
      });
      expect(resWeak.status).toBe(400);

      // 3. Reject identical password change
      const resSame = await fetch(`${baseUrl}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tempToken}`
        },
        body: JSON.stringify({ currentPassword: 'admin123', newPassword: 'admin123' })
      });
      expect(resSame.status).toBe(400);

      // 4. Perform valid password change
      const resValid = await fetch(`${baseUrl}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tempToken}`
        },
        body: JSON.stringify({ currentPassword: 'admin123', newPassword: 'StrongEnterprisePass!2026' })
      });
      expect(resValid.status).toBe(200);

      // 5. Old password rejected at login
      const resOldLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123', projectId: 'PRJ-01' })
      });
      expect(resOldLogin.status).toBe(401);

      // 6. New password succeeds and mustChangePassword is false
      const resNewLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'StrongEnterprisePass!2026', projectId: 'PRJ-01' })
      });
      expect(resNewLogin.status).toBe(200);
      const newJson = await resNewLogin.json() as any;
      expect(newJson.data.mustChangePassword).toBe(false);

      // 7. Resource endpoints now fully accessible with 200 OK
      const resDocsAfter = await fetch(`${baseUrl}/api/v1/documents`, {
        headers: { Authorization: `Bearer ${newJson.data.token}` }
      });
      expect(resDocsAfter.status).toBe(200);

      // Reset back to admin123 so other test suites are unaffected
      await fetch(`${baseUrl}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newJson.data.token}`
        },
        body: JSON.stringify({ currentPassword: 'StrongEnterprisePass!2026', newPassword: 'admin123' })
      });
      db.prepare("UPDATE users SET must_change_password = 0 WHERE username = 'admin'").run();
    });
  });
});
