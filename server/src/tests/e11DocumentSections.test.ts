import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import net from 'net';
import Database from 'better-sqlite3';
import { app } from '../app.js';
import { db, dbRepository, ensureStoredFilesSynced } from '../database/db.js';
import { signUserSession } from '../common/auth.js';
import { DatabaseMigrator } from '../database/migrator.js';
import { allMigrations } from '../database/migrations/index.js';
import { migration016DocumentSections } from '../database/migrations/016_document_sections.js';
import { listVersionSections, syncAllDocumentSections, syncVersionSections } from '../database/documentSectionStore.js';
import { mapSections, stableKeyForHeadingPath } from '../modules/documents/documentSections.js';
import { defaultJobQueue } from '../modules/workflow/jobQueue.js';
import { registerPipelineHandlers } from '../modules/workflow/pipelineWorker.js';
import { RetentionService } from '../modules/documents/retentionService.js';
import { DocumentSectionRecord } from '../common/types.js';

/** Ordered, no gap, no overlap, whole text covered, unique keys */
function expectCoverage(text: string, sections: DocumentSectionRecord[]) {
  let cursor = 0;
  sections.forEach((s, i) => {
    expect(s.orderNo).toBe(i);
    expect(s.charStart).toBe(cursor);
    expect(s.charEnd).toBeGreaterThan(s.charStart);
    cursor = s.charEnd;
  });
  expect(cursor).toBe(text.length);
  expect(new Set(sections.map(s => s.stableKey)).size).toBe(sections.length);
}

const VI_TEXT = [
  'Tài liệu đặc tả cho phân hệ thanh toán.',
  '',
  '# Đặc tả yêu cầu',
  '',
  '## Mục tiêu',
  'Hệ thống phải xử lý hoàn tiền trong vòng 3 ngày làm việc.',
  '',
  '## Phạm vi',
  'Áp dụng cho khách hàng doanh nghiệp. Câu lặp lại ở hai mục.',
  '',
  '## Quy tắc nghiệp vụ',
  'Mỗi giao dịch bắt buộc có mã đối soát. Câu lặp lại ở hai mục.',
  ''
].join('\n');
const PLAIN_TEXT = 'Đoạn thứ nhất không có tiêu đề.\n\nĐoạn thứ hai không có tiêu đề.\n\nĐoạn thứ ba.';

