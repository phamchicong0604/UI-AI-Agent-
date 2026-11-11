import type Database from 'better-sqlite3';
import { Migration } from '../migrator.js';

// Same ordering rule as compareVersionNumbers in db.ts, copied so this migration does not change when app code does.
function compareVersionNo(v1: string, v2: string): number {
  const parts = (v: string) => (v || '').replace(/^[^\d]*/, '').split(/[.-]/).map(p => parseInt(p, 10) || 0);
  const p1 = parts(v1);
  const p2 = parts(v2);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const diff = (p1[i] ?? 0) - (p2[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return (v1 || '').localeCompare(v2 || '');
}

export const migration015MoveLegacyContentToVersions: Migration = {
  version: '015',
  name: 'move_legacy_content_to_versions',
  up: (db: Database.Database) => {
    // E11-T1: document_versions.extracted_content is the only place document text is kept.
    // Older rows also carry a copy in documents.data ($.contentMarkdown). For each of them:
    //   1. make sure a version of the document holds that text (create or fill one when needed),
    //   2. re-read the versions and remove the copy only when one of them holds exactly the same text,
    //   3. otherwise keep the text in documents.data under $.legacyContentMarkdown, so nothing is lost
    //      and a person can decide what to do with it.
    // Runs inside the migrator's transaction. Only the database is touched, never the file store.
    const rows = db.prepare(`
      SELECT id, data FROM documents
      WHERE json_valid(data) AND json_type(data, '$.contentMarkdown') IS NOT NULL
    `).all() as Array<{ id: string; data: string }>;

    const selectVersions = db.prepare('SELECT id, version_no, extracted_content FROM document_versions WHERE document_id = ?');
    const insertVersion = db.prepare(`
      INSERT OR IGNORE INTO document_versions (id, document_id, version_no, file_id, extracted_content, status, change_summary, created_by, created_at)
      VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)
    `);
    const fillVersion = db.prepare('UPDATE document_versions SET extracted_content = ? WHERE id = ?');
    const versionHoldsText = db.prepare('SELECT 1 FROM document_versions WHERE document_id = ? AND extracted_content = ? LIMIT 1');
    const removeLegacy = db.prepare(`UPDATE documents SET data = json_remove(data, '$.contentMarkdown') WHERE id = ?`);
    const keepLegacy = db.prepare(`
      UPDATE documents SET data = json_set(json_remove(data, '$.contentMarkdown'), '$.legacyContentMarkdown', ?) WHERE id = ?
    `);

    // The version the reader shows: the current one, else the highest version number
    const shownVersion = <T extends { version_no: string }>(versions: T[], currentVersion: unknown): T =>
      versions.find(v => v.version_no === currentVersion)
      || [...versions].sort((a, b) => compareVersionNo(a.version_no, b.version_no))[versions.length - 1];

    let moved = 0;
    let kept = 0;
    // Moved documents whose shown version still has no text: the text exists, but only in another version,
    // so the reader shows nothing for them. Counted so that a person can look at them.
    let shownWithoutText = 0;
    for (const row of rows) {
      const doc = JSON.parse(row.data);
      const legacy: unknown = doc.contentMarkdown;

      if (legacy === null) {
        removeLegacy.run(row.id);
        continue;
      }
      if (typeof legacy !== 'string') {
        // Not text: leave the row exactly as it is
        kept++;
        continue;
      }

      const versions = selectVersions.all(row.id) as Array<{ id: string; version_no: string; extracted_content: string | null }>;
      if (versions.length === 0) {
        const versionNo = typeof doc.currentVersion === 'string' && doc.currentVersion ? doc.currentVersion : 'v1.0';
        insertVersion.run(
          `${row.id}-${versionNo.replace(/[^a-zA-Z0-9]/g, '_')}`,
          row.id,
          versionNo,
          legacy,
          doc.status || 'Draft',
          'Legacy content moved from the document record',
          doc.author || 'System',
          doc.updatedAt || new Date().toISOString()
        );
      } else if (!versions.some(v => v.extracted_content === legacy)) {
        const target = shownVersion(versions, doc.currentVersion);
        if (!target.extracted_content) {
          fillVersion.run(legacy, target.id);
        }
      }

      if (versionHoldsText.get(row.id, legacy)) {
        removeLegacy.run(row.id);
        moved++;
        const after = selectVersions.all(row.id) as Array<{ id: string; version_no: string; extracted_content: string | null }>;
        if (legacy !== '' && !shownVersion(after, doc.currentVersion).extracted_content) {
          shownWithoutText++;
        }
      } else if (doc.legacyContentMarkdown === undefined) {
        keepLegacy.run(legacy, row.id);
        kept++;
      } else {
        kept++;
      }
    }

    if (rows.length > 0) {
      console.log(
        `[Migration 015] Legacy document content: ${moved} moved to versions, ${kept} kept for manual review. ` +
        `Of the moved, ${shownWithoutText} have a current version without text (their text is in another version).`
      );
    }
  },
  down: (_db: Database.Database) => {
    // Not reversible: the text now lives in document_versions only
  }
};
