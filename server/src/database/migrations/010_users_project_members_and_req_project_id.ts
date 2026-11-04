import type Database from 'better-sqlite3';
import crypto from 'crypto';
import { Migration } from '../migrator.js';

function computePbkdf2Hash(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

export const migration010UsersProjectMembersAndReqProjectId: Migration = {
  version: '010',
  name: 'users_project_members_and_req_project_id',
  up: (db: Database.Database) => {
    // 1. Create users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

      CREATE TABLE IF NOT EXISTS project_members (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(project_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_proj_members_proj_user ON project_members (project_id, user_id);
    `);

    // 2. Seed initial enterprise users
    const now = new Date().toISOString();
    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password_hash, password_salt, name, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMember = db.prepare(`
      INSERT OR IGNORE INTO project_members (id, project_id, user_id, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const defaultUsers = [
      { id: 'usr_admin', username: 'admin', name: 'Alex Nguyen', role: 'Project Admin', pass: 'admin123' },
      { id: 'usr_pm', username: 'pm', name: 'Sarah Chen', role: 'PM / Project Lead', pass: 'pm123' },
      { id: 'usr_ba', username: 'ba', name: 'Senior BA', role: 'BA', pass: 'ba123' },
      { id: 'usr_dev', username: 'dev', name: 'David Kim', role: 'Tech Lead / DEV', pass: 'dev123' },
      { id: 'usr_qa', username: 'qa', name: 'QA Engineer', role: 'QA', pass: 'qa123' },
      { id: 'usr_reviewer', username: 'reviewer', name: 'Lead QA / Reviewer', role: 'Reviewer / Approver', pass: 'reviewer123' },
      { id: 'usr_ducpham', username: 'ducpham', name: 'Duc Pham', role: 'Project Admin', pass: 'ducpham123' }
    ];

    // Ensure baseline projects exist so foreign key constraint in project_members is satisfied
    for (const prjId of ['PRJ-01', 'PRJ-02']) {
      const projName = prjId === 'PRJ-01' ? 'DocQA Platform' : 'Mobile Banking App';
      const projKey = prjId.replace('-', '');
      const projData = JSON.stringify({
        id: prjId,
        name: projName,
        key: projKey,
        description: 'Baseline enterprise project',
        version: 'v1.0.0',
        author: 'Alex Nguyen',
        membersCount: 1,
        aiPolicy: 'ALLOW_EXTERNAL',
        createdAt: now,
        updatedAt: now
      });

      db.prepare(`
        INSERT OR IGNORE INTO projects (id, name, key, description, version, author, members_count, ai_policy, data, created_at, updated_at)
        VALUES (?, ?, ?, 'Baseline enterprise project', 'v1.0.0', 'Alex Nguyen', 1, 'ALLOW_EXTERNAL', ?, ?, ?)
      `).run(prjId, projName, projKey, projData, now, now);
    }

    for (const u of defaultUsers) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = computePbkdf2Hash(u.pass, salt);
      insertUser.run(u.id, u.username, hash, salt, u.name, u.role, now);

      // Assign membership to default projects
      for (const prjId of ['PRJ-01', 'PRJ-02']) {
        insertMember.run(`pm_${prjId}_${u.id}`, prjId, u.id, u.role, now);
      }
    }

    // 3. Add project_id column to requirements table (R2-03)
    const reqCols = db.prepare('PRAGMA table_info(requirements)').all() as Array<{ name: string }>;
    if (!reqCols.some(c => c.name === 'project_id')) {
      db.exec(`
        ALTER TABLE requirements ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_requirements_project_id ON requirements (project_id);
      `);

      // Backfill project_id from data JSON or documents
      db.exec(`
        UPDATE requirements
        SET project_id = coalesce(
          json_extract(data, '$.projectId'),
          (SELECT d.project_id FROM documents d WHERE d.id = json_extract(requirements.data, '$.sourceReferences[0].documentId')),
          'PRJ-01'
        )
        WHERE project_id IS NULL;
      `);
    }

    // 4. Disentangle any legacy shared stored_files across different projects (BUG-020)
    try {
      const sharedFiles = db.prepare(`
        SELECT sf.id, sf.storage_key, sf.original_name, sf.mime_type, sf.size_bytes, sf.sha256, sf.created_at,
               COUNT(DISTINCT d.project_id) as project_count
        FROM stored_files sf
        JOIN document_versions dv ON dv.file_id = sf.id
        JOIN documents d ON d.id = dv.document_id
        GROUP BY sf.id
        HAVING project_count > 1
      `).all() as Array<any>;

      for (const sf of sharedFiles) {
        // Find document_versions for this file grouped by project
        const docVers = db.prepare(`
          SELECT dv.id as version_id, d.project_id as project_id
          FROM document_versions dv
          JOIN documents d ON d.id = dv.document_id
          WHERE dv.file_id = ?
        `).all(sf.id) as Array<{ version_id: string; project_id: string }>;

        // Keep first project, create dedicated clones for subsequent projects
        const projectsSeen = new Set<string>();
        for (const dv of docVers) {
          if (!projectsSeen.has(dv.project_id)) {
            projectsSeen.add(dv.project_id);
            if (projectsSeen.size > 1) {
              const newFileId = `FILE-${crypto.randomUUID()}`;
              const newStorageKey = `projects/${dv.project_id}/cloned/${sf.original_name}`;
              db.prepare(`
                INSERT OR IGNORE INTO stored_files (id, storage_key, original_name, mime_type, size_bytes, sha256, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `).run(newFileId, newStorageKey, sf.original_name, sf.mime_type, sf.size_bytes, sf.sha256, sf.created_at);

              db.prepare('UPDATE document_versions SET file_id = ? WHERE id = ?').run(newFileId, dv.version_id);
            }
          }
        }
      }
    } catch {}

    // 5. Change default of projects.ai_policy column to 'OFFLINE_ONLY' (BUG-002)
    try {
      db.exec('PRAGMA foreign_keys = OFF;');
      db.exec(`
        CREATE TABLE IF NOT EXISTS projects_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          key TEXT NOT NULL UNIQUE,
          description TEXT,
          version TEXT,
          author TEXT,
          members_count INTEGER DEFAULT 1,
          ai_policy TEXT NOT NULL DEFAULT 'OFFLINE_ONLY' CHECK(ai_policy IN ('OFFLINE_ONLY', 'COMMERCIAL_PRIVATE', 'ALLOW_EXTERNAL')),
          data TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT INTO projects_new (id, name, key, description, version, author, members_count, ai_policy, data, created_at, updated_at)
          SELECT id, name, key, description, version, author, members_count, coalesce(ai_policy, 'OFFLINE_ONLY'), data, created_at, updated_at FROM projects;
        DROP TABLE projects;
        ALTER TABLE projects_new RENAME TO projects;
      `);
      db.exec('PRAGMA foreign_keys = ON;');
    } catch {}
  }
};
