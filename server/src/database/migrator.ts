import type Database from 'better-sqlite3';
import { computeSha256 } from '../common/crypto.js';

export interface Migration {
  version: string; // e.g. '001', '002'
  name: string;    // e.g. '001_initial_schema'
  up: (db: Database.Database) => void;
  down?: (db: Database.Database) => void;
}

export interface AppliedMigration {
  id: number;
  version: string;
  name: string;
  applied_at: string;
  checksum: string;
}

export class DatabaseMigrator {
  constructor(
    private db: Database.Database,
    private migrations: Migration[] = []
  ) {}

  /**
   * Initializes the schema_migrations tracking table if it doesn't already exist.
   */
  public initMigrationTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL,
        checksum TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations (version);
    `);
  }

  /**
   * Retrieves list of all applied migration versions.
   */
  public getAppliedMigrations(): AppliedMigration[] {
    this.initMigrationTable();
    return this.db
      .prepare('SELECT id, version, name, applied_at, checksum FROM schema_migrations ORDER BY version ASC')
      .all() as AppliedMigration[];
  }

  /**
   * Executes all pending migrations sequentially inside isolated transactions.
   * If any migration fails, it rolls back and aborts further migrations.
   */
  public runPendingMigrations(): { appliedCount: number; appliedVersions: string[] } {
    this.initMigrationTable();

    const appliedList = this.getAppliedMigrations();
    const appliedMap = new Map(appliedList.map(m => [m.version, m]));
    const sorted = [...this.migrations].sort((a, b) => a.version.localeCompare(b.version));

    const appliedVersions: string[] = [];

    for (const migration of sorted) {
      const existing = appliedMap.get(migration.version);
      const normalizedCode = migration.up.toString()
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
        .replace(/\s+/g, ' ')
        .replace(/["']/g, '"')
        .trim();
      const rawChecksum = `sha256:${computeSha256(`${migration.version}|${migration.name}|${migration.up.toString()}`)}`;
      const checksum = `sha256:${computeSha256(`${migration.version}|${migration.name}|${normalizedCode}`)}`;

      if (existing) {
        // BUG-033, R2-11: Compare migration checksum against recorded hash with AST/transpilation normalization
        if (existing.checksum && existing.checksum !== checksum && existing.checksum !== rawChecksum) {
          console.warn(
            `[DatabaseMigrator] WARNING: Migration ${migration.version} (${migration.name}) checksum mismatch!\n` +
            `  Recorded: ${existing.checksum}\n` +
            `  Current:  ${checksum}`
          );
        }
        continue;
      }

      const timestamp = new Date().toISOString();

      console.log(`[DatabaseMigrator] Applying migration: ${migration.version} - ${migration.name}...`);

      const executeMigration = this.db.transaction(() => {
        // Re-check inside transaction to avoid race conditions with multiple worker connections
        const alreadyDone = this.db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(migration.version);
        if (alreadyDone) {
          return;
        }

        migration.up(this.db);
        this.db.prepare(`
          INSERT OR IGNORE INTO schema_migrations (version, name, applied_at, checksum)
          VALUES (?, ?, ?, ?)
        `).run(migration.version, migration.name, timestamp, checksum);
        appliedVersions.push(migration.version);
      });

      try {
        executeMigration.immediate();
        console.log(`[DatabaseMigrator] Migration ${migration.version} processed.`);
      } catch (err: any) {
        console.error(`[DatabaseMigrator] Migration ${migration.version} failed:`, err);
        throw new Error(`Migration ${migration.version} (${migration.name}) failed: ${err.message}`);
      }
    }

    return {
      appliedCount: appliedVersions.length,
      appliedVersions
    };
  }
}
