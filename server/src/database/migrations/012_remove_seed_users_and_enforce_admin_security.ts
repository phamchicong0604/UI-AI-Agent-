import type Database from 'better-sqlite3';
import crypto from 'crypto';
import { Migration } from '../migrator.js';

function computePbkdf2Hash(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

export const migration012RemoveSeedUsersAndEnforceAdminSecurity: Migration = {
  version: '012',
  name: 'remove_seed_users_and_enforce_admin_security',
  up: (db: Database.Database) => {
    // 1. Add must_change_password column to users table if missing (R4-15, Condition 4)
    const userColumns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    if (!userColumns.some(c => c.name === 'must_change_password')) {
      db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0;');
    }

    // 2. Renumber any pre-existing duplicate document_versions to preserve all data and files without loss (R4-10, R5-03)
    try {
      const dupes = db.prepare(`
        SELECT document_id, version_no, count(*) as count
        FROM document_versions
        GROUP BY document_id, version_no
        HAVING count > 1
      `).all() as Array<{ document_id: string; version_no: string }>;

      for (const d of dupes) {
        const records = db.prepare(`
          SELECT id, version_no FROM document_versions
          WHERE document_id = ? AND version_no = ?
          ORDER BY created_at ASC, id ASC
        `).all(d.document_id, d.version_no) as Array<{ id: string; version_no: string }>;

        // Keep the original record unchanged, suffix duplicates with -dup1, -dup2...
        // This ensures zero data loss: no rows deleted, no orphaned files, no broken references
        for (let i = 1; i < records.length; i++) {
          const newVersionNo = `${records[i].version_no}-dup${i}`;
          db.prepare('UPDATE document_versions SET version_no = ? WHERE id = ?').run(newVersionNo, records[i].id);
        }
      }
    } catch {}

    // Add unique constraint on document_versions (document_id, version_no) (R4-10)
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_versions_doc_ver ON document_versions (document_id, version_no);
    `);

    // 3. Purge weak/obsolete demo seed accounts (Condition 4, R4-15)
    db.prepare("DELETE FROM project_members WHERE user_id IN ('usr_pm', 'usr_ba', 'usr_dev', 'usr_qa', 'usr_reviewer', 'usr_ducpham')").run();
    db.prepare("DELETE FROM users WHERE id IN ('usr_pm', 'usr_ba', 'usr_dev', 'usr_qa', 'usr_reviewer', 'usr_ducpham')").run();

    // 4. Secure admin account (R5-01, Condition 4):
    // R5-01: NEVER reset password of an existing admin user on existing databases!
    const adminUser = db.prepare("SELECT id, password_hash, password_salt, must_change_password FROM users WHERE username = 'admin'").get() as any;
    const now = new Date().toISOString();

    if (adminUser) {
      // If admin already exists and INITIAL_ADMIN_PASSWORD environment variable is explicitly provided, update it;
      // otherwise, preserve the existing password intact! (Fixes R5-01 blocker)
      if (process.env.INITIAL_ADMIN_PASSWORD) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = computePbkdf2Hash(process.env.INITIAL_ADMIN_PASSWORD, salt);
        db.prepare(`
          UPDATE users
          SET password_hash = ?, password_salt = ?, must_change_password = 1
          WHERE id = ?
        `).run(hash, salt, adminUser.id);
      } else {
        // Leave password untouched. If admin still has seed password 'admin123', enforce must_change_password = 1
        const seedHash = computePbkdf2Hash('admin123', adminUser.password_salt);
        if (adminUser.password_hash === seedHash || adminUser.must_change_password === null || adminUser.must_change_password === undefined) {
          db.prepare('UPDATE users SET must_change_password = 1 WHERE id = ?').run(adminUser.id);
        }
      }
    } else {
      // Fresh database without admin user: create initial admin from env var, or test fallback
      const initialAdminPass = process.env.INITIAL_ADMIN_PASSWORD ||
        (process.env.NODE_ENV === 'test' || process.env.VITEST ? 'admin123' : crypto.randomBytes(16).toString('hex'));
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = computePbkdf2Hash(initialAdminPass, salt);
      db.prepare(`
        INSERT INTO users (id, username, password_hash, password_salt, name, role, must_change_password, created_at)
        VALUES ('usr_admin', 'admin', ?, ?, 'System Admin', 'Project Admin', 1, ?)
      `).run(hash, salt, now);

      db.prepare(`
        INSERT OR IGNORE INTO project_members (id, project_id, user_id, role, created_at)
        VALUES ('pm_PRJ-01_usr_admin', 'PRJ-01', 'usr_admin', 'Project Admin', ?)
      `).run(now);
    }
  },
  down: (db: Database.Database) => {
    // Reversal is not required for security migrations
  }
};
