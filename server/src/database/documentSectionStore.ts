import type Database from 'better-sqlite3';
import { DocumentSectionRecord } from '../common/types.js';
import {
  SectionMapping,
  SectionSplitOptions,
  SourceAnchor,
  findSectionForAnchor,
  mapSections,
  splitIntoSections
} from '../modules/documents/documentSections.js';

/**
 * E11-T3: storage of document_sections. Every function takes the database handle, so the same code serves
 * the application database and a database built in a test.
 *
 * The sections of a version are always derived from document_versions.extracted_content as it is stored;
 * nothing here ever writes that column.
 */

const SECTION_COLUMNS = `
  id, document_version_id as documentVersionId, heading_path as headingPath, level, order_no as orderNo,
  char_start as charStart, char_end as charEnd, content_hash as contentHash, stable_key as stableKey
`;

/** Deterministic, so that rewriting unchanged sections keeps their ids */
export function documentSectionId(documentVersionId: string, stableKey: string): string {
  return `${documentVersionId}#${stableKey}`;
}

export function listVersionSections(db: Database.Database, documentVersionId: string): DocumentSectionRecord[] {
  return db.prepare(`
    SELECT ${SECTION_COLUMNS} FROM document_sections WHERE document_version_id = ? ORDER BY order_no
  `).all(documentVersionId) as DocumentSectionRecord[];
}

function versionText(db: Database.Database, documentVersionId: string): string | null | undefined {
  const row = db.prepare('SELECT extracted_content FROM document_versions WHERE id = ?').get(documentVersionId) as
    { extracted_content: string | null } | undefined;
  return row ? row.extracted_content : undefined;
}

/**
 * How the text of a version is split. The PDF parser guesses headings (numbered list items and upper-case
 * lines become "#" lines), so for a version whose stored file is a PDF only paragraphs are used.
 */
export function splitOptionsForVersion(db: Database.Database, documentVersionId: string): SectionSplitOptions {
  const row = db.prepare(`
    SELECT sf.original_name AS originalName, sf.mime_type AS mimeType
    FROM document_versions dv JOIN stored_files sf ON sf.id = dv.file_id
    WHERE dv.id = ?
  `).get(documentVersionId) as { originalName: string | null; mimeType: string | null } | undefined;
  const isPdf = !!row && (/\.pdf$/i.test(row.originalName ?? '') || row.mimeType === 'application/pdf');
  return isPdf ? { headings: false } : {};
}

/**
 * Set knowledge_sources.section_id for the sources of one version. With `onlyMissing` the sources that
 * already point to a section are left alone. Returns the number of rows changed.
 */
function linkVersionSources(db: Database.Database, documentVersionId: string, text: string, sections: DocumentSectionRecord[], onlyMissing: boolean): number {
  const sources = db.prepare(`
    SELECT id, section_id as sectionId, char_offset_start as charStart, char_offset_end as charEnd, exact_quote as exactQuote
    FROM knowledge_sources
    WHERE document_version_id = ? ${onlyMissing ? 'AND section_id IS NULL' : ''}
  `).all(documentVersionId) as Array<{ id: string; sectionId: string | null } & SourceAnchor>;

  const update = db.prepare('UPDATE knowledge_sources SET section_id = ? WHERE id = ?');
  let changed = 0;
  for (const source of sources) {
    const sectionId = findSectionForAnchor(text, sections, source)?.id ?? null;
    if (sectionId !== source.sectionId) {
      update.run(sectionId, source.id);
      changed++;
    }
  }
  return changed;
}

/**
 * Make the stored sections of a version equal to the sections of its stored text.
 * Idempotent: when they are already equal nothing is written and false is returned.
 * When the sections are rewritten, the knowledge sources of the version are pointed at the new sections.
 */
export function syncVersionSections(db: Database.Database, documentVersionId: string): boolean {
  return rewriteVersionSections(db, documentVersionId).rewritten;
}

