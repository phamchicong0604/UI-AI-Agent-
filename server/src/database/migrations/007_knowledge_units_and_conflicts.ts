import { Database } from 'better-sqlite3';
import { Migration } from '../migrator.js';

export const migration007KnowledgeUnitsAndConflicts: Migration = {
  version: '007',
  name: 'knowledge_units_and_conflicts',
  up: (db: Database) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_units (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        unit_type TEXT NOT NULL CHECK(unit_type IN ('Requirement', 'BusinessRule', 'Constraint', 'Definition')),
        content TEXT NOT NULL,
        subject TEXT NOT NULL,
        action TEXT NOT NULL,
        condition TEXT,
        evidence_level TEXT NOT NULL CHECK(evidence_level IN ('Explicit', 'Inferred', 'Assumed', 'Not Specified', 'Conflict', 'Unknown')),
        status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft', 'In Review', 'Approved', 'Rejected', 'Superseded', 'Deprecated')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_ku_project ON knowledge_units (project_id);
      CREATE INDEX IF NOT EXISTS idx_ku_status ON knowledge_units (status);

      CREATE TABLE IF NOT EXISTS knowledge_sources (
        id TEXT PRIMARY KEY,
        unit_id TEXT NOT NULL,
        document_version_id TEXT NOT NULL,
        heading_path TEXT NOT NULL,
        char_offset_start INTEGER NOT NULL,
        char_offset_end INTEGER NOT NULL,
        page_number INTEGER,
        exact_quote TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (unit_id) REFERENCES knowledge_units(id) ON DELETE CASCADE,
        FOREIGN KEY (document_version_id) REFERENCES document_versions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_ks_unit ON knowledge_sources (unit_id);
      CREATE INDEX IF NOT EXISTS idx_ks_doc_ver ON knowledge_sources (document_version_id);

      CREATE TABLE IF NOT EXISTS conflicts (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        unit_a_id TEXT NOT NULL,
        unit_b_id TEXT NOT NULL,
        conflict_type TEXT NOT NULL CHECK(conflict_type IN ('Contradiction', 'Ambiguity', 'Redundancy')),
        severity TEXT NOT NULL CHECK(severity IN ('Critical', 'Major', 'Minor')),
        description TEXT NOT NULL,
        resolution TEXT NOT NULL DEFAULT 'UNRESOLVED' CHECK(resolution IN ('KEEP_NEW_SUPERSEDE_OLD', 'REJECT_NEW_PRESERVE_OLD', 'MERGE_SPECIFICATION', 'UNRESOLVED')),
        resolved_by TEXT,
        resolved_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (unit_a_id) REFERENCES knowledge_units(id) ON DELETE CASCADE,
        FOREIGN KEY (unit_b_id) REFERENCES knowledge_units(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_conflicts_project ON conflicts (project_id);
      CREATE INDEX IF NOT EXISTS idx_conflicts_severity ON conflicts (severity, resolution);
    `);
  },
  down: (db: Database) => {
    db.exec(`
      DROP TABLE IF EXISTS conflicts;
      DROP TABLE IF EXISTS knowledge_sources;
      DROP TABLE IF EXISTS knowledge_units;
    `);
  }
};