describe('E11-T3: document_sections', () => {
  describe('Migration 016 and the backfill on a database that stopped at 015', () => {
    let memDb: Database.Database;
    let applied: string[];
    let firstRun: ReturnType<typeof syncAllDocumentSections>;

    const sectionsOf = (versionId: string) => listVersionSections(memDb, versionId);
    const sectionIdOfSource = (sourceId: string) =>
      (memDb.prepare('SELECT section_id FROM knowledge_sources WHERE id = ?').get(sourceId) as { section_id: string | null }).section_id;
    const versionTexts = () => memDb.prepare('SELECT id, extracted_content FROM document_versions ORDER BY id').all();
    const derivedRows = () => ({
      sections: memDb.prepare('SELECT * FROM document_sections ORDER BY id').all(),
      sources: memDb.prepare('SELECT * FROM knowledge_sources ORDER BY id').all()
    });
    const totalChanges = () => (memDb.prepare('SELECT total_changes() AS n').get() as { n: number }).n;
    let textsBefore: unknown[];

    beforeAll(() => {
      memDb = new Database(':memory:');
      new DatabaseMigrator(memDb, allMigrations.filter(m => m.version <= '015')).runPendingMigrations();
      expect(memDb.pragma('foreign_keys', { simple: true })).toBe(1);
      expect(memDb.prepare(`SELECT name FROM sqlite_master WHERE name = 'document_sections'`).get()).toBeUndefined();

      memDb.prepare(`
        INSERT OR REPLACE INTO projects (id, name, key, description, version, author, members_count, data, created_at, updated_at)
        VALUES ('PRJ-01', 'Default', 'P1', 'Desc', 'v1.0', 'Admin', 1, '{}', datetime('now'), datetime('now'))
      `).run();
      const insertDoc = memDb.prepare(`INSERT INTO documents (id, project_id, category, status, data, updated_at) VALUES (?, 'PRJ-01', '01_Project_Overview', 'Draft', ?, '2026-11-01 10:00')`);
      const insertVersion = memDb.prepare(`
        INSERT INTO document_versions (id, document_id, version_no, file_id, extracted_content, status, change_summary, created_by, created_at)
        VALUES (?, ?, ?, NULL, ?, 'Draft', 'Test', 'Tester', '2026-11-01')
      `);
      for (const id of ['DOC-VI', 'DOC-PLAIN', 'DOC-NOTEXT']) insertDoc.run(id, JSON.stringify({ id, title: id, currentVersion: 'v1.0' }));
      insertVersion.run('DOC-VI-v1.0', 'DOC-VI', 'v1.0', VI_TEXT);
      insertVersion.run('DOC-VI-v1.1', 'DOC-VI', 'v1.1', VI_TEXT.replace('3 ngày', '5 ngày'));
      insertVersion.run('DOC-PLAIN-v1.0', 'DOC-PLAIN', 'v1.0', PLAIN_TEXT);
      insertVersion.run('DOC-NOTEXT-v1.0', 'DOC-NOTEXT', 'v1.0', null);
      insertVersion.run('DOC-NOTEXT-v1.1', 'DOC-NOTEXT', 'v1.1', '');

      const insertUnit = memDb.prepare(`
        INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, evidence_level, status, created_at, updated_at)
        VALUES (?, 'PRJ-01', 'Requirement', 'c', 's', 'a', 'Explicit', 'Draft', '2026-11-01', '2026-11-01')
      `);
      const insertSource = memDb.prepare(`
        INSERT INTO knowledge_sources (id, unit_id, document_version_id, heading_path, char_offset_start, char_offset_end, page_number, exact_quote, created_at)
        VALUES (?, ?, 'DOC-VI-v1.0', '["Chung"]', ?, ?, 1, ?, '2026-11-01')
      `);
      const source = (id: string, start: number, end: number, quote: string) => {
        insertUnit.run(`KU-${id}`);
        insertSource.run(id, `KU-${id}`, start, end, quote);
      };
      const goal = 'Hệ thống phải xử lý hoàn tiền trong vòng 3 ngày làm việc.';
      const rule = 'Mỗi giao dịch bắt buộc có mã đối soát.';
      const repeated = 'Câu lặp lại ở hai mục.';
      source('SRC-OFFSETS-OK', VI_TEXT.indexOf(goal), VI_TEXT.indexOf(goal) + goal.length, goal);
      source('SRC-OFFSETS-MISSING', 0, 0, rule);
      source('SRC-OFFSETS-WRONG', 3, 3 + rule.length, rule);
      source('SRC-REPEATED-SECOND', VI_TEXT.lastIndexOf(repeated), VI_TEXT.lastIndexOf(repeated) + repeated.length, repeated);
      source('SRC-AMBIGUOUS', 0, 0, repeated);
      source('SRC-NOT-FOUND', 10, 30, 'Câu này không có trong tài liệu.');

      textsBefore = versionTexts();
      applied = new DatabaseMigrator(memDb, allMigrations).runPendingMigrations().appliedVersions;
    });

    afterAll(() => {
      memDb.close();
    });

    it('is registered and applied by the real migrator after 015', () => {
      expect(applied).toEqual(['016']);
      expect(memDb.prepare(`SELECT name FROM schema_migrations WHERE version = '016'`).get()).toEqual({ name: 'document_sections' });
      expect(allMigrations[allMigrations.length - 1]).toBe(migration016DocumentSections);
    });

    it('creates the table with the columns of the task and a nullable knowledge_sources.section_id', () => {
      const columns = (memDb.prepare(`PRAGMA table_info('document_sections')`).all() as Array<{ name: string }>).map(c => c.name);
      expect(columns).toEqual(['id', 'document_version_id', 'heading_path', 'level', 'order_no', 'char_start', 'char_end', 'content_hash', 'stable_key']);

      const sectionId = (memDb.prepare(`PRAGMA table_info('knowledge_sources')`).all() as Array<{ name: string; notnull: number }>).find(c => c.name === 'section_id');
      expect(sectionId).toMatchObject({ notnull: 0 });
      // The offset columns are kept
      expect(memDb.prepare('SELECT char_offset_start, char_offset_end FROM knowledge_sources WHERE id = ?').get('SRC-OFFSETS-WRONG'))
        .toEqual({ char_offset_start: 3, char_offset_end: 3 + 'Mỗi giao dịch bắt buộc có mã đối soát.'.length });

      const indexes = (memDb.prepare(`PRAGMA index_list('document_sections')`).all() as Array<{ name: string; unique: number }>);
      const indexedColumns = indexes.map(i => ({
        unique: i.unique,
        columns: (memDb.prepare(`PRAGMA index_info('${i.name}')`).all() as Array<{ name: string }>).map(c => c.name).join(',')
      }));
      expect(indexedColumns).toContainEqual({ unique: 1, columns: 'document_version_id,stable_key' });
      expect(indexedColumns).toContainEqual({ unique: 1, columns: 'document_version_id,order_no' });
      expect(indexedColumns).toContainEqual({ unique: 0, columns: 'stable_key' });
    });

    it('is schema only: the migration writes no section and links no source', () => {
      expect(memDb.prepare('SELECT COUNT(*) AS n FROM document_sections').get()).toEqual({ n: 0 });
      expect(memDb.prepare('SELECT COUNT(*) AS n FROM knowledge_sources WHERE section_id IS NOT NULL').get()).toEqual({ n: 0 });
    });

    it('backfills sections for the versions that already exist, without touching their text', () => {
      firstRun = syncAllDocumentSections(memDb);
      expect(firstRun).toEqual({ versions: 5, rewrittenVersions: 3, linkedSources: 4, failedVersions: 0 });
      expect(versionTexts()).toEqual(textsBefore);

      const vi = sectionsOf('DOC-VI-v1.0');
      expectCoverage(VI_TEXT, vi);
      expect(vi.map(s => JSON.parse(s.headingPath))).toEqual([
        [], ['Đặc tả yêu cầu'], ['Đặc tả yêu cầu', 'Mục tiêu'], ['Đặc tả yêu cầu', 'Phạm vi'], ['Đặc tả yêu cầu', 'Quy tắc nghiệp vụ']
      ]);
      expect(vi.map(s => s.id)).toEqual(vi.map(s => `DOC-VI-v1.0#${s.stableKey}`));

      const plain = sectionsOf('DOC-PLAIN-v1.0');
      expectCoverage(PLAIN_TEXT, plain);
      expect(plain).toHaveLength(3);
      expect(plain.every(s => s.level === 0 && s.headingPath === '[]')).toBe(true);
    });

    it('writes no section for a version without text', () => {
      expect(sectionsOf('DOC-NOTEXT-v1.0')).toEqual([]);
      expect(sectionsOf('DOC-NOTEXT-v1.1')).toEqual([]);
    });

    it('links existing knowledge sources to their section and leaves the unresolvable ones NULL', () => {
      const idOf = (title: string) => `DOC-VI-v1.0#${stableKeyForHeadingPath(['Đặc tả yêu cầu', title])}`;
      expect(sectionIdOfSource('SRC-OFFSETS-OK')).toBe(idOf('Mục tiêu'));
      expect(sectionIdOfSource('SRC-OFFSETS-MISSING')).toBe(idOf('Quy tắc nghiệp vụ'));
      expect(sectionIdOfSource('SRC-OFFSETS-WRONG')).toBe(idOf('Quy tắc nghiệp vụ'));
      expect(sectionIdOfSource('SRC-REPEATED-SECOND')).toBe(idOf('Quy tắc nghiệp vụ'));
      expect(sectionIdOfSource('SRC-AMBIGUOUS')).toBeNull();
      expect(sectionIdOfSource('SRC-NOT-FOUND')).toBeNull();
    });

    it('leaves no foreign key violation', () => {
      expect(memDb.pragma('foreign_key_check')).toEqual([]);
    });

    it('changes nothing when run a second time', () => {
      const before = derivedRows();
      const changesBefore = totalChanges();

      expect(new DatabaseMigrator(memDb, allMigrations).runPendingMigrations().appliedVersions).toEqual([]);
      expect(syncAllDocumentSections(memDb)).toEqual({ versions: 5, rewrittenVersions: 0, linkedSources: 0, failedVersions: 0 });

      expect(totalChanges()).toBe(changesBefore);
      expect(derivedRows()).toEqual(before);
      expect(versionTexts()).toEqual(textsBefore);
    });

    it('maps the two versions that existed before the migration', () => {
      const oldSections = sectionsOf('DOC-VI-v1.0');
      const newSections = sectionsOf('DOC-VI-v1.1');
      expect(newSections.map(s => s.stableKey)).toEqual(oldSections.map(s => s.stableKey));
      const differing = oldSections.filter((s, i) => s.contentHash !== newSections[i].contentHash);
      expect(differing.map(s => JSON.parse(s.headingPath))).toEqual([['Đặc tả yêu cầu', 'Mục tiêu']]);
    });

    it('enforces unique keys and unique positions within a version', () => {
      const existing = sectionsOf('DOC-VI-v1.0')[1];
      const insert = memDb.prepare(`
        INSERT INTO document_sections (id, document_version_id, heading_path, level, order_no, char_start, char_end, content_hash, stable_key)
        VALUES (?, 'DOC-VI-v1.0', '[]', 0, ?, 0, 1, 'sha256:x', ?)
      `);
      expect(() => insert.run('dup-key', 99, existing.stableKey)).toThrow(/UNIQUE/);
      expect(() => insert.run('dup-order', existing.orderNo, 'other-key')).toThrow(/UNIQUE/);
      // The same key in another version is allowed: that is what makes versions comparable
      expect(sectionsOf('DOC-VI-v1.1').some(s => s.stableKey === existing.stableKey)).toBe(true);
    });

    it('repairs sections when a version text was changed behind the repository', () => {
      const newText = '# Chỉ còn một mục\nNội dung mới.\n';
      memDb.prepare('UPDATE document_versions SET extracted_content = ? WHERE id = ?').run(newText, 'DOC-PLAIN-v1.0');
      expect(sectionsOf('DOC-PLAIN-v1.0')).toHaveLength(3);

      expect(syncAllDocumentSections(memDb).rewrittenVersions).toBe(1);
      const repaired = sectionsOf('DOC-PLAIN-v1.0');
      expectCoverage(newText, repaired);
      expect(repaired.map(s => s.headingPath)).toEqual(['["Chỉ còn một mục"]']);
      expect(memDb.prepare('SELECT extracted_content FROM document_versions WHERE id = ?').get('DOC-PLAIN-v1.0')).toEqual({ extracted_content: newText });
    });

    it('re-links knowledge sources when the sections of their version are rewritten', () => {
      const moved = VI_TEXT.replace('## Mục tiêu', '## Mục đích');
      memDb.prepare('UPDATE document_versions SET extracted_content = ? WHERE id = ?').run(moved, 'DOC-VI-v1.0');
      expect(syncVersionSections(memDb, 'DOC-VI-v1.0')).toBe(true);
      expect(sectionIdOfSource('SRC-OFFSETS-OK')).toBe(`DOC-VI-v1.0#${stableKeyForHeadingPath(['Đặc tả yêu cầu', 'Mục đích'])}`);
      expect(memDb.pragma('foreign_key_check')).toEqual([]);
    });

    it('removes sections with their version and their document, and clears the link of a source whose section is deleted', () => {
      const linked = sectionIdOfSource('SRC-OFFSETS-MISSING')!;
      memDb.prepare('DELETE FROM document_sections WHERE id = ?').run(linked);
      expect(sectionIdOfSource('SRC-OFFSETS-MISSING')).toBeNull();

      expect(sectionsOf('DOC-VI-v1.1').length).toBeGreaterThan(0);
      memDb.prepare('DELETE FROM document_versions WHERE id = ?').run('DOC-VI-v1.1');
      expect(sectionsOf('DOC-VI-v1.1')).toEqual([]);

      expect(sectionsOf('DOC-PLAIN-v1.0').length).toBeGreaterThan(0);
      memDb.prepare('DELETE FROM documents WHERE id = ?').run('DOC-PLAIN');
      expect(memDb.prepare(`SELECT COUNT(*) AS n FROM document_sections WHERE document_version_id LIKE 'DOC-PLAIN%'`).get()).toEqual({ n: 0 });
      expect(memDb.pragma('foreign_key_check')).toEqual([]);
    });

    it('has a down step that removes the table and the column and leaves the rest intact', () => {
      const sourcesBefore = memDb.prepare('SELECT COUNT(*) AS n FROM knowledge_sources').get();
      migration016DocumentSections.down!(memDb);
      expect(memDb.prepare(`SELECT name FROM sqlite_master WHERE name = 'document_sections'`).get()).toBeUndefined();
      expect((memDb.prepare(`PRAGMA table_info('knowledge_sources')`).all() as Array<{ name: string }>).map(c => c.name)).not.toContain('section_id');
      expect(memDb.prepare('SELECT COUNT(*) AS n FROM knowledge_sources').get()).toEqual(sourcesBefore);
      expect(memDb.pragma('foreign_key_check')).toEqual([]);
    });
  });

  describe('Sections are written wherever a version text is written', () => {
    let server: http.Server;
    let baseUrl: string;

    const stamp = `${Date.now()}`;
    const projA = `PRJ-E11T3-A-${stamp}`;
    const projB = `PRJ-E11T3-B-${stamp}`;
    const user = { id: 'usr_e11t3', username: 'e11t3', name: 'E11-T3 User', role: 'PM / Project Lead' as const };
    const token = signUserSession({ id: user.id, username: user.username, name: user.name, role: user.role, projectId: projA });

    const sectionsOf = (versionId: string) => dbRepository.documentSections.getByVersionId(versionId);
    const textOfVersion = (versionId: string) => dbRepository.documentVersions.getById(versionId)!.extractedContent ?? '';
    const paths = (sections: DocumentSectionRecord[]) => sections.map(s => JSON.parse(s.headingPath) as string[]);

    const createDoc = async (title: string, content: string, projectId = projA) => {
      const res = await fetch(`${baseUrl}/api/v1/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, category: '01_Project_Overview', projectId, contentMarkdown: content })
      });
      expect(res.status).toBe(201);
      return (await res.json() as any).data as { id: string };
    };
    const addVersion = async (docId: string, content: string) => {
      const res = await fetch(`${baseUrl}/api/v1/documents/${docId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content })
      });
      expect(res.status).toBe(201);
    };
    const drainQueue = async () => {
      for (let i = 0; i < 40; i++) {
        if ((await defaultJobQueue.processNext(5)) === 0) break;
      }
    };

    // Minimal text PDF (uncompressed, Helvetica), enough for the real PdfParser to extract its lines
    const buildPdf = (pages: string[][]): Buffer => {
      const objects: string[] = [];
      objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
      objects[2] = `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`;
      objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
      pages.forEach((lines, i) => {
        const stream = `BT /F1 12 Tf 72 720 Td 16 TL ${lines.map(l => `(${l.replace(/[()\\]/g, '\\$&')}) Tj T*`).join(' ')} ET`;
        objects[4 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`;
        objects[5 + i * 2] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
      });
      let out = '%PDF-1.4\n';
      const offsets: number[] = [];
      for (let n = 1; n < objects.length; n++) {
        offsets[n] = out.length;
        out += `${n} 0 obj\n${objects[n]}\nendobj\n`;
      }
      const xref = out.length;
      out += `xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
      out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
      return Buffer.from(out, 'latin1');
    };
    const uploadFile = async (name: string, body: Buffer, type: string) => {
      const form = new FormData();
      form.append('projectId', projA);
      form.append('files', new Blob([body], { type }), name);
      const res = await fetch(`${baseUrl}/api/v1/documents/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      expect(res.status).toBeLessThan(300);
      return (await res.json() as any).data.documents[0] as { id: string };
    };

    it('a byte order mark does not hide the first heading, and does not break the mapping to a version without it', async () => {
      const body = '# Đặc tả thanh toán\n\n## Mục tiêu\nMô tả mục tiêu.\n\n## Phạm vi\nMô tả phạm vi.\n';
      const doc = await createDoc(`BOM ${stamp}`, `\uFEFF${body}`);
      await addVersion(doc.id, body);

      const withBom = sectionsOf(`${doc.id}-v1.0`);
      expect(textOfVersion(`${doc.id}-v1.0`).charCodeAt(0)).toBe(0xfeff); // the stored text is not altered
      expect(withBom[0].charStart).toBe(0);
      expect(paths(withBom)).toEqual([['Đặc tả thanh toán'], ['Đặc tả thanh toán', 'Mục tiêu'], ['Đặc tả thanh toán', 'Phạm vi']]);

      const mapping = dbRepository.documentSections.mapVersions(`${doc.id}-v1.0`, `${doc.id}-v1.1`);
      expect([mapping.unchanged.length, mapping.changed.length, mapping.onlyInOld.length, mapping.onlyInNew.length]).toEqual([3, 0, 0, 0]);
    });

    it('a "# " line inside an HTML comment or a <pre> block is not a heading', async () => {
      const control = '# Guide\n\n## Install\nRun the installer.\n\n## Usage\nOpen the app.\n';
      const withBlocks = '# Guide\n\n## Install\nRun the installer.\n\n<!--\n# TODO remove before release\n-->\n\n<pre>\n# apt-get install foo\n</pre>\n\n## Usage\nOpen the app.\n';
      const doc = await createDoc(`HTML blocks ${stamp}`, control);
      await addVersion(doc.id, withBlocks);

      expect(paths(sectionsOf(`${doc.id}-v1.1`))).toEqual([['Guide'], ['Guide', 'Install'], ['Guide', 'Usage']]);
      const mapping = dbRepository.documentSections.mapVersions(`${doc.id}-v1.0`, `${doc.id}-v1.1`);
      // Only the section that received the two blocks has new content; no key was lost or invented
      expect([mapping.unchanged.length, mapping.changed.length, mapping.onlyInOld.length, mapping.onlyInNew.length]).toEqual([2, 1, 0, 0]);
      expect(mapping.changed[0].stableKey).toBe(sectionsOf(`${doc.id}-v1.0`)[1].stableKey);
    });

    it('a PDF is split on paragraphs only, because its "#" lines are guessed by the parser', async () => {
      const pageOne = ['SERVICE HANDBOOK', '1. Customer sends a request.', '2. Staff logs the request.', 'Plain paragraph text here.'];
      const pageTwo = ['SERVICE HANDBOOK', '2.1 Priority codes', 'Codes are A, B and C.'];
      const original = await uploadFile(`handbook-${stamp}.pdf`, buildPdf([pageOne, pageTwo]), 'application/pdf');
      const withCover = await uploadFile(`handbook-cover-${stamp}.pdf`, buildPdf([['Cover page of the handbook'], pageOne, pageTwo]), 'application/pdf');

      const text = textOfVersion(`${original.id}-v1.0`);
      // The parser did turn list items and the running header into "#" lines: that is what must not be trusted
      expect(text).toContain('# 1. Customer sends a request.');
      expect(text).toContain('## SERVICE HANDBOOK');

      const sections = sectionsOf(`${original.id}-v1.0`);
      expect(sections.length).toBeGreaterThan(1);
      expect(sections.every(s => s.level === 0 && s.headingPath === '[]' && s.stableKey.startsWith('p-'))).toBe(true);

      // Adding a cover page: no section is reported as changed. What differs is the cover and the page markers
      const coverText = textOfVersion(`${withCover.id}-v1.0`);
      const mapping = mapSections(sections, sectionsOf(`${withCover.id}-v1.0`));
      expect(mapping.changed).toEqual([]);
      expect(mapping.unchanged).toHaveLength(2);
      expect(mapping.onlyInOld.map(s => text.slice(s.charStart, s.charEnd).trim())).toEqual(['-- 1 of 2 --', '-- 2 of 2 --']);
      expect(mapping.onlyInNew.map(s => coverText.slice(s.charStart, s.charEnd).trim())).toEqual(
        ['Cover page of the handbook', '-- 1 of 3 --', '-- 2 of 3 --', '-- 3 of 3 --']
      );
    });

    beforeAll(async () => {
      registerPipelineHandlers();
      await new Promise<void>((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
          const addr = server.address() as net.AddressInfo;
          baseUrl = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });

      const now = new Date().toISOString();
      db.prepare(`INSERT OR REPLACE INTO users (id, username, password_hash, password_salt, name, role, must_change_password, created_at) VALUES (?, ?, 'h', 's', ?, ?, 0, ?)`)
        .run(user.id, user.username, user.name, user.role, now);
      for (const pid of [projA, projB]) {
        db.prepare(`
          INSERT OR REPLACE INTO projects (id, name, key, description, version, author, members_count, ai_policy, data, created_at, updated_at)
          VALUES (?, ?, ?, 'E11-T3 test project', 'v1.0.0', 'Admin', 1, 'OFFLINE_ONLY', '{}', ?, ?)
        `).run(pid, pid, pid.replace(/-/g, ''), now, now);
        db.prepare(`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)`)
          .run(`pm_${pid}_${user.id}`, pid, user.id, user.role, now);
      }
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('POST /documents writes the sections of a Vietnamese document', async () => {
      const created = await createDoc('E11-T3 tài liệu tiếng Việt', VI_TEXT);
      const versionId = `${created.id}-v1.0`;
      const text = textOfVersion(versionId);
      expect(text).toBe(VI_TEXT);

      const sections = sectionsOf(versionId);
      expectCoverage(text, sections);
      expect(paths(sections)).toEqual([
        [], ['Đặc tả yêu cầu'], ['Đặc tả yêu cầu', 'Mục tiêu'], ['Đặc tả yêu cầu', 'Phạm vi'], ['Đặc tả yêu cầu', 'Quy tắc nghiệp vụ']
      ]);
      expect(text.slice(sections[2].charStart, sections[2].charEnd)).toBe('## Mục tiêu\nHệ thống phải xử lý hoàn tiền trong vòng 3 ngày làm việc.\n\n');
    });

    it('POST /documents/upload writes paragraph sections for a file without headings', async () => {
      const text = `${PLAIN_TEXT}\n\nĐoạn riêng của lần chạy ${stamp}.`;
      const form = new FormData();
      form.append('projectId', projA);
      form.append('files', new Blob([text], { type: 'text/markdown' }), `e11t3-plain-${stamp}.md`);
      const res = await fetch(`${baseUrl}/api/v1/documents/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      expect(res.status).toBeLessThan(300);
      const doc = (await res.json() as any).data.documents[0];

      const version = dbRepository.documentVersions.getByDocumentId(doc.id)[0];
      expect(version.extractedContent).toBe(text);
      const sections = sectionsOf(version.id);
      expectCoverage(text, sections);
      expect(sections).toHaveLength(4);
      expect(sections.every(s => s.level === 0 && s.headingPath === '[]')).toBe(true);
    });

    it('POST /documents/:id/versions writes sections that map to the previous version when sections were reordered and edited', async () => {
      const head = '# Đặc tả\n\n';
      const goal = '## Mục tiêu\nHoàn tiền trong 3 ngày.\n\n';
      const scope = '## Phạm vi\nKhách hàng doanh nghiệp.\n\n';
      const rules = '## Quy tắc nghiệp vụ\nBắt buộc có mã đối soát.\n\n';
      const removed = '## Phụ lục\nSẽ bị xóa.\n\n';
      const added = '## Bảo mật\nMã hóa dữ liệu khi lưu.\n\n';

      const created = await createDoc('E11-T3 hai phiên bản', head + goal + scope + rules + removed);
      // v1.1: "Quy tắc nghiệp vụ" moved to the front, "Phạm vi" edited, "Phụ lục" removed, "Bảo mật" added
      await addVersion(created.id, head + rules + goal + scope.replace('doanh nghiệp', 'cá nhân') + added);

      const versions = dbRepository.documentVersions.getByDocumentId(created.id);
      expect(versions.map(v => v.versionNo)).toEqual(['v1.0', 'v1.1']);
      const [oldVersion, newVersion] = versions;
      expectCoverage(oldVersion.extractedContent!, sectionsOf(oldVersion.id));
      expectCoverage(newVersion.extractedContent!, sectionsOf(newVersion.id));

      const mapping = dbRepository.documentSections.mapVersions(oldVersion.id, newVersion.id);
      const titles = (list: DocumentSectionRecord[]) => list.map(s => (JSON.parse(s.headingPath) as string[]).join(' > '));

      expect(titles(mapping.unchanged.map(p => p.old))).toEqual(['Đặc tả', 'Đặc tả > Mục tiêu', 'Đặc tả > Quy tắc nghiệp vụ']);
      expect(titles(mapping.changed.map(p => p.old))).toEqual(['Đặc tả > Phạm vi']);
      expect(titles(mapping.onlyInOld)).toEqual(['Đặc tả > Phụ lục']);
      expect(titles(mapping.onlyInNew)).toEqual(['Đặc tả > Bảo mật']);

      // Reordered: same key, another position and other offsets
      const rulesPair = mapping.unchanged.find(p => p.stableKey === stableKeyForHeadingPath(['Đặc tả', 'Quy tắc nghiệp vụ']))!;
      expect(rulesPair.old.orderNo).toBe(3);
      expect(rulesPair.new.orderNo).toBe(1);
      expect(rulesPair.old.id).not.toBe(rulesPair.new.id);
      // Changed: same key, different hash
      expect(mapping.changed[0].old.contentHash).not.toBe(mapping.changed[0].new.contentHash);
    });

    it('refuses to map versions of different documents or a version that does not exist', async () => {
      const a = await createDoc('E11-T3 map A', '# A\nx');
      const b = await createDoc('E11-T3 map B', '# A\nx');
      expect(() => dbRepository.documentSections.mapVersions(`${a.id}-v1.0`, `${b.id}-v1.0`)).toThrow(/same document/);
      expect(() => dbRepository.documentSections.mapVersions(`${a.id}-v1.0`, 'no-such-version')).toThrow(/not found/);
    });

    it('rewriting a version is idempotent, and a changed text replaces the sections', async () => {
      const created = await createDoc('E11-T3 idempotent', '# Một\nmột\n# Hai\nhai\n');
      const versionId = `${created.id}-v1.0`;
      const record = dbRepository.documentVersions.getById(versionId)!;
      const before = sectionsOf(versionId);
      expect(before).toHaveLength(2);

      dbRepository.documentVersions.upsert(record);
      dbRepository.documentVersions.upsert(record);
      expect(sectionsOf(versionId)).toEqual(before);
      expect(dbRepository.documentSections.syncVersion(versionId)).toBe(false);

      dbRepository.documentVersions.upsert({ ...record, extractedContent: '# Một\nmột\n# Ba\nba\n# Bốn\n' });
      const after = sectionsOf(versionId);
      expectCoverage('# Một\nmột\n# Ba\nba\n# Bốn\n', after);
      expect(paths(after)).toEqual([['Một'], ['Ba'], ['Bốn']]);
      expect(after[0]).toEqual(before[0]);

      dbRepository.documentVersions.upsert({ ...record, extractedContent: '' });
      expect(sectionsOf(versionId)).toEqual([]);
      dbRepository.documentVersions.upsert({ ...record, extractedContent: null });
      expect(sectionsOf(versionId)).toEqual([]);
    });

    it('rolls the sections back with the version when the surrounding transaction fails', async () => {
      const created = await createDoc('E11-T3 rollback', '# Giữ nguyên\nnội dung\n');
      const versionId = `${created.id}-v1.0`;
      const record = dbRepository.documentVersions.getById(versionId)!;
      const before = sectionsOf(versionId);

      expect(() => db.transaction(() => {
        dbRepository.documentVersions.upsert({ ...record, extractedContent: '# Khác hẳn\n' });
        expect(paths(sectionsOf(versionId))).toEqual([['Khác hẳn']]);
        throw new Error('abort');
      })()).toThrow('abort');

      expect(textOfVersion(versionId)).toBe('# Giữ nguyên\nnội dung\n');
      expect(sectionsOf(versionId)).toEqual(before);
    });

    it('the start-up sync of stored files writes sections for the version it creates', () => {
      const docId = `DOC-E11T3-SYNC-${stamp}`;
      db.prepare(`INSERT INTO documents (id, project_id, category, status, data, updated_at) VALUES (?, ?, '01_Project_Overview', 'Draft', ?, ?)`)
        .run(docId, projA, JSON.stringify({ id: docId, projectId: projA, title: 'Sync', category: '01_Project_Overview', currentVersion: 'v1.0', status: 'Draft', versions: [] }), new Date().toISOString());
      expect(dbRepository.documentVersions.getByDocumentId(docId)).toEqual([]);

      ensureStoredFilesSynced();

      const [version] = dbRepository.documentVersions.getByDocumentId(docId);
      expect(version.extractedContent).toBeTruthy();
      const sections = sectionsOf(version.id);
      expect(sections.length).toBeGreaterThan(0);
      expectCoverage(version.extractedContent!, sections);
    });

    it('after the start-up step every version with text in the database has sections that cover it', () => {
      // Other test files insert versions with plain SQL into this database; the start-up step is what covers them
      syncAllDocumentSections(db);
      const versions = db.prepare(`SELECT id, extracted_content FROM document_versions`).all() as Array<{ id: string; extracted_content: string | null }>;
      expect(versions.length).toBeGreaterThan(0);
      for (const v of versions) {
        const sections = sectionsOf(v.id);
        if (!v.extracted_content) {
          expect(sections).toEqual([]);
        } else {
          expectCoverage(v.extracted_content, sections);
        }
      }
      expect(db.pragma('foreign_key_check')).toEqual([]);
    });

    it('the pipeline links each knowledge source to the section that holds its quote', async () => {
      const created = await createDoc('E11-T3 pipeline', VI_TEXT);
      const versionId = `${created.id}-v1.0`;
      await drainQueue();

      const sections = sectionsOf(versionId);
      const sources = db.prepare(`
        SELECT id, section_id as sectionId, exact_quote as exactQuote, char_offset_start as charStart, char_offset_end as charEnd
        FROM knowledge_sources WHERE document_version_id = ? ORDER BY char_offset_start
      `).all(versionId) as Array<{ id: string; sectionId: string | null; exactQuote: string; charStart: number; charEnd: number }>;
      expect(sources.length).toBeGreaterThanOrEqual(2);

      // The fallback extractor cuts sentences on punctuation, so a quote can start at the heading line of its section
      const sectionPathOf = (quoteStart: string) => {
        const source = sources.find(s => s.exactQuote.includes(quoteStart));
        expect(source, `source starting with "${quoteStart}"`).toBeDefined();
        const section = sections.find(s => s.id === source!.sectionId);
        expect(section, `section of "${quoteStart}"`).toBeDefined();
        // The quote really lies inside the section it is linked to
        expect(VI_TEXT.slice(section!.charStart, section!.charEnd)).toContain(source!.exactQuote);
        return JSON.parse(section!.headingPath) as string[];
      };
      expect(sectionPathOf('Hệ thống phải xử lý hoàn tiền')).toEqual(['Đặc tả yêu cầu', 'Mục tiêu']);
      expect(sectionPathOf('Áp dụng cho khách hàng doanh nghiệp')).toEqual(['Đặc tả yêu cầu', 'Phạm vi']);
      expect(sectionPathOf('Mỗi giao dịch bắt buộc có mã đối soát')).toEqual(['Đặc tả yêu cầu', 'Quy tắc nghiệp vụ']);
      expect(sources.every(s => s.sectionId !== null)).toBe(true);

      // The repository returns the link
      const unit = dbRepository.knowledgeUnits.getByDocumentVersion(versionId)[0];
      expect(unit.sources[0].sectionId).toBe(sources.find(s => s.id === unit.sources[0].id)!.sectionId);
    });

    it('the pipeline writes missing sections before linking, for a version that was written without them', async () => {
      const created = await createDoc('E11-T3 pipeline without sections', '# Quy định\nNgười dùng phải đổi mật khẩu sau 90 ngày.\n');
      const versionId = `${created.id}-v1.0`;
      db.prepare('DELETE FROM document_sections WHERE document_version_id = ?').run(versionId);
      expect(sectionsOf(versionId)).toEqual([]);

      await drainQueue();

      const sections = sectionsOf(versionId);
      expect(paths(sections)).toEqual([['Quy định']]);
      const sources = db.prepare('SELECT section_id FROM knowledge_sources WHERE document_version_id = ?').all(versionId) as Array<{ section_id: string | null }>;
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every(s => s.section_id === sections[0].id)).toBe(true);
    });

    it('DELETE /documents/:id removes the sections of every version', async () => {
      const created = await createDoc('E11-T3 delete', '# Một\nmột\n');
      await addVersion(created.id, '# Một\nmột\n# Hai\nhai\n');
      const countSections = () => (db.prepare(`
        SELECT COUNT(*) AS n FROM document_sections WHERE document_version_id IN (?, ?)
      `).get(`${created.id}-v1.0`, `${created.id}-v1.1`) as { n: number }).n;
      expect(dbRepository.documentVersions.getByDocumentId(created.id).map(v => v.id)).toEqual([`${created.id}-v1.0`, `${created.id}-v1.1`]);
      expect(countSections()).toBe(3);

      const res = await fetch(`${baseUrl}/api/v1/documents/${created.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      expect(res.status).toBe(200);
      expect(countSections()).toBe(0);
      expect(db.pragma('foreign_key_check')).toEqual([]);
    });

    it('deleting a project removes the sections of its documents and leaves other projects alone', async () => {
      const inB = await createDoc('E11-T3 project B', '# B một\nnội dung\n# B hai\nnội dung\n', projB);
      const inA = await createDoc('E11-T3 project A stays', '# A một\nnội dung\n');
      await drainQueue();
      expect(sectionsOf(`${inB.id}-v1.0`)).toHaveLength(2);

      await RetentionService.cascadeDeleteProject(db, projB, 'E11-T3 test');

      expect(sectionsOf(`${inB.id}-v1.0`)).toEqual([]);
      expect(db.prepare(`SELECT COUNT(*) AS n FROM document_sections WHERE document_version_id LIKE ?`).get(`${inB.id}-%`)).toEqual({ n: 0 });
      expect(sectionsOf(`${inA.id}-v1.0`)).toHaveLength(1);
      expect(db.pragma('foreign_key_check')).toEqual([]);
    });
  });
});
