import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import net from 'net';
import Database from 'better-sqlite3';
import { app } from '../app.js';
import { db, dbRepository, ensureStoredFilesSynced } from '../database/db.js';
import { signUserSession } from '../common/auth.js';
import { DatabaseMigrator } from '../database/migrator.js';
import { allMigrations } from '../database/migrations/index.js';
import { migration015MoveLegacyContentToVersions } from '../database/migrations/015_move_legacy_content_to_versions.js';

describe('E11-T1: one source of document content', () => {
  describe('Migration 015 moves legacy content into document_versions', () => {
    let memDb: Database.Database;
    let applied: string[];
    const untouchedData = JSON.stringify({ id: 'DOC-L-PLAIN', title: 'No legacy copy', currentVersion: 'v1.0' });

    const dataOf = (id: string) => JSON.parse((memDb.prepare('SELECT data FROM documents WHERE id = ?').get(id) as { data: string }).data);
    const versionsOf = (id: string) =>
      memDb.prepare('SELECT id, version_no, file_id, extracted_content FROM document_versions WHERE document_id = ? ORDER BY version_no').all(id) as Array<{ id: string; version_no: string; file_id: string | null; extracted_content: string | null }>;
    const snapshot = () => ({
      documents: memDb.prepare('SELECT id, data FROM documents ORDER BY id').all(),
      versions: memDb.prepare('SELECT * FROM document_versions ORDER BY id').all()
    });

    beforeAll(() => {
      memDb = new Database(':memory:');
      // Schema as it is on a database that stopped at migration 014
      new DatabaseMigrator(memDb, allMigrations.filter(m => m.version <= '014')).runPendingMigrations();
      expect(memDb.pragma('foreign_keys', { simple: true })).toBe(1);

      memDb.prepare(`
        INSERT OR REPLACE INTO projects (id, name, key, description, version, author, members_count, data, created_at, updated_at)
        VALUES ('PRJ-01', 'Default', 'P1', 'Desc', 'v1.0', 'Admin', 1, '{}', datetime('now'), datetime('now'))
      `).run();

      const insertDoc = memDb.prepare(`INSERT INTO documents (id, project_id, category, status, data, updated_at) VALUES (?, 'PRJ-01', '01_Project_Overview', 'Draft', ?, '2026-11-01 10:00')`);
      const insertVersion = memDb.prepare(`
        INSERT INTO document_versions (id, document_id, version_no, file_id, extracted_content, status, change_summary, created_by, created_at)
        VALUES (?, ?, ?, NULL, ?, 'Draft', 'Test', 'Tester', '2026-11-01')
      `);
      const legacyDoc = (id: string, extra: Record<string, unknown>) =>
        insertDoc.run(id, JSON.stringify({ id, title: `Title ${id}`, currentVersion: 'v1.0', status: 'Draft', author: 'Tester', updatedAt: '2026-11-01 10:00', ...extra }));

      // 1. Legacy text, no version at all
      legacyDoc('DOC-L-NOVER', { currentVersion: 'v2.1', contentMarkdown: '# Only in the document record' });
      // 2. Legacy text identical to the version
      legacyDoc('DOC-L-SAME', { contentMarkdown: '# Same text' });
      insertVersion.run('DOC-L-SAME-v1.0', 'DOC-L-SAME', 'v1.0', '# Same text');
      // 3. Version exists but holds no text
      legacyDoc('DOC-L-EMPTY', { contentMarkdown: '# Text the version lacks' });
      insertVersion.run('DOC-L-EMPTY-v1.0', 'DOC-L-EMPTY', 'v1.0', null);
      // 4. Legacy text is a stale copy of an older version; the current version is newer
      legacyDoc('DOC-L-STALE', { currentVersion: 'v1.1', contentMarkdown: '# Old v1.0 text' });
      insertVersion.run('DOC-L-STALE-v1.0', 'DOC-L-STALE', 'v1.0', '# Old v1.0 text');
      insertVersion.run('DOC-L-STALE-v1.1', 'DOC-L-STALE', 'v1.1', '# New v1.1 text');
      // 5. Legacy text differs from every version
      legacyDoc('DOC-L-DIFF', { contentMarkdown: '# Text found in no version' });
      insertVersion.run('DOC-L-DIFF-v1.0', 'DOC-L-DIFF', 'v1.0', '# Version text');
      // 6. Empty legacy text and a version with empty text
      legacyDoc('DOC-L-BLANK', { contentMarkdown: '' });
      insertVersion.run('DOC-L-BLANK-v1.0', 'DOC-L-BLANK', 'v1.0', '');
      // 7. No legacy copy
      insertDoc.run('DOC-L-PLAIN', untouchedData);
      insertVersion.run('DOC-L-PLAIN-v1.0', 'DOC-L-PLAIN', 'v1.0', '# Plain');
      // 8. Payload that is not valid JSON
      insertDoc.run('DOC-L-BROKEN', '{not json');

      applied = new DatabaseMigrator(memDb, allMigrations).runPendingMigrations().appliedVersions;
    });

    afterAll(() => {
      memDb.close();
    });

    it('is registered and applied by the real migrator after 014', () => {
      expect(applied).toContain('015');
      expect(memDb.prepare(`SELECT name FROM schema_migrations WHERE version = '015'`).get()).toEqual({ name: 'move_legacy_content_to_versions' });
    });

    it('creates a version for a legacy document that had none', () => {
      expect(versionsOf('DOC-L-NOVER')).toEqual([
        { id: 'DOC-L-NOVER-v2_1', version_no: 'v2.1', file_id: null, extracted_content: '# Only in the document record' }
      ]);
      expect(dataOf('DOC-L-NOVER')).not.toHaveProperty('contentMarkdown');
    });

    it('removes the copy when a version already holds the same text', () => {
      expect(versionsOf('DOC-L-SAME')).toHaveLength(1);
      expect(versionsOf('DOC-L-SAME')[0].extracted_content).toBe('# Same text');
      expect(dataOf('DOC-L-SAME')).not.toHaveProperty('contentMarkdown');
      expect(dataOf('DOC-L-BLANK')).not.toHaveProperty('contentMarkdown');
      expect(versionsOf('DOC-L-BLANK')[0].extracted_content).toBe('');
    });

    it('fills a version that held no text', () => {
      expect(versionsOf('DOC-L-EMPTY')).toHaveLength(1);
      expect(versionsOf('DOC-L-EMPTY')[0].extracted_content).toBe('# Text the version lacks');
      expect(dataOf('DOC-L-EMPTY')).not.toHaveProperty('contentMarkdown');
    });

    it('leaves a newer current version alone when the copy matches an older version', () => {
      expect(versionsOf('DOC-L-STALE').map(v => v.extracted_content)).toEqual(['# Old v1.0 text', '# New v1.1 text']);
      expect(dataOf('DOC-L-STALE')).not.toHaveProperty('contentMarkdown');
    });

    it('keeps text that no version holds, without overwriting the version', () => {
      expect(versionsOf('DOC-L-DIFF')).toHaveLength(1);
      expect(versionsOf('DOC-L-DIFF')[0].extracted_content).toBe('# Version text');
      const data = dataOf('DOC-L-DIFF');
      expect(data).not.toHaveProperty('contentMarkdown');
      expect(data.legacyContentMarkdown).toBe('# Text found in no version');
    });

    it('does not touch documents without a legacy copy or with an unreadable payload', () => {
      expect((memDb.prepare(`SELECT data FROM documents WHERE id = 'DOC-L-PLAIN'`).get() as { data: string }).data).toBe(untouchedData);
      expect((memDb.prepare(`SELECT data FROM documents WHERE id = 'DOC-L-BROKEN'`).get() as { data: string }).data).toBe('{not json');
    });

    it('keeps every other field of the document payload', () => {
      expect(dataOf('DOC-L-NOVER')).toEqual({
        id: 'DOC-L-NOVER', title: 'Title DOC-L-NOVER', currentVersion: 'v2.1', status: 'Draft', author: 'Tester', updatedAt: '2026-11-01 10:00'
      });
    });

    it('leaves no document with a contentMarkdown key and no foreign key violation', () => {
      const left = memDb.prepare(`SELECT count(*) AS n FROM documents WHERE json_valid(data) AND json_type(data, '$.contentMarkdown') IS NOT NULL`).get() as { n: number };
      expect(left.n).toBe(0);
      expect(memDb.pragma('foreign_key_check')).toEqual([]);
    });

    it('changes nothing when run a second time', () => {
      const before = snapshot();
      migration015MoveLegacyContentToVersions.up(memDb);
      expect(snapshot()).toEqual(before);
    });
  });

  describe('Routes read and write content through document_versions', () => {
    let server: http.Server;
    let baseUrl: string;

    const projA = 'PRJ-E11-A';
    const projB = 'PRJ-E11-B';
    const userA = { id: 'usr_e11_a', username: 'e11_a', name: 'E11 User A', role: 'PM / Project Lead' as const };
    const userB = { id: 'usr_e11_b', username: 'e11_b', name: 'E11 User B', role: 'PM / Project Lead' as const };
    const tokenA = signUserSession({ id: userA.id, username: userA.username, name: userA.name, role: userA.role, projectId: projA });
    const tokenB = signUserSession({ id: userB.id, username: userB.username, name: userB.name, role: userB.role, projectId: projB });

    const rawData = (id: string) => JSON.parse((db.prepare('SELECT data FROM documents WHERE id = ?').get(id) as { data: string }).data);
    const get = (path: string, token?: string) =>
      fetch(`${baseUrl}/api/v1/documents${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

    const legacyDocId = `DOC-E11-LEGACY-${Date.now()}`;

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
          VALUES (?, ?, ?, 'E11 test project', 'v1.0.0', 'Admin', 1, 'OFFLINE_ONLY', '{}', ?, ?)
        `).run(pid, pid, pid.replace(/-/g, ''), now, now);
      }
      for (const [u, p] of [[userA, projA], [userB, projB]] as const) {
        db.prepare(`INSERT OR REPLACE INTO users (id, username, password_hash, password_salt, name, role, must_change_password, created_at) VALUES (?, ?, 'h', 's', ?, ?, 0, ?)`).run(u.id, u.username, u.name, u.role, now);
        db.prepare(`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)`).run(`pm_${p}_${u.id}`, p, u.id, u.role, now);
      }

      // A row shaped like old data: a text copy in documents.data that differs from the versions, and no stored file
      db.prepare(`INSERT INTO documents (id, project_id, category, status, data, updated_at) VALUES (?, ?, '01_Project_Overview', 'Draft', ?, ?)`)
        .run(legacyDocId, projA, JSON.stringify({ id: legacyDocId, projectId: projA, title: 'Legacy', category: '01_Project_Overview', currentVersion: 'v1.1', status: 'Draft', contentMarkdown: '# Copy in the document record', versions: [] }), now);
      for (const [no, text] of [['v1.0', '# Version 1.0 text'], ['v1.1', '# Version 1.1 text']]) {
        dbRepository.documentVersions.upsert({
          id: `${legacyDocId}-${no}`, documentId: legacyDocId, versionNo: no, fileId: null, extractedContent: text,
          status: 'ORGANIZED', changeSummary: 'Test', createdBy: 'Tester', createdAt: now
        });
      }
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('POST /documents stores the text in the version only', async () => {
      const res = await fetch(`${baseUrl}/api/v1/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ title: 'E11 manual doc', category: '01_Project_Overview', projectId: projA, contentMarkdown: '# Manual text' })
      });
      expect(res.status).toBe(201);
      const created = (await res.json() as any).data;
      expect(created).not.toHaveProperty('contentMarkdown');
      expect(rawData(created.id)).not.toHaveProperty('contentMarkdown');
      expect(dbRepository.documentVersions.getByDocumentId(created.id)[0].extractedContent).toBe('# Manual text');

      const content = await get(`/${created.id}/content`, tokenA);
      expect(content.status).toBe(200);
      expect((await content.json() as any).data).toEqual({
        documentId: created.id, versionId: `${created.id}-v1.0`, versionNo: 'v1.0', content: '# Manual text'
      });

      const list = (await (await get(`?projectId=${projA}`, tokenA)).json() as any).data as any[];
      expect(list.find(d => d.id === created.id)).not.toHaveProperty('contentMarkdown');
    });

    it('POST /documents/upload stores the text in the version only', async () => {
      const text = `# E11 upload ${Date.now()}\n\nUploaded body.`;
      const form = new FormData();
      form.append('projectId', projA);
      form.append('files', new Blob([text], { type: 'text/markdown' }), 'e11-upload.md');
      const res = await fetch(`${baseUrl}/api/v1/documents/upload`, { method: 'POST', headers: { Authorization: `Bearer ${tokenA}` }, body: form });
      expect(res.status).toBeLessThan(300);
      const doc = (await res.json() as any).data.documents[0];
      expect(doc).not.toHaveProperty('contentMarkdown');
      expect(rawData(doc.id)).not.toHaveProperty('contentMarkdown');

      const content = (await (await get(`/${doc.id}/content`, tokenA)).json() as any).data;
      expect(content.content).toBe(text);
    });

    it('POST /documents/:id/versions makes the new text the one that is shown', async () => {
      const created = (await (await fetch(`${baseUrl}/api/v1/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ title: 'E11 versioned doc', category: '01_Project_Overview', projectId: projA, content: '# First text' })
      })).json() as any).data;

      const res = await fetch(`${baseUrl}/api/v1/documents/${created.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ content: '# Second text' })
      });
      expect(res.status).toBe(201);
      expect(rawData(created.id)).not.toHaveProperty('contentMarkdown');

      expect((await (await get(`/${created.id}/content`, tokenA)).json() as any).data).toMatchObject({ versionNo: 'v1.1', content: '# Second text' });
      expect((await (await get(`/${created.id}/content?version=v1.0`, tokenA)).json() as any).data).toMatchObject({ versionNo: 'v1.0', content: '# First text' });
    });

    it('GET /documents/:id/content reads the version, not the copy in the document record', async () => {
      const current = (await (await get(`/${legacyDocId}/content`, tokenA)).json() as any).data;
      expect(current).toEqual({ documentId: legacyDocId, versionId: `${legacyDocId}-v1.1`, versionNo: 'v1.1', content: '# Version 1.1 text' });

      const older = (await (await get(`/${legacyDocId}/content?version=v1.0`, tokenA)).json() as any).data;
      expect(older.content).toBe('# Version 1.0 text');
    });

    it('GET /documents/:id/content keeps project access fail-closed', async () => {
      expect((await get(`/${legacyDocId}/content`)).status).toBe(401);
      expect((await get(`/${legacyDocId}/content`, tokenB)).status).toBe(403);
      expect((await get(`/DOC-E11-MISSING/content`, tokenA)).status).toBe(404);
    });

    it('GET /documents/:id/file never serves the copy in the document record', async () => {
      const withVersion = await get(`/${legacyDocId}/file`, tokenA);
      expect(withVersion.status).toBe(200);
      expect(await withVersion.text()).toBe('# Version 1.1 text');

      const noTextId = `DOC-E11-NOTEXT-${Date.now()}`;
      db.prepare(`INSERT INTO documents (id, project_id, category, status, data, updated_at) VALUES (?, ?, '01_Project_Overview', 'Draft', ?, datetime('now'))`)
        .run(noTextId, projA, JSON.stringify({ id: noTextId, projectId: projA, title: 'No text', currentVersion: 'v1.0', contentMarkdown: '# Copy in the document record', versions: [] }));
      dbRepository.documentVersions.upsert({
        id: `${noTextId}-v1.0`, documentId: noTextId, versionNo: 'v1.0', fileId: null, extractedContent: null,
        status: 'ORGANIZED', changeSummary: 'Test', createdBy: 'Tester', createdAt: new Date().toISOString()
      });
      expect((await get(`/${noTextId}/file`, tokenA)).status).toBe(404);
    });

    it('start-up file sync gives a file to a version created by migration 015 and keeps its text', () => {
      const id = `DOC-E11-SYNC-${Date.now()}`;
      db.prepare(`INSERT INTO documents (id, project_id, category, status, data, updated_at) VALUES (?, ?, '01_Project_Overview', 'Draft', ?, datetime('now'))`)
        .run(id, projA, JSON.stringify({ id, projectId: projA, title: 'Sync', currentVersion: 'v2.1', versions: [] }));
      dbRepository.documentVersions.upsert({
        id: `${id}-v2_1`, documentId: id, versionNo: 'v2.1', fileId: null, extractedContent: '# Moved legacy text',
        status: 'Draft', changeSummary: 'Legacy content moved from the document record', createdBy: 'Tester', createdAt: new Date().toISOString()
      });

      ensureStoredFilesSynced();

      const versions = dbRepository.documentVersions.getByDocumentId(id);
      expect(versions).toHaveLength(1);
      expect(versions[0].id).toBe(`${id}-v2_1`);
      expect(versions[0].extractedContent).toBe('# Moved legacy text');
      expect(versions[0].fileId).toBeTruthy();
      expect(dbRepository.storedFiles.getById(versions[0].fileId!)?.originalName).toBe(`${id}.md`);
    });

    it('baseline seed documents keep their text in a version', () => {
      const row = db.prepare(`SELECT data FROM documents WHERE id = 'DOC-03'`).get() as { data: string } | undefined;
      expect(row).toBeDefined();
      expect(JSON.parse(row!.data)).not.toHaveProperty('contentMarkdown');
      expect(JSON.parse(row!.data)).not.toHaveProperty('seedContent');
      const versions = dbRepository.documentVersions.getByDocumentId('DOC-03');
      expect(versions).toHaveLength(1);
      expect(versions[0].fileId).toBeTruthy();
      expect(versions[0].extractedContent).toContain('# Software Requirements Specification (SRS) - Evidence Lifecycle');
    });
  });
});
