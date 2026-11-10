import type Database from 'better-sqlite3';
import { Migration } from '../migrator.js';

export const migration014BackfillRequirementsProjectId: Migration = {
  version: '014',
  name: 'backfill_requirements_project_id',
  up: (db: Database.Database) => {
    // Backfill project_id for requirements left NULL by migrations 010/013 and by baseline seed data (R7-02).
    // Same resolution order as migration 013: JSON payload, then parent entity (source document), then 'PRJ-01'.
    const reqCols = db.prepare('PRAGMA table_info(requirements)').all() as Array<{ name: string }>;
    if (!reqCols.some(c => c.name === 'project_id')) {
      db.exec(`
        ALTER TABLE requirements ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_requirements_project_id ON requirements (project_id);
      `);
    }
    db.exec(`
      UPDATE requirements
      SET project_id = coalesce(
        json_extract(data, '$.projectId'),
        (SELECT d.project_id FROM documents d WHERE d.id = json_extract(requirements.data, '$.sourceReferences[0].documentId')),
        'PRJ-01'
      )
      WHERE project_id IS NULL;

      UPDATE requirements
      SET data = json_set(data, '$.projectId', project_id)
      WHERE json_extract(data, '$.projectId') IS NULL;
    `);
  },
  down: (_db: Database.Database) => {
    // Reversal not required for additive security data backfill
  }
};
