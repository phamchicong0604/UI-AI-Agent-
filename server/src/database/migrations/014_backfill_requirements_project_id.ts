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
    // project_id references projects(id) and foreign keys are enforced, so every candidate is only used when
    // that project still exists. A requirement whose project cannot be resolved stays NULL: the routes deny
    // access to it (fail-closed) until an administrator assigns it. Assigning a missing project would make
    // this migration fail and stop the server at start-up.
    const orphanIds = (db.prepare('SELECT id FROM requirements WHERE project_id IS NULL').all() as Array<{ id: string }>).map(r => r.id);
    db.exec(`
      UPDATE requirements
      SET project_id = coalesce(
        (SELECT p.id FROM projects p WHERE p.id = json_extract(requirements.data, '$.projectId')),
        (SELECT d.project_id FROM documents d JOIN projects p ON p.id = d.project_id
          WHERE d.id = json_extract(requirements.data, '$.sourceReferences[0].documentId')),
        (SELECT p.id FROM projects p WHERE p.id = 'PRJ-01')
      )
      WHERE project_id IS NULL;
    `);
    // Keep the JSON payload in line with the column for the rows this migration assigned
    const syncJson = db.prepare(`UPDATE requirements SET data = json_set(data, '$.projectId', project_id) WHERE id = ? AND project_id IS NOT NULL`);
    for (const id of orphanIds) syncJson.run(id);
    // Rows that already had a project but no projectId in the payload get the payload filled in as well
    db.exec(`
      UPDATE requirements
      SET data = json_set(data, '$.projectId', project_id)
      WHERE project_id IS NOT NULL AND json_extract(data, '$.projectId') IS NULL;
    `);
  },
  down: (_db: Database.Database) => {
    // Reversal not required for additive security data backfill
  }
};
