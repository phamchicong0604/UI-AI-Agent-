import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import http from 'http';
import net from 'net';
import { randomUUID } from 'crypto';
import { app } from '../app.js';
import { db, dbRepository } from '../database/db.js';
import { defaultFileStore } from '../common/fileStore.js';
import { RetentionService } from '../modules/documents/retentionService.js';
import { signUserSession } from '../common/auth.js';

describe('Bug Review Phase 2: Data Integrity (BUG-008, BUG-019 to BUG-023)', () => {
  let server: http.Server;
  let baseUrl: string;

  const adminToken = signUserSession({ id: 'usr_admin', username: 'admin', name: 'Admin', role: 'Project Admin' });
  const qaToken = signUserSession({ id: 'usr_qa', username: 'qa', name: 'QA', role: 'QA' });

  beforeAll(async () => {
    db.prepare("UPDATE users SET must_change_password = 0 WHERE id = 'usr_admin'").run();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as net.AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('BUG-020: Unique Stored Files per Project Scope', () => {
    it('should not delete project B files when project A is deleted, even with identical content', async () => {
      const projA = `PRJ-A-${Date.now()}`;
      const projB = `PRJ-B-${Date.now()}`;

      // Create two projects
      db.prepare(`
        INSERT INTO projects (id, name, key, description, version, author, members_count, ai_policy, data, created_at, updated_at)
        VALUES (?, 'Project A', 'PA', 'Desc', 'v1.0', 'Admin', 1, 'ALLOW_EXTERNAL', '{}', datetime('now'), datetime('now')),
               (?, 'Project B', 'PB', 'Desc', 'v1.0', 'Admin', 1, 'ALLOW_EXTERNAL', '{}', datetime('now'), datetime('now'))
      `).run(projA, projB);

      // Create document with identical content in both projects
      const identicalContent = '# Identical Content Specification\nRules are common across projects.';
      const bufA = Buffer.from(identicalContent);
      const bufB = Buffer.from(identicalContent);

      const storageKeyA = `projects/${projA}/DOC-A/spec.md`;
      const storageKeyB = `projects/${projB}/DOC-B/spec.md`;

      await defaultFileStore.put('spec.md', bufA, storageKeyA);
      await defaultFileStore.put('spec.md', bufB, storageKeyB);

      const fileIdA = 'file-' + randomUUID();
      const fileIdB = 'file-' + randomUUID();

      db.prepare(`
        INSERT INTO stored_files (id, storage_key, original_name, mime_type, size_bytes, sha256, created_at)
        VALUES (?, ?, 'spec.md', 'text/markdown', ?, 'hash-common', datetime('now')),
               (?, ?, 'spec.md', 'text/markdown', ?, 'hash-common', datetime('now'))
      `).run(fileIdA, storageKeyA, bufA.length, fileIdB, storageKeyB, bufB.length);

      const docIdA = 'DOC-A-' + randomUUID();
      const docIdB = 'DOC-B-' + randomUUID();
      const dvIdA = 'DV-A-' + randomUUID();
      const dvIdB = 'DV-B-' + randomUUID();

      db.prepare(`
        INSERT INTO documents (id, project_id, category, status, data, updated_at)
        VALUES (?, ?, '01_Project_Overview', 'Draft', '{}', datetime('now')),
               (?, ?, '01_Project_Overview', 'Draft', '{}', datetime('now'))
      `).run(docIdA, projA, docIdB, projB);

      db.prepare(`
        INSERT INTO document_versions (id, document_id, version_no, file_id, status, created_by, created_at)
        VALUES (?, ?, 'v1.0', ?, 'Draft', 'Tester', datetime('now')),
               (?, ?, 'v1.0', ?, 'Draft', 'Tester', datetime('now'))
      `).run(dvIdA, docIdA, fileIdA, dvIdB, docIdB, fileIdB);

      // Delete Project A
      await RetentionService.cascadeDeleteProject(db, projA, 'Admin');

      // Verify Project A files are gone
      expect(await defaultFileStore.exists(storageKeyA)).toBe(false);

      // Verify Project B files are STILL INTACT!
      expect(await defaultFileStore.exists(storageKeyB)).toBe(true);

      const docB = db.prepare('SELECT * FROM documents WHERE id = ?').get(docIdB);
      expect(docB).toBeDefined();

      const fileBRow = db.prepare('SELECT * FROM stored_files WHERE id = ?').get(fileIdB);
      expect(fileBRow).toBeDefined();

      // Clean up Project B
      await RetentionService.cascadeDeleteProject(db, projB, 'Admin');
    });
  });

  describe('BUG-021: Upload Batch Project Validation & Atomicity', () => {
    it('should return 400 when uploading with non-existent projectId and create zero records', async () => {
      const boundary = '----WebKitFormBoundaryABC123';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="projectId"',
        '',
        'PRJ-TOTALLY-INVALID',
        `--${boundary}`,
        'Content-Disposition: form-data; name="files"; filename="test.md"',
        'Content-Type: text/markdown',
        '',
        '# Test Document\nValid markdown content.',
        `--${boundary}--`
      ].join('\r\n');

      const res = await fetch(`${baseUrl}/api/v1/documents/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Authorization': `Bearer ${adminToken}`
        },
        body
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as any;
      expect(json.success).toBe(false);
      expect(json.error).toContain('không tồn tại');

      // Verify no orphan records were created
      const docs = db.prepare('SELECT * FROM documents WHERE project_id = ?').all('PRJ-TOTALLY-INVALID');
      expect(docs.length).toBe(0);
    });
  });

  describe('BUG-023: Document Deletion Authorization and Disk Cleanup', () => {
    it('should reject unauthenticated or non-admin DELETE /documents/:id', async () => {
      const docId = `DOC-DEL-${Date.now()}`;
      db.prepare(`
        INSERT INTO documents (id, project_id, category, status, data, updated_at)
        VALUES (?, 'PRJ-01', '01_Project_Overview', 'Draft', '{}', datetime('now'))
      `).run(docId);

      // 1. Without auth
      const res1 = await fetch(`${baseUrl}/api/v1/documents/${docId}`, {
        method: 'DELETE'
      });
      expect(res1.status).toBe(401);

      // 2. With unauthorized role (QA)
      const res2 = await fetch(`${baseUrl}/api/v1/documents/${docId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${qaToken}` }
      });
      expect(res2.status).toBe(403);
    });

    it('should cascade delete document, versions and clean up physical file on disk when admin deletes', async () => {
      const docId = `DOC-DEL-ADMIN-${Date.now()}`;
      const storageKey = `projects/PRJ-01/${docId}/spec.md`;
      const fileId = 'file-' + randomUUID();

      await defaultFileStore.put('spec.md', Buffer.from('# To Be Deleted'), storageKey);

      db.prepare(`
        INSERT INTO stored_files (id, storage_key, original_name, mime_type, size_bytes, sha256, created_at)
        VALUES (?, ?, 'spec.md', 'text/markdown', 15, 'hash-del', datetime('now'))
      `).run(fileId, storageKey);

      db.prepare(`
        INSERT INTO documents (id, project_id, category, status, data, updated_at)
        VALUES (?, 'PRJ-01', '01_Project_Overview', 'Draft', '{}', datetime('now'))
      `).run(docId);

      db.prepare(`
        INSERT INTO document_versions (id, document_id, version_no, file_id, status, created_by, created_at)
        VALUES (?, ?, 'v1.0', ?, 'Draft', 'Admin', datetime('now'))
      `).run(`${docId}-v1.0`, docId, fileId);

      expect(await defaultFileStore.exists(storageKey)).toBe(true);

      // Delete with Project Admin role
      const res = await fetch(`${baseUrl}/api/v1/documents/${docId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      expect(res.status).toBe(200);

      // Verify file is removed from disk
      expect(await defaultFileStore.exists(storageKey)).toBe(false);

      // Verify records are gone from DB
      const docRow = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
      expect(docRow).toBeUndefined();

      const fileRow = db.prepare('SELECT * FROM stored_files WHERE id = ?').get(fileId);
      expect(fileRow).toBeUndefined();
    });
  });
});
