import type Database from 'better-sqlite3';
import { Migration } from '../migrator.js';
import { computeSha256 } from '../../common/crypto.js';
import { defaultFileStore } from '../../common/fileStore.js';

export const migration002FileStorageAndDocumentVersions: Migration = {
  version: '002',
  name: 'file_storage_and_document_versions',
  up: (db: Database.Database) => {
    // 1. Create stored_files table
    db.exec(`
      CREATE TABLE IF NOT EXISTS stored_files (
        id TEXT PRIMARY KEY,
        storage_key TEXT UNIQUE NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_stored_files_sha256 ON stored_files (sha256);

      CREATE TABLE IF NOT EXISTS document_versions (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        version_no TEXT NOT NULL,
        file_id TEXT,
        extracted_content TEXT,
        status TEXT NOT NULL DEFAULT 'Draft',
        change_summary TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY (file_id) REFERENCES stored_files(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_doc_versions_doc_id ON document_versions (document_id);
    `);

    // 2. Migrate existing versions[] from documents.data JSON into relational tables
    const docRows = db.prepare('SELECT id, data FROM documents').all() as { id: string; data: string }[];

    const insertStoredFile = db.prepare(`
      INSERT OR IGNORE INTO stored_files (id, storage_key, original_name, mime_type, size_bytes, sha256, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertDocVersion = db.prepare(`
      INSERT OR IGNORE INTO document_versions (id, document_id, version_no, file_id, extracted_content, status, change_summary, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateDocData = db.prepare('UPDATE documents SET data = ? WHERE id = ?');

    for (const row of docRows) {
      try {
        const doc = JSON.parse(row.data);
        const versions = Array.isArray(doc.versions) ? doc.versions : [];
        const content = doc.contentMarkdown || `# ${doc.title}

> **Dự án**: ${doc.projectId || 'PRJ-01'} | **Mã**: \`${doc.id}\` | **Phiên bản**: \`${doc.currentVersion || 'v1.0'}\`  
> **Tác giả**: ${doc.author || 'System'} | **Cập nhật**: ${doc.updatedAt || '2026-11-01'}

---

## 1. Tóm tắt Mục tiêu & Bối cảnh
${doc.description || 'Đặc tả kỹ thuật chuẩn hệ thống.'}

## 2. Quy tắc Nghiệp vụ & Toàn vẹn
- Tất cả các văn bản đều được ký số bất biến SHA-256.
- Mọi thay đổi đều được ghi vết kiểm toán chuỗi khối.
`;
        doc.contentMarkdown = content;
        const buffer = Buffer.from(content, 'utf-8');
        const fileSha256 = `sha256:${computeSha256(buffer)}`;

        const storageKey = `projects/${doc.projectId || 'PRJ-01'}/${doc.id}/${doc.id}.md`;
        const primaryFileId = `FILE-${computeSha256(Buffer.from(storageKey)).slice(0, 16)}`;

        // Put file into FileStore
        try {
          defaultFileStore.put(`${doc.id}.md`, buffer, storageKey);
        } catch {}

        insertStoredFile.run(
          primaryFileId,
          storageKey,
          `${doc.id}.md`,
          'text/markdown',
          buffer.length,
          fileSha256,
          doc.updatedAt || new Date().toISOString()
        );

        if (versions.length > 0) {
          for (const v of versions) {
            const versionNo = v.version || 'v1.0';
            const vId = `${doc.id}-${versionNo.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const effectiveChecksum = v.checksum?.startsWith('sha256:') ? v.checksum : fileSha256;

            insertDocVersion.run(
              vId,
              doc.id,
              versionNo,
              primaryFileId,
              content,
              v.status || doc.status || 'Draft',
              v.changeSummary || 'Initial document import',
              v.author || doc.author || 'System',
              v.updatedAt || doc.updatedAt || new Date().toISOString()
            );

            // Standardize checksum in version object to file hash
            v.checksum = effectiveChecksum;
          }
        } else {
          // If no versions array existed, create v1.0
          const versionNo = doc.currentVersion || 'v1.0';
          const vId = `${doc.id}-${versionNo.replace(/[^a-zA-Z0-9]/g, '_')}`;

          insertDocVersion.run(
            vId,
            doc.id,
            versionNo,
            primaryFileId,
            content,
            doc.status || 'Draft',
            'Baseline version',
            doc.author || 'System',
            doc.updatedAt || new Date().toISOString()
          );

          doc.versions = [
            {
              version: versionNo,
              updatedAt: doc.updatedAt || new Date().toISOString(),
              author: doc.author || 'System',
              status: doc.status || 'Draft',
              changeSummary: 'Baseline version',
              fileSize: `${(buffer.length / 1024).toFixed(1)} KB`,
              checksum: fileSha256
            }
          ];
        }

        // Save updated JSON with consistent checksums
        updateDocData.run(JSON.stringify(doc), doc.id);
      } catch (err) {
        console.warn(`[Migration 002] Notice migrating doc ${row.id}:`, err);
      }
    }
  }
};
