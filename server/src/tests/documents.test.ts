import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import net from 'net';
import { app } from '../app.js';
import { db, dbRepository } from '../database/db.js';
import { signUserSession } from '../common/auth.js';
import { defaultFileStore } from '../common/fileStore.js';

describe('Document Management & Cross-Project Security (R4-03, R4-08, R4-10, R4-16)', () => {
  let server: http.Server;
  let baseUrl: string;

  const projA = 'PRJ-DOC-A';
  const projB = 'PRJ-DOC-B';

  const userA = { id: 'usr_doc_a', username: 'doc_a', name: 'User A', role: 'PM / Project Lead' as const };
  const userB = { id: 'usr_doc_b', username: 'doc_b', name: 'User B', role: 'PM / Project Lead' as const };

  const tokenUserA = signUserSession({ id: userA.id, username: userA.username, name: userA.name, role: userA.role, projectId: projA });
  const tokenUserB = signUserSession({ id: userB.id, username: userB.username, name: userB.name, role: userB.role, projectId: projB });
  const adminToken = signUserSession({ id: 'usr_admin', username: 'admin', name: 'Admin', role: 'Project Admin' });

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as net.AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    const now = new Date().toISOString();
    for (const pid of [projA, projB]) {
      db.prepare(`
        INSERT OR REPLACE INTO projects (id, name, key, description, version, author, members_count, ai_policy, data, created_at, updated_at)
        VALUES (?, ?, ?, 'Document test project', 'v1.0.0', 'Admin', 2, 'OFFLINE_ONLY', '{}', ?, ?)
      `).run(pid, pid, pid.replace('-', ''), now, now);
    }

    db.prepare(`INSERT OR REPLACE INTO users (id, username, password_hash, password_salt, name, role, must_change_password, created_at) VALUES (?, ?, 'h', 's', ?, ?, 0, ?)`).run(userA.id, userA.username, userA.name, userA.role, now);
    db.prepare(`INSERT OR REPLACE INTO users (id, username, password_hash, password_salt, name, role, must_change_password, created_at) VALUES (?, ?, 'h', 's', ?, ?, 0, ?)`).run(userB.id, userB.username, userB.name, userB.role, now);

    db.prepare(`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)`).run(`pm_${projA}_${userA.id}`, projA, userA.id, userA.role, now);
    db.prepare(`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)`).run(`pm_${projB}_${userB.id}`, projB, userB.id, userB.role, now);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('R4-03: Cross-Project Document Hijacking Protection', () => {
    it('rejects POST /documents with existing ID belonging to a different project with 403 Forbidden', async () => {
      // 1. User B creates a document in Project B
      const victimDocId = `DOC-VICTIM-${Date.now()}`;
      db.prepare(`
        INSERT INTO documents (id, project_id, category, status, data, updated_at)
        VALUES (?, ?, '01_Project_Overview', 'Draft', '{}', datetime('now'))
      `).run(victimDocId, projB);

      // 2. User A attempts to overwrite victimDocId into Project A
      const res = await fetch(`${baseUrl}/api/v1/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenUserA}`
        },
        body: JSON.stringify({
          id: victimDocId,
          title: 'Hijacked Document Title',
          category: '01_Project_Overview',
          projectId: projA,
          contentMarkdown: '# Hijacked Content'
        })
      });

      expect(res.status).toBe(403);
      const json = await res.json() as any;
      expect(json.error).toContain('Tài liệu thuộc dự án khác');

      // Verify original document still belongs to projB and was not overwritten
      const checkDoc = dbRepository.documents.getById(victimDocId);
      expect(checkDoc?.projectId).toBe(projB);
    });
  });

  describe('R4-10: Version Sequence & Newest Fallback Resolution', () => {
    it('POST /documents/:id/versions calculates strictly increasing minor version numbers and rejects duplicates with 409', async () => {
      const docId = `DOC-VER-${Date.now()}`;
      db.prepare(`
        INSERT INTO documents (id, project_id, category, status, data, updated_at)
        VALUES (?, ?, '01_Project_Overview', 'Draft', '{}', datetime('now'))
      `).run(docId, projA);

      dbRepository.documentVersions.upsert({
        id: `${docId}-v1.0`,
        documentId: docId,
        versionNo: 'v1.0',
        fileId: null,
        extractedContent: '# Version 1.0 Content',
        status: 'ORGANIZED',
        changeSummary: 'Initial version',
        createdBy: 'Admin',
        createdAt: '2026-11-04 10:00:00'
      });

      // 1. Add v1.1 automatically
      const resV1 = await fetch(`${baseUrl}/api/v1/documents/${docId}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenUserA}`
        },
        body: JSON.stringify({
          contentMarkdown: '# Version 1.1 Content',
          changeSummary: 'Updated specs'
        })
      });

      expect(resV1.status).toBe(201);
      const jsonV1 = await resV1.json() as any;
      expect(jsonV1.data.versionNo).toBe('v1.1');

      // 2. Reject duplicate version with 409 Conflict
      const resDup = await fetch(`${baseUrl}/api/v1/documents/${docId}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenUserA}`
        },
        body: JSON.stringify({
          versionNo: 'v1.1',
          contentMarkdown: '# Attempted Duplicate v1.1 Content'
        })
      });

      expect(resDup.status).toBe(409);
      const jsonDup = await resDup.json() as any;
      expect(jsonDup.error).toContain('đã tồn tại');

      // 3. Next auto version must be v1.2
      const resV2 = await fetch(`${baseUrl}/api/v1/documents/${docId}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenUserA}`
        },
        body: JSON.stringify({
          contentMarkdown: '# Version 1.2 Content'
        })
      });

      expect(resV2.status).toBe(201);
      const jsonV2 = await resV2.json() as any;
      expect(jsonV2.data.versionNo).toBe('v1.2');
    });

    it('GET /documents/:id/file fallback resolves to newest version rather than oldest (R4-10)', async () => {
      const docId = `DOC-FALLBACK-${Date.now()}`;
      db.prepare(`
        INSERT INTO documents (id, project_id, category, status, data, updated_at)
        VALUES (?, ?, '01_Project_Overview', 'Draft', '{}', datetime('now'))
      `).run(docId, projA);

      // v1.0: Oldest
      dbRepository.documentVersions.upsert({
        id: `${docId}-v1.0`,
        documentId: docId,
        versionNo: 'v1.0',
        fileId: null,
        extractedContent: '# Oldest Version 1.0 Content',
        status: 'SUPERSEDED',
        changeSummary: 'Initial version',
        createdBy: 'Admin',
        createdAt: '2026-11-04 08:00:00'
      });

      // v1.1: Newest
      dbRepository.documentVersions.upsert({
        id: `${docId}-v1.1`,
        documentId: docId,
        versionNo: 'v1.1',
        fileId: null,
        extractedContent: '# Newest Version 1.1 Content',
        status: 'UPLOADED',
        changeSummary: 'Latest version',
        createdBy: 'Admin',
        createdAt: '2026-11-04 10:00:00'
      });

      // Download file without specifying ?version= query param
      const res = await fetch(`${baseUrl}/api/v1/documents/${docId}/file`, {
        headers: { Authorization: `Bearer ${tokenUserA}` }
      });

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('# Newest Version 1.1 Content');
      expect(text).not.toContain('# Oldest Version 1.0 Content');
    });
  });

  describe('R4-16: Content-Disposition Escaping & Header Security', () => {
    it('escapes and RFC 6266 encodes filenames in Content-Disposition header', async () => {
      const docId = `DOC-SPECIAL-${Date.now()}`;
      const specialName = 'Đặc Tả Nghiệp Vụ "2026"; test.md';
      const fileId = `file-${Date.now()}`;
      const storageKey = `projects/${projA}/${docId}/${fileId}.md`;

      await defaultFileStore.put(specialName, Buffer.from('# Special Char Spec'), storageKey);

      dbRepository.storedFiles.upsert({
        id: fileId,
        storageKey,
        originalName: specialName,
        mimeType: 'text/markdown',
        sizeBytes: 20,
        sha256: 'hash-spec',
        createdAt: new Date().toISOString()
      });

      db.prepare(`
        INSERT INTO documents (id, project_id, category, status, data, updated_at)
        VALUES (?, ?, '01_Project_Overview', 'Draft', '{}', datetime('now'))
      `).run(docId, projA);

      dbRepository.documentVersions.upsert({
        id: `${docId}-v1.0`,
        documentId: docId,
        versionNo: 'v1.0',
        fileId,
        extractedContent: '# Special Char Spec',
        status: 'UPLOADED',
        changeSummary: 'Uploaded',
        createdBy: 'Admin',
        createdAt: new Date().toISOString()
      });

      const res = await fetch(`${baseUrl}/api/v1/documents/${docId}/file`, {
        headers: { Authorization: `Bearer ${tokenUserA}` }
      });

      expect(res.status).toBe(200);
      const disposition = res.headers.get('content-disposition');
      expect(disposition).toBeDefined();
      // Must not contain unescaped raw quotes inside the filename token
      expect(disposition).toContain("filename*=UTF-8''");
      expect(disposition).not.toContain('"2026"');
    });
  });

  describe('R4-08: Project Creation ID Gap Safety & Creator Enrollment', () => {
    it('calculates nextId safely when gaps exist and immediately enrolls creator in project_members', async () => {
      // Simulate ID gap: create PRJ-88 and PRJ-90
      const gapA = 'PRJ-88';
      const gapB = 'PRJ-90';
      const now = new Date().toISOString();

      db.prepare(`
        INSERT OR REPLACE INTO projects (id, name, key, description, version, author, members_count, ai_policy, data, created_at, updated_at)
        VALUES (?, 'Gap 88', 'GAP88', 'Gap test', 'v1.0.0', 'Admin', 1, 'OFFLINE_ONLY', '{}', ?, ?),
               (?, 'Gap 90', 'GAP90', 'Gap test', 'v1.0.0', 'Admin', 1, 'OFFLINE_ONLY', '{}', ?, ?)
      `).run(gapA, now, now, gapB, now, now);

      // Create new project with PM user
      const res = await fetch(`${baseUrl}/api/v1/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenUserA}`
        },
        body: JSON.stringify({
          name: 'Safe Increment Project',
          key: `SAFEKEY${Date.now().toString().slice(-4)}`,
          description: 'Testing increment safety'
        })
      });

      expect(res.status).toBe(201);
      const json = await res.json() as any;
      const createdId = json.data.id;
      // Must be greater than 90 (e.g. PRJ-91), never overwriting existing PRJ-88 or PRJ-90
      const match = createdId.match(/^PRJ-(\d+)$/);
      expect(match).toBeDefined();
      const num = parseInt(match[1], 10);
      expect(num).toBeGreaterThanOrEqual(91);

      // Verify creator is now immediately in project_members and receives 200 on project query
      const memberRole = dbRepository.projectMembers.getRole(createdId, userA.id);
      expect(memberRole).toBe('PM / Project Lead');
    });
  });
});