function rewriteVersionSections(db: Database.Database, documentVersionId: string): { rewritten: boolean; linkedSources: number } {
  return db.transaction(() => {
    const text = versionText(db, documentVersionId);
    if (text === undefined) return { rewritten: false, linkedSources: 0 };

    const wanted: DocumentSectionRecord[] = splitIntoSections(text, splitOptionsForVersion(db, documentVersionId)).map(s => ({
      id: documentSectionId(documentVersionId, s.stableKey),
      documentVersionId,
      headingPath: JSON.stringify(s.headingPath),
      level: s.level,
      orderNo: s.orderNo,
      charStart: s.charStart,
      charEnd: s.charEnd,
      contentHash: s.contentHash,
      stableKey: s.stableKey
    }));
    const stored = listVersionSections(db, documentVersionId);

    const same = stored.length === wanted.length && stored.every((row, i) => {
      const w = wanted[i];
      return row.id === w.id && row.headingPath === w.headingPath && row.level === w.level && row.orderNo === w.orderNo &&
        row.charStart === w.charStart && row.charEnd === w.charEnd && row.contentHash === w.contentHash && row.stableKey === w.stableKey;
    });
    if (same) return { rewritten: false, linkedSources: 0 };

    // knowledge_sources.section_id of the deleted rows becomes NULL (ON DELETE SET NULL) and is set again below
    db.prepare('DELETE FROM document_sections WHERE document_version_id = ?').run(documentVersionId);
    const insert = db.prepare(`
      INSERT INTO document_sections (id, document_version_id, heading_path, level, order_no, char_start, char_end, content_hash, stable_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const s of wanted) {
      insert.run(s.id, s.documentVersionId, s.headingPath, s.level, s.orderNo, s.charStart, s.charEnd, s.contentHash, s.stableKey);
    }
    return { rewritten: true, linkedSources: linkVersionSources(db, documentVersionId, text ?? '', wanted, false) };
  })();
}

/**
 * Returns a function that gives the section id for an anchor in this version, or null when no section
 * can be determined. The version's text and sections are read once.
 */
export function sectionResolverForVersion(db: Database.Database, documentVersionId: string): (anchor: SourceAnchor) => string | null {
  const text = versionText(db, documentVersionId) ?? '';
  const sections = listVersionSections(db, documentVersionId);
  return anchor => findSectionForAnchor(text, sections, anchor)?.id ?? null;
}

/**
 * Map the sections of two versions of the same document by stable_key.
 * Throws when a version does not exist or the two versions belong to different documents.
 */
export function mapVersionSections(db: Database.Database, oldVersionId: string, newVersionId: string): SectionMapping<DocumentSectionRecord> {
  const documentOf = (versionId: string) => {
    const row = db.prepare('SELECT document_id FROM document_versions WHERE id = ?').get(versionId) as { document_id: string } | undefined;
    if (!row) throw new Error(`Document version not found: ${versionId}`);
    return row.document_id;
  };
  if (documentOf(oldVersionId) !== documentOf(newVersionId)) {
    throw new Error('Sections can only be mapped between versions of the same document');
  }
  return mapSections(listVersionSections(db, oldVersionId), listVersionSections(db, newVersionId));
}

export interface SectionSyncResult {
  versions: number;
  rewrittenVersions: number;
  linkedSources: number;
  failedVersions: number;
}

/**
 * Idempotent start-up step and backfill: every version gets the sections of its stored text, and every
 * knowledge source without a section gets one when it can be determined. A second run changes nothing.
 * A version that fails is logged and skipped so that one bad row cannot stop the server from starting.
 */
export function syncAllDocumentSections(db: Database.Database): SectionSyncResult {
  const result: SectionSyncResult = { versions: 0, rewrittenVersions: 0, linkedSources: 0, failedVersions: 0 };

  const versionIds = db.prepare('SELECT id FROM document_versions ORDER BY id').all() as Array<{ id: string }>;
  for (const { id } of versionIds) {
    result.versions++;
    try {
      const outcome = rewriteVersionSections(db, id);
      if (outcome.rewritten) result.rewrittenVersions++;
      result.linkedSources += outcome.linkedSources;
    } catch (err: any) {
      result.failedVersions++;
      console.error(`[DocumentSections] Could not write the sections of version ${id}: ${err?.message}`);
    }
  }

  const unlinked = db.prepare(`
    SELECT DISTINCT document_version_id as id FROM knowledge_sources WHERE section_id IS NULL ORDER BY document_version_id
  `).all() as Array<{ id: string }>;
  for (const { id } of unlinked) {
    try {
      result.linkedSources += db.transaction(() =>
        linkVersionSources(db, id, versionText(db, id) ?? '', listVersionSections(db, id), true)
      )();
    } catch (err: any) {
      console.error(`[DocumentSections] Could not link the knowledge sources of version ${id}: ${err?.message}`);
    }
  }

  if (result.rewrittenVersions > 0 || result.linkedSources > 0 || result.failedVersions > 0) {
    console.log(
      `[DocumentSections] ${result.versions} versions checked, ${result.rewrittenVersions} had their sections written, ` +
      `${result.linkedSources} knowledge sources linked to a section, ${result.failedVersions} versions failed.`
    );
  }
  return result;
}
