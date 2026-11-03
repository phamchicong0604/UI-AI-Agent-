import { Database } from 'better-sqlite3';
import { Migration } from '../migrator.js';

export const migration009EnforceOfflinePolicyDefault: Migration = {
  version: '009',
  name: 'enforce_offline_policy_default',
  up: (db: Database) => {
    // 1. Fail-closed: Ensure all existing null/empty project policies default to OFFLINE_ONLY (BUG-002)
    db.exec(`UPDATE projects SET ai_policy = 'OFFLINE_ONLY' WHERE ai_policy IS NULL OR ai_policy = ''`);

    // 2. Add resolution_notes column to conflicts table if missing (BUG-027)
    const conflictCols = db.prepare('PRAGMA table_info(conflicts)').all() as Array<{ name: string }>;
    if (!conflictCols.some(c => c.name === 'resolution_notes')) {
      db.exec('ALTER TABLE conflicts ADD COLUMN resolution_notes TEXT;');
    }
  }
};
