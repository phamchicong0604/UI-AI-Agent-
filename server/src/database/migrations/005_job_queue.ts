import { Database } from 'better-sqlite3';
import { Migration } from '../migrator.js';

export const migration005JobQueue: Migration = {
  version: '005',
  name: 'job_queue_and_workflow',
  up: (db: Database) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        locked_by TEXT,
        locked_at TEXT,
        next_run_at TEXT NOT NULL,
        last_error TEXT,
        result TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_jobs_poll ON jobs (status, next_run_at);
      CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs (type);

      -- Add workflow status to document_versions if missing
      -- Note: document_versions already has status column from 002
    `);
  },
  down: (db: Database) => {
    db.exec(`
      DROP TABLE IF EXISTS jobs;
    `);
  }
};
