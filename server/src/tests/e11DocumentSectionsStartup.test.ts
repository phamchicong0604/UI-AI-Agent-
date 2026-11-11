import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { DatabaseMigrator } from '../database/migrator.js';
import { allMigrations } from '../database/migrations/index.js';

/**
 * E11-T3: a database that stopped at migration 015 and already holds versions and knowledge sources is
 * opened by the application's own start-up code (database/db.ts). This file must not import db.ts at the
 * top: the module is loaded inside the test, after the database file was prepared.
 */
describe('E11-T3: start-up on an existing database', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docqa-e11t3-startup-'));
  const dbPath = path.join(dir, 'existing.sqlite');
  const previousDbPath = process.env.DOCQA_DB_PATH;
  const TEXT = '# Quy định\n\n## Mật khẩu\nNgười dùng phải đổi mật khẩu sau 90 ngày.\n\n## Phiên làm việc\nPhiên hết hạn sau 30 phút.\n';
  const QUOTE = 'Phiên hết hạn sau 30 phút.';
  let appDb: Database.Database;

  beforeAll(async () => {
    const prepared = new Database(dbPath);
    new DatabaseMigrator(prepared, allMigrations.filter(m => m.version <= '015')).runPendingMigrations();
    prepared.prepare(`
      INSERT INTO projects (id, name, key, description, version, author, members_count, data, created_at, updated_at)
      VALUES ('PRJ-OLD', 'Old', 'OLD', 'Desc', 'v1.0', 'Admin', 1, '{}', datetime('now'), datetime('now'))
    `).run();
    prepared.prepare(`INSERT INTO documents (id, project_id, category, status, data, updated_at) VALUES ('DOC-OLD', 'PRJ-OLD', '01_Project_Overview', 'Draft', ?, '2026-11-01 10:00')`)
      .run(JSON.stringify({ id: 'DOC-OLD', projectId: 'PRJ-OLD', title: 'Old', currentVersion: 'v1.0' }));
    prepared.prepare(`INSERT INTO stored_files (id, storage_key, original_name, mime_type, size_bytes, sha256, created_at) VALUES ('FILE-OLD', 'projects/PRJ-OLD/DOC-OLD/old.md', 'old.md', 'text/markdown', 1, 'sha256:x', '2026-11-01')`).run();
    prepared.prepare(`
      INSERT INTO document_versions (id, document_id, version_no, file_id, extracted_content, status, change_summary, created_by, created_at)
      VALUES ('DOC-OLD-v1.0', 'DOC-OLD', 'v1.0', 'FILE-OLD', ?, 'Draft', 'Test', 'Tester', '2026-11-01')
    `).run(TEXT);
    prepared.prepare(`
      INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, evidence_level, status, created_at, updated_at)
      VALUES ('KU-OLD', 'PRJ-OLD', 'Requirement', 'c', 's', 'a', 'Explicit', 'Draft', '2026-11-01', '2026-11-01')
    `).run();
    prepared.prepare(`
      INSERT INTO knowledge_sources (id, unit_id, document_version_id, heading_path, char_offset_start, char_offset_end, page_number, exact_quote, created_at)
      VALUES ('SRC-OLD', 'KU-OLD', 'DOC-OLD-v1.0', '["Chung"]', 0, 0, 1, ?, '2026-11-01')
    `).run(QUOTE);
    prepared.close();

    process.env.DOCQA_DB_PATH = dbPath;
    appDb = (await import('../database/db.js')).db;
  });

  afterAll(() => {
    appDb?.close();
    process.env.DOCQA_DB_PATH = previousDbPath;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('opens the prepared database, not the shared test database', () => {
    expect(appDb.name).toBe(dbPath);
    expect(appDb.prepare(`SELECT version FROM schema_migrations WHERE version = '016'`).get()).toEqual({ version: '016' });
  });

  it('gives the existing version its sections and leaves its text unchanged', () => {
    expect(appDb.prepare('SELECT extracted_content FROM document_versions WHERE id = ?').get('DOC-OLD-v1.0')).toEqual({ extracted_content: TEXT });
    const sections = appDb.prepare(`
      SELECT heading_path, char_start, char_end FROM document_sections WHERE document_version_id = 'DOC-OLD-v1.0' ORDER BY order_no
    `).all() as Array<{ heading_path: string; char_start: number; char_end: number }>;
    expect(sections.map(s => s.heading_path)).toEqual(['["Quy định"]', '["Quy định","Mật khẩu"]', '["Quy định","Phiên làm việc"]']);
    expect(sections.map(s => TEXT.slice(s.char_start, s.char_end)).join('')).toBe(TEXT);
  });

  it('links the existing knowledge source to its section', () => {
    const row = appDb.prepare(`
      SELECT ds.heading_path FROM knowledge_sources ks JOIN document_sections ds ON ds.id = ks.section_id WHERE ks.id = 'SRC-OLD'
    `).get();
    expect(row).toEqual({ heading_path: '["Quy định","Phiên làm việc"]' });
  });

  it('leaves no version with text and without sections, and no foreign key violation', () => {
    const missing = appDb.prepare(`
      SELECT dv.id FROM document_versions dv
      WHERE COALESCE(dv.extracted_content, '') <> '' AND NOT EXISTS (SELECT 1 FROM document_sections ds WHERE ds.document_version_id = dv.id)
    `).all();
    expect(missing).toEqual([]);
    expect(appDb.pragma('foreign_key_check')).toEqual([]);
  });
});
