import { Database } from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { defaultFileStore } from '../../common/fileStore.js';
import { computeAuditEventHash } from '../../common/crypto.js';
import { dbRepository } from '../../database/db.js';

export interface RetentionCleanupResult {
  deletedRunsCount: number;
  retentionCutoffDate: string;
}

export interface CascadeProjectDeletionResult {
  projectId: string;
  deletedFilesCount: number;
  auditEventId: string;
  auditHash: string;
}

export class RetentionService {
  /**
   * Delete pipeline runs older than retention period (E10-T3.1)
   */
  public static cleanExpiredRuns(db: Database, retentionDays: number = 30): RetentionCleanupResult {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const result = db.prepare(`
      DELETE FROM pipeline_runs
      WHERE created_at < ?
    `).run(cutoff);

    return {
      deletedRunsCount: result.changes,
      retentionCutoffDate: cutoff
    };
  }

  /**
   * Cascade delete a project:
   * 1. Cascade deletes project and all associated child rows from SQLite in an atomic transaction (BUG-008).
   * 2. Physically deletes stored byte files from FileStore on disk after DB commit (BUG-022).
   * 3. Appends chained cryptographic AuditEvent (E10-T3.2, E10-T3.3).
   */
  public static async cascadeDeleteProject(
    db: Database,
    projectId: string,
    deletedBy: string = 'System Admin'
  ): Promise<CascadeProjectDeletionResult> {
    // 1. Identify all file storage keys linked to this project before DB deletion
    const fileRows = db.prepare(`
      SELECT DISTINCT sf.id, sf.storage_key as storageKey
      FROM stored_files sf
      JOIN document_versions dv ON dv.file_id = sf.id
      JOIN documents d ON d.id = dv.document_id
      WHERE d.project_id = ?
    `).all(projectId) as Array<{ id: string; storageKey: string }>;

    // 2. Execute explicit cascade deletion of all child tables in a single SQLite transaction
    const cascadeTx = db.transaction(() => {
      // a. Delete pipeline_runs and review_decisions (BUG-008)
      db.prepare(`
        DELETE FROM pipeline_runs
        WHERE document_version_id IN (
          SELECT dv.id FROM document_versions dv
          JOIN documents d ON d.id = dv.document_id
          WHERE d.project_id = ?
        )
      `).run(projectId);

      db.prepare(`
        DELETE FROM review_decisions
        WHERE target_id IN (
          SELECT id FROM document_versions WHERE document_id IN (SELECT id FROM documents WHERE project_id = ?)
        ) OR target_id IN (
          SELECT id FROM knowledge_units WHERE project_id = ?
        )
      `).run(projectId, projectId);

      // b. Delete knowledge_sources, conflicts and knowledge_units
      db.prepare(`
        DELETE FROM knowledge_sources
        WHERE unit_id IN (SELECT id FROM knowledge_units WHERE project_id = ?)
      `).run(projectId);

      db.prepare('DELETE FROM conflicts WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM knowledge_units WHERE project_id = ?').run(projectId);

      // c. Delete upload_batches and project memberships
      db.prepare('DELETE FROM upload_batches WHERE project_id = ?').run(projectId);
      try {
        db.prepare('DELETE FROM project_members WHERE project_id = ?').run(projectId);
      } catch {}

      // d. Delete jobs linked to this project using exact json_extract (R2-13)
      db.prepare(`
        DELETE FROM jobs
        WHERE json_extract(payload, '$.projectId') = ?
      `).run(projectId);

      // d.2 Delete test cases, test runs, evidence and bugs BEFORE deleting requirements (R4-11, BUG-008, R3-12)
      db.prepare(`
        DELETE FROM test_cases 
        WHERE json_extract(data, '$.projectId') = ? 
           OR requirement_id IN (SELECT id FROM requirements WHERE project_id = ?)
      `).run(projectId, projectId);

      db.prepare(`DELETE FROM test_runs WHERE json_extract(data, '$.projectId') = ?`).run(projectId);

      db.prepare(`DELETE FROM evidence WHERE json_extract(data, '$.projectId') = ?`).run(projectId);

      db.prepare(`
        DELETE FROM bugs 
        WHERE json_extract(data, '$.projectId') = ? 
           OR json_extract(data, '$.linkedRequirementId') IN (SELECT id FROM requirements WHERE project_id = ?)
           OR json_extract(data, '$.requirementId') IN (SELECT id FROM requirements WHERE project_id = ?)
      `).run(projectId, projectId, projectId);

      // Delete requirements after child entities referencing them have been deleted
      db.prepare(`
        DELETE FROM requirements 
        WHERE project_id = ? OR json_extract(data, '$.projectId') = ?
      `).run(projectId, projectId);

      // e. Delete document_relationships
      db.prepare(`
        DELETE FROM document_relationships
        WHERE source_doc_id IN (SELECT id FROM documents WHERE project_id = ?)
           OR target_doc_id IN (SELECT id FROM documents WHERE project_id = ?)
      `).run(projectId, projectId);

      // f. Delete document_versions
      db.prepare(`
        DELETE FROM document_versions
        WHERE document_id IN (SELECT id FROM documents WHERE project_id = ?)
      `).run(projectId);

      // g. Delete stored_files that are not referenced by any other project
      for (const f of fileRows) {
        const otherRefs = db.prepare(`
          SELECT COUNT(*) as count FROM document_versions WHERE file_id = ?
        `).get(f.id) as { count: number };
        if (otherRefs.count === 0) {
          db.prepare('DELETE FROM stored_files WHERE id = ?').run(f.id);
        }
      }

      // h. Delete documents
      db.prepare('DELETE FROM documents WHERE project_id = ?').run(projectId);

      // i. Delete project row
      db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
    });

    cascadeTx.immediate();

    // 3. Delete physical files from disk only after DB transaction has successfully committed (BUG-022)
    // Strictly verify no other records in stored_files reference the storageKey to prevent data loss (NEW-10)
    let deletedFilesCount = 0;
    for (const f of fileRows) {
      try {
        const remainingRefs = db.prepare(`
          SELECT COUNT(*) as count FROM stored_files WHERE storage_key = ?
        `).get(f.storageKey) as { count: number };

        if (remainingRefs.count === 0) {
          const deleted = await defaultFileStore.delete(f.storageKey);
          if (deleted) {
            deletedFilesCount++;
          }
        }
      } catch (err) {
        // Continue cleaning other files if missing
      }
    }

    // 4. Append cryptographic Audit Event with hash chain
    const latestHash = dbRepository.auditEvents.getLatestHash();
    const eventId = 'audit-' + randomUUID();
    const timestamp = new Date().toISOString();
    const action = 'PROJECT_CASCADE_DELETED';
    const target = `Project:${projectId}`;
    const payload = JSON.stringify({
      projectId,
      deletedFilesCount,
      deletedBy
    });

    const hash = computeAuditEventHash(latestHash, eventId, deletedBy, 'ADMIN', action, 'Project', projectId, timestamp);

    dbRepository.auditEvents.add({
      id: eventId,
      timestamp,
      actor: deletedBy,
      action,
      target,
      payload,
      previousEventHash: latestHash,
      eventHash: hash
    } as any);

    return {
      projectId,
      deletedFilesCount,
      auditEventId: eventId,
      auditHash: hash
    };
  }
}
