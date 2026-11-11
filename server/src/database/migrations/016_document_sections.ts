import type Database from 'better-sqlite3';
import { Migration } from '../migrator.js';

export const migration016DocumentSections: Migration = {
  version: '016',
  name: 'document_sections',
  up: (db: Database.Database) => {
    // E11-T3: sections of a document version, and a link from a knowledge source to its section.
    // Schema only. Rows for the versions that already exist are written by the idempotent start-up step
    // syncAllDocumentSections (database/documentSectionStore.ts), which also runs after every later change
    // of the sectioning rules; this migration therefore stays frozen and never reads document text.
    db.exec(`
      CREATE TABLE IF NOT EXISTS document_sections (
        id TEXT PRIMARY KEY,
        document_version_id TEXT NOT NULL,
        heading_path TEXT NOT NULL,
        level INTEGER NOT NULL,
        order_no INTEGER NOT NULL,
        char_start INTEGER NOT NULL,
        char_end INTEGER NOT NULL,
        content_hash TEXT NOT NULL,
        stable_key TEXT NOT NULL,
        FOREIGN KEY (document_version_id) REFERENCES document_versions(id) ON DELETE CASCADE,
        UNIQUE (document_version_id, stable_key),
        UNIQUE (document_version_id, order_no),
        CHECK (char_start >= 0 AND char_end > char_start)
      );
      CREATE INDEX IF NOT EXISTS idx_document_sections_stable_key ON document_sections (stable_key);
    `);

    const columns = db.prepare(`PRAGMA table_info('knowledge_sources')`).all() as Array<{ name: string }>;
    if (!columns.some(c => c.name === 'section_id')) {
      db.exec(`ALTER TABLE knowledge_sources ADD COLUMN section_id TEXT REFERENCES document_sections(id) ON DELETE SET NULL`);
    }
    db.exec(`CREATE INDEX IF NOT EXISTS idx_ks_section ON knowledge_sources (section_id)`);
  },
  down: (db: Database.Database) => {
    // Sections are derived data: dropping them loses nothing that cannot be rebuilt from extracted_content
    db.exec(`
      DROP INDEX IF EXISTS idx_ks_section;
      ALTER TABLE knowledge_sources DROP COLUMN section_id;
      DROP INDEX IF EXISTS idx_document_sections_stable_key;
      DROP TABLE IF EXISTS document_sections;
    `);
  }
};
