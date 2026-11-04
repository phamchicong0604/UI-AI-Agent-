import type Database from 'better-sqlite3';
import { Migration } from '../migrator.js';

export const migration013BackfillProjectIdsAndTokenVersion: Migration = {
  version: '013',
  name: 'backfill_project_ids_and_token_version',
  up: (db: Database.Database) => {
    // 1. Add password_changed_at and token_version columns to users table (R6-08)
    const userCols = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    if (!userCols.some(c => c.name === 'password_changed_at')) {
      db.exec('ALTER TABLE users ADD COLUMN password_changed_at INTEGER DEFAULT 0;');
    }
    if (!userCols.some(c => c.name === 'token_version')) {
      db.exec('ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 1;');
    }

    // 2. Add project_id and backfill for test_cases table first so test_runs can reference it (R6-03)
    const tcCols = db.prepare('PRAGMA table_info(test_cases)').all() as Array<{ name: string }>;
    if (!tcCols.some(c => c.name === 'project_id')) {
      db.exec(`
        ALTER TABLE test_cases ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_test_cases_project_id ON test_cases (project_id);
      `);
    }
    db.exec(`
      UPDATE test_cases
      SET project_id = coalesce(
        json_extract(data, '$.projectId'),
        (SELECT r.project_id FROM requirements r WHERE r.id = test_cases.requirement_id),
        'PRJ-01'
      )
      WHERE project_id IS NULL;

      UPDATE test_cases
      SET data = json_set(data, '$.projectId', project_id)
      WHERE json_extract(data, '$.projectId') IS NULL;
    `);

    // 3. Add project_id and backfill for evidence table (R6-03)
    const evdCols = db.prepare('PRAGMA table_info(evidence)').all() as Array<{ name: string }>;
    if (!evdCols.some(c => c.name === 'project_id')) {
      db.exec(`
        ALTER TABLE evidence ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_evidence_project_id ON evidence (project_id);
      `);
    }
    db.exec(`
      UPDATE evidence
      SET project_id = coalesce(
        json_extract(data, '$.projectId'),
        (SELECT r.project_id FROM requirements r WHERE r.id = json_extract(evidence.data, '$.links[0].targetId')),
        'PRJ-01'
      )
      WHERE project_id IS NULL;

      UPDATE evidence
      SET data = json_set(data, '$.projectId', project_id)
      WHERE json_extract(data, '$.projectId') IS NULL;
    `);

    // 4. Add project_id and backfill for test_runs table (R6-03)
    const runCols = db.prepare('PRAGMA table_info(test_runs)').all() as Array<{ name: string }>;
    if (!runCols.some(c => c.name === 'project_id')) {
      db.exec(`
        ALTER TABLE test_runs ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_test_runs_project_id ON test_runs (project_id);
      `);
    }
    db.exec(`
      UPDATE test_runs
      SET project_id = coalesce(
        json_extract(data, '$.projectId'),
        (SELECT tc.project_id FROM test_cases tc WHERE tc.id = json_extract(test_runs.data, '$.records[0].testCaseId')),
        'PRJ-01'
      )
      WHERE project_id IS NULL;

      UPDATE test_runs
      SET data = json_set(data, '$.projectId', project_id)
      WHERE json_extract(data, '$.projectId') IS NULL;
    `);

    // 5. Add project_id and backfill for bugs table (R6-03)
    const bugCols = db.prepare('PRAGMA table_info(bugs)').all() as Array<{ name: string }>;
    if (!bugCols.some(c => c.name === 'project_id')) {
      db.exec(`
        ALTER TABLE bugs ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_bugs_project_id ON bugs (project_id);
      `);
    }
    db.exec(`
      UPDATE bugs
      SET project_id = coalesce(
        json_extract(data, '$.projectId'),
        (SELECT r.project_id FROM requirements r WHERE r.id = json_extract(bugs.data, '$.linkedRequirementId')),
        'PRJ-01'
      )
      WHERE project_id IS NULL;

      UPDATE bugs
      SET data = json_set(data, '$.projectId', project_id)
      WHERE json_extract(data, '$.projectId') IS NULL;
    `);
  },
  down: (_db: Database.Database) => {
    // Reversal not required for additive security schema migrations
  }
};
