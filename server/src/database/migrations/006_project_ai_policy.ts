import { Database } from 'better-sqlite3';
import { Migration } from '../migrator.js';

export const migration006ProjectAiPolicy: Migration = {
  version: '006',
  name: 'project_ai_policy',
  up: (db: Database) => {
    // Add ai_policy column to projects if it does not exist
    const columns = db.prepare('PRAGMA table_info(projects)').all() as { name: string }[];
    const hasAiPolicy = columns.some(c => c.name === 'ai_policy');

    if (!hasAiPolicy) {
      db.exec(`
        ALTER TABLE projects ADD COLUMN ai_policy TEXT NOT NULL DEFAULT 'ALLOW_EXTERNAL'
        CHECK(ai_policy IN ('OFFLINE_ONLY', 'COMMERCIAL_PRIVATE', 'ALLOW_EXTERNAL'));
      `);
    }

    // Update PRJ-01 and PRJ-02 baseline projects
    try {
      db.exec(`UPDATE projects SET ai_policy = 'ALLOW_EXTERNAL' WHERE ai_policy IS NULL OR ai_policy = ''`);
    } catch {}
  },
  down: (db: Database) => {
    // SQLite alter table drop column supported in modern SQLite, but table rebuild is safer if needed
  }
};
