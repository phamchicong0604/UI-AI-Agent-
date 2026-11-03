import { Database } from 'better-sqlite3';
import { Migration } from '../migrator.js';

export const migration004UploadBatches: Migration = {
  version: '004',
  name: 'upload_batches',
  up: (db: Database) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS upload_batches (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        total_files INTEGER NOT NULL DEFAULT 0,
        processed_files INTEGER NOT NULL DEFAULT 0,
        failed_files INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL CHECK(status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED')),
        error_summary TEXT,
        batch_details TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_upload_batches_project ON upload_batches (project_id);
      CREATE INDEX IF NOT EXISTS idx_upload_batches_status ON upload_batches (status);
    `);
  },
  down: (db: Database) => {
    db.exec(`
      DROP TABLE IF EXISTS upload_batches;
    `);
  }
};
