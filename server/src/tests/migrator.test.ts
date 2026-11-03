import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { DatabaseMigrator, Migration } from '../database/migrator.js';
import { migration001InitialSchema } from '../database/migrations/001_initial_schema.js';

describe('DatabaseMigrator (E1-T1)', () => {
  it('should initialize schema_migrations and apply migration on empty database', () => {
    const memDb = new Database(':memory:');
    const migrator = new DatabaseMigrator(memDb, [migration001InitialSchema]);

    const result = migrator.runPendingMigrations();
    expect(result.appliedCount).toBe(1);
    expect(result.appliedVersions).toEqual(['001']);

    // Check table exists
    const tables = memDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    const names = tables.map(t => t.name);

    expect(names).toContain('schema_migrations');
    expect(names).toContain('documents');
    expect(names).toContain('requirements');
    expect(names).toContain('projects');
    expect(names).toContain('ai_connections');

    // Check applied records
    const applied = migrator.getAppliedMigrations();
    expect(applied.length).toBe(1);
    expect(applied[0].version).toBe('001');
    expect(applied[0].name).toBe('initial_schema');
    expect(applied[0].checksum.startsWith('sha256:')).toBe(true);

    memDb.close();
  });

  it('should not re-apply already applied migrations (idempotent)', () => {
    const memDb = new Database(':memory:');
    const migrator = new DatabaseMigrator(memDb, [migration001InitialSchema]);

    // First run
    const res1 = migrator.runPendingMigrations();
    expect(res1.appliedCount).toBe(1);

    // Second run
    const res2 = migrator.runPendingMigrations();
    expect(res2.appliedCount).toBe(0);
    expect(res2.appliedVersions).toEqual([]);

    memDb.close();
  });

  it('should support legacy database migration and safely add missing columns', () => {
    const memDb = new Database(':memory:');

    // Simulate old legacy database without project_id in documents
    memDb.exec(`
      CREATE TABLE documents (
        id TEXT PRIMARY KEY,
        category TEXT,
        status TEXT,
        data TEXT NOT NULL,
        updated_at TEXT
      );
      CREATE TABLE ai_connections (
        id TEXT PRIMARY KEY DEFAULT 'primary',
        provider TEXT NOT NULL,
        auth_method TEXT NOT NULL,
        model TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    const colsBefore = (memDb.prepare("PRAGMA table_info(documents)").all() as any[]).map(c => c.name);
    expect(colsBefore).not.toContain('project_id');

    // Run migration 001
    const migrator = new DatabaseMigrator(memDb, [migration001InitialSchema]);
    migrator.runPendingMigrations();

    const colsAfter = (memDb.prepare("PRAGMA table_info(documents)").all() as any[]).map(c => c.name);
    expect(colsAfter).toContain('project_id');

    const aiColsAfter = (memDb.prepare("PRAGMA table_info(ai_connections)").all() as any[]).map(c => c.name);
    expect(aiColsAfter).toContain('effort_level');
    expect(aiColsAfter).toContain('max_output_tokens');
    expect(aiColsAfter).toContain('base_model');

    memDb.close();
  });

  it('should rollback transaction and abort if a migration fails', () => {
    const memDb = new Database(':memory:');

    const failingMigration: Migration = {
      version: '999',
      name: 'broken_migration',
      up: (db) => {
        db.exec("CREATE TABLE temporary_should_be_rolled_back (id INT);");
        // Intentional SQL syntax error to cause failure
        db.exec("INVALID SQL SYNTAX HERE;");
      }
    };

    const migrator = new DatabaseMigrator(memDb, [migration001InitialSchema, failingMigration]);

    expect(() => {
      migrator.runPendingMigrations();
    }).toThrow(/Migration 999 \(broken_migration\) failed/);

    // Check that temporary table from failed migration was rolled back
    const tables = memDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    const names = tables.map(t => t.name);

    expect(names).not.toContain('temporary_should_be_rolled_back');

    // Check schema_migrations does not have version 999
    const applied = migrator.getAppliedMigrations();
    expect(applied.map(a => a.version)).not.toContain('999');

    memDb.close();
  });
});
