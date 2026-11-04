import type Database from 'better-sqlite3';
import { Migration } from '../migrator.js';

export const migration011CleanProjectsAndEnforceOfflinePolicy: Migration = {
  version: '011',
  name: 'clean_projects_and_enforce_offline_policy',
  up: (db: Database.Database) => {
    // 1. Clean up dangling projects_new table left over from previous migration attempts (R3-01)
    db.exec('DROP TABLE IF EXISTS projects_new;');

    // 2. Ensure all projects have OFFLINE_ONLY policy by default and sanitize baseline projects (BUG-002, R3-01, R3-03)
    db.exec(`
      UPDATE projects
      SET ai_policy = 'OFFLINE_ONLY',
          data = json_set(coalesce(data, '{}'), '$.aiPolicy', 'OFFLINE_ONLY')
      WHERE ai_policy IS NULL OR ai_policy NOT IN ('OFFLINE_ONLY', 'COMMERCIAL_PRIVATE', 'ALLOW_EXTERNAL') OR id IN ('PRJ-01', 'PRJ-02');
    `);

    // 3. Backfill projectId into test_cases data JSON from linked requirement (R3-12)
    try {
      db.exec(`
        UPDATE test_cases
        SET data = json_set(
          data,
          '$.projectId',
          coalesce(
            (SELECT r.project_id FROM requirements r WHERE r.id = test_cases.requirement_id),
            'PRJ-01'
          )
        )
        WHERE json_extract(data, '$.projectId') IS NULL;
      `);
    } catch (err: any) {
      console.warn('[Migration 011] Notice backfilling test_cases projectId:', err.message);
    }

    // 4. Backfill projectId into bugs data JSON from linked requirement or test case (R3-12)
    try {
      db.exec(`
        UPDATE bugs
        SET data = json_set(
          data,
          '$.projectId',
          coalesce(
            json_extract(data, '$.projectId'),
            (SELECT r.project_id FROM requirements r WHERE r.id = json_extract(bugs.data, '$.requirementId')),
            'PRJ-01'
          )
        )
        WHERE json_extract(data, '$.projectId') IS NULL;
      `);
    } catch (err: any) {
      console.warn('[Migration 011] Notice backfilling bugs projectId:', err.message);
    }

    // 5. Backfill projectId into test_runs data JSON (R3-12)
    try {
      db.exec(`
        UPDATE test_runs
        SET data = json_set(
          data,
          '$.projectId',
          coalesce(json_extract(data, '$.projectId'), 'PRJ-01')
        )
        WHERE json_extract(data, '$.projectId') IS NULL;
      `);
    } catch (err: any) {
      console.warn('[Migration 011] Notice backfilling test_runs projectId:', err.message);
    }
  }
};
