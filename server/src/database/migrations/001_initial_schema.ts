import type Database from 'better-sqlite3';
import { Migration } from '../migrator.js';

export const migration001InitialSchema: Migration = {
  version: '001',
  name: 'initial_schema',
  up: (db: Database.Database) => {
    // 1. Create baseline entities
    db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        project_id TEXT DEFAULT 'PRJ-01',
        category TEXT,
        status TEXT,
        data TEXT NOT NULL,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS requirements (
        id TEXT PRIMARY KEY,
        type TEXT,
        priority TEXT,
        status TEXT,
        data TEXT NOT NULL,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS evidence (
        id TEXT PRIMARY KEY,
        type TEXT,
        environment TEXT,
        status TEXT,
        data TEXT NOT NULL,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS test_cases (
        id TEXT PRIMARY KEY,
        requirement_id TEXT,
        status TEXT,
        type TEXT,
        priority TEXT,
        data TEXT NOT NULL,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS test_runs (
        id TEXT PRIMARY KEY,
        status TEXT,
        environment TEXT,
        data TEXT NOT NULL,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS bugs (
        id TEXT PRIMARY KEY,
        status TEXT,
        severity TEXT,
        priority TEXT,
        data TEXT NOT NULL,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        event_hash TEXT NOT NULL,
        previous_event_hash TEXT,
        timestamp TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS ai_connections (
        id TEXT PRIMARY KEY DEFAULT 'primary',
        provider TEXT NOT NULL DEFAULT 'google',
        auth_method TEXT NOT NULL DEFAULT 'api_key',
        api_key TEXT,
        base_url TEXT,
        model TEXT NOT NULL DEFAULT 'gemini-4-argon-medium',
        base_model TEXT,
        effort_level TEXT DEFAULT 'medium',
        max_output_tokens INTEGER DEFAULT 32768,
        cli_binary TEXT DEFAULT 'claude',
        cli_version TEXT,
        cli_auth_status TEXT,
        connection_status TEXT NOT NULL DEFAULT 'disconnected',
        last_tested_at TEXT,
        latency_ms INTEGER,
        error_message TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ai_models (
        provider TEXT NOT NULL,
        auth_method TEXT NOT NULL,
        source TEXT NOT NULL,
        model_id TEXT NOT NULL,
        account TEXT,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        data TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        PRIMARY KEY (provider, auth_method, source, model_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ai_models_lookup ON ai_models (provider, auth_method, source);

      CREATE TABLE IF NOT EXISTS ai_model_efforts (
        provider TEXT NOT NULL,
        model_id TEXT NOT NULL,
        effort_level TEXT NOT NULL DEFAULT 'medium',
        max_output_tokens INTEGER DEFAULT 32768,
        resolved_variant TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (provider, model_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ai_model_efforts_lookup ON ai_model_efforts (provider, model_id);

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        key TEXT NOT NULL,
        description TEXT,
        version TEXT DEFAULT 'v1.0',
        author TEXT,
        members_count INTEGER DEFAULT 1,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_projects_key ON projects (key);
    `);

    // 2. Safely verify and backport columns for existing DBs
    const docCols = (db.prepare("PRAGMA table_info(documents)").all() as any[]).map(c => c.name);
    if (!docCols.includes('project_id')) {
      db.exec("ALTER TABLE documents ADD COLUMN project_id TEXT DEFAULT 'PRJ-01'");
    }
    db.exec("CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents (project_id)");

    const aiCols = (db.prepare("PRAGMA table_info(ai_connections)").all() as any[]).map(c => c.name);
    if (!aiCols.includes('effort_level')) {
      db.exec("ALTER TABLE ai_connections ADD COLUMN effort_level TEXT DEFAULT 'medium'");
    }
    if (!aiCols.includes('max_output_tokens')) {
      db.exec("ALTER TABLE ai_connections ADD COLUMN max_output_tokens INTEGER DEFAULT 32768");
    }
    if (!aiCols.includes('base_model')) {
      db.exec("ALTER TABLE ai_connections ADD COLUMN base_model TEXT");
    }
  }
};
