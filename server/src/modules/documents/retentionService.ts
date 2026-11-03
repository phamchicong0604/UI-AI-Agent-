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
   * 1. Physically deletes all stored byte files from FileStore on disk.
   * 2. Cascade deletes project and associated rows from SQLite.
   * 3. Appends chained cryptographic AuditEvent (E10-T3.2, E10-T3.3).
   */
  public static async cascadeDeleteProject(
    db: Database,
    projectId: string,
    deletedBy: string = 'System Admin'
  ): Promise<CascadeProjectDeletionResult> {
    // 1. Find all stored_files linked to documents in this project
    const fileRows = db.prepare(`
      SELECT sf.id, sf.storage_key as storageKey
      FROM stored_files sf
      JOIN document_versions dv ON dv.file_id = sf.id
      JOIN documents d ON d.id = dv.document_id
      WHERE d.project_id = ?
    `).all(projectId) as Array<{ id: string; storageKey: string }>;

    let deletedFilesCount = 0;
    for (const f of fileRows) {
      try {
        await defaultFileStore.delete(f.storageKey);
        deletedFilesCount++;
      } catch (err) {
        // Continue deleting remaining files even if one file is missing on disk
      }
    }

    // 2. Cascade delete project from database
    const deleteProjectStmt = db.prepare(`DELETE FROM projects WHERE id = ?`);
    deleteProjectStmt.run(projectId);

    // 3. Append cryptographic Audit Event with hash chain
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
