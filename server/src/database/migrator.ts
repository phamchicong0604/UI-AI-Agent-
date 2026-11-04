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

const KNOWN_HISTORICAL_CHECKSUMS: Record<string, string[]> = {
  '001': [
    'sha256:6c8943425dc19a6ce280bcdb904b60a0f7dff5696ea444df0cca4c4fe28ba1fb',
    'sha256:b5d7db88b335b84168b3c20ef4ff65ac0a0902a385975b0b1fe7bf0e9a86210f'
  ],
  '002': [
    'sha256:6b86f44c4a564f682ea33883f90a7cee8aa5af029477df921449a4b9586a73f9',
    'sha256:c2419284931d4c7adbfd2ec376ca3715ce6d2780fcc9b95372194dc90b7d4a61',
    'sha256:d8c28108a7b9736c342fe305ca70678d1235b2e3e527f4d54645229cfb6fa911',
    'sha256:9be10ec763d3bfbbff7841c964177c3a07c1bf2ce1a7112028680786cf7c7c34',
    'sha256:9d45366ba9aee0e50efcf84407ea3778a876356976694380eb9a279c0915f019'
  ],
  '003': [
    'sha256:70bf20e841e369976045b6fb4d2f0c373787dc7670239c6dd4b45baeefa2c2d8',
    'sha256:a81663d5830778e5e9bf8880d86f28112cecf103c50e4619cf7189fa7d2725b1'
  ],
  '004': [
    'sha256:43424c9b11f408b987fd1a20275e6b414482a4bd241b7b647da2635370c1521c',
    'sha256:8c50e4d3891099bcec6f9d60414413596e439e25ca5825425556292491509710'
  ],
  '005': [
    'sha256:7c5756cc90e7baeca78aec9b0a6ae33dd0b079ce05a692b8cfb8014e45daa577',
    'sha256:974b707f227a85afe7474a64c42b07c78de581f4e8633e925b3839aad71f0b32'
  ],
  '006': [
    'sha256:c702b375e87602f3062dface3d6a9ba0d7be745e0bc0ae4b3978cd7b8b67c998',
    'sha256:3edd5232086b06189fdbbac1a1aa37ae9b5000a0af04e2c80cb2af2ca8e5b7e6'
  ],
  '007': [
    'sha256:4e0b0f3a70f2246dfa64dc5309f65a39a2cdd1895cff26ca34e1ab5d2aaf4ceb',
    'sha256:df2415f1f3dc3fab3bdd3273c360948eee1bdfdf39ffccb63f034674bc5fe6c3',
    'sha256:13c84c22ac199c13f26eb0f795bf09e55dbaf4d1f2413286bc2e108bdf257e89'
  ],
  '008': [
    'sha256:a7962fef5e52d62959ed0474b498afc1cd51c790b68787abb223d90e57499a3d',
    'sha256:6d8a89c88f742317df0afbaed49c04601b3cec3e5c268301ca08215d83418424',
    'sha256:cd560e6620e9fc0b79c46c69d3ae55def640981849d7697628d2107d8eb306b3'
  ],
  '009': [
    'sha256:6614a87e7d12dd66b2ee7c62a0b0b7328685ba6663bdab5c250b1bb45c56a12e',
    'sha256:a8e43bb2fcde9b8fe60a8eb20580f8b0aef0d4e9ba8bc84843a050707b96cb63'
  ],
  '010': [
    'sha256:7bc5211915359b8be5f5d83d6cb2cbe819234b655da63836d9d1ae7421ce80f6',
    'sha256:ad5c05295c556b6b72a6b252062f68a8ad32b678c182d4dbbb80b2a8d5781a79',
    'sha256:e13e52ef872ae08064b6e99d15b0e656b78bfb503bbaa8f9eb910832fdf8868e',
    'sha256:1bf8abc66de17fb5e42e8e5ef09a2299ed0a58f213536a470764c749a944168e'
  ],
  '011': [
    'sha256:b2f589cbfe60d8776fa03fe7ceb81d53dfcb05f162a4c1ec8a269a6c522072fb',
    'sha256:9c55c9ad027777d4881b0cb1c8a76d4c7cdb9194f50750560b203a38443ec82d'
  ]
};

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
        // BUG-033, R2-11: Compare migration checksum against recorded hash with AST/transpilation normalization and historical whitelist
        const knownList = KNOWN_HISTORICAL_CHECKSUMS[migration.version] || [];
        const isKnownHistorical = knownList.includes(existing.checksum) || existing.checksum === checksum || existing.checksum === rawChecksum;
        if (existing.checksum && !isKnownHistorical) {
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
