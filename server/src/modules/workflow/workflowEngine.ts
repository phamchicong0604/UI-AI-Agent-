import { WorkflowState, AuditEvent } from '../../common/types.js';
import { db, dbRepository } from '../../database/db.js';
import { computeSha256, computeAuditEventHash } from '../../common/crypto.js';

export class WorkflowTransitionError extends Error {
  constructor(public fromState: WorkflowState, public toState: WorkflowState, public reason: string) {
    super(`Invalid workflow transition from "${fromState}" to "${toState}": ${reason}`);
    this.name = 'WorkflowTransitionError';
  }
}

export interface TransitionRequest {
  documentId: string;
  versionNo?: string;
  fromState: WorkflowState;
  toState: WorkflowState;
  actor: string;
  role: string;
  reason?: string;
  metadata?: Record<string, any>;
}

export const ALLOWED_TRANSITIONS: Record<WorkflowState, readonly WorkflowState[]> = {
  UPLOADED: ['FILE_PROCESSING', 'CANCELLED', 'SUPERSEDED'],
  FILE_PROCESSING: ['AI_ANALYSIS', 'REVIEW_REQUIRED', 'FAILED', 'SUPERSEDED'],
  AI_ANALYSIS: ['VALIDATION', 'FAILED', 'CANCELLED', 'SUPERSEDED'],
  VALIDATION: ['REVIEW_REQUIRED', 'ORGANIZED', 'FAILED', 'SUPERSEDED'],
  REVIEW_REQUIRED: ['ORGANIZED', 'FEEDBACK_REQUIRED', 'REANALYSIS', 'CANCELLED', 'SUPERSEDED'],
  FEEDBACK_REQUIRED: ['REANALYSIS', 'CANCELLED', 'SUPERSEDED'],
  REANALYSIS: ['VALIDATION', 'FAILED', 'SUPERSEDED'],
  ORGANIZED: ['SUPERSEDED'],
  FAILED: ['FILE_PROCESSING', 'AI_ANALYSIS', 'CANCELLED', 'SUPERSEDED'],
  CANCELLED: [],
  SUPERSEDED: []
} as const;

export class WorkflowEngine {
  /**
   * Validate whether a transition is syntactically allowed
   */
  public canTransition(from: WorkflowState, to: WorkflowState): boolean {
    const validTargets = ALLOWED_TRANSITIONS[from];
    return validTargets ? validTargets.includes(to) : false;
  }

  /**
   * Enforce role-based permission for a specific state change
   */
  public checkRolePermission(toState: WorkflowState, role: string): boolean {
    if (['Project Admin', 'Admin'].includes(role)) return true;

    // Internal system stages cannot be triggered by human reviewer/PM roles (NEW-09)
    if (toState === 'FILE_PROCESSING' || toState === 'AI_ANALYSIS' || toState === 'VALIDATION') {
      return ['System Worker', 'Project Admin'].includes(role);
    }

    if (toState === 'ORGANIZED') {
      return ['Reviewer / Approver', 'PM / Project Lead', 'System Worker'].includes(role);
    }
    if (toState === 'FEEDBACK_REQUIRED') {
      return ['Reviewer / Approver', 'PM / Project Lead', 'Project Admin'].includes(role);
    }
    if (toState === 'SUPERSEDED') {
      return ['Document Author', 'Project Admin', 'PM / Project Lead', 'Reviewer / Approver', 'System Worker'].includes(role);
    }
    if (toState === 'CANCELLED') {
      return ['Document Author', 'Project Admin', 'PM / Project Lead', 'Reviewer / Approver'].includes(role);
    }
    if (toState === 'REANALYSIS') {
      return ['Reviewer / Approver', 'Document Author', 'System Worker', 'Project Admin', 'PM / Project Lead'].includes(role);
    }

    // Default system-driven pipeline transitions
    return ['System Worker', 'Project Admin'].includes(role);
  }

  /**
   * Execute state transition with audit logging and stage idempotency
   * BUG-005, NEW-06: Read actual state from DB, verify against compare-and-set, enforce authenticated role
   */
  public async transition(req: TransitionRequest): Promise<void> {
    const { documentId, toState, actor, role, reason, metadata } = req;

    const doc = dbRepository.documents.getById(documentId);
    if (!doc) {
      throw new WorkflowTransitionError(req.fromState || 'UPLOADED', toState, `Không tìm thấy tài liệu "${documentId}"`);
    }

    const versionNo = req.versionNo || doc.currentVersion || 'v1.0';
    const versionRow = db.prepare(`
      SELECT status, version_no FROM document_versions
      WHERE document_id = ? AND version_no = ?
    `).get(documentId, versionNo) as { status: string; version_no: string } | undefined;

    if (!versionRow) {
      throw new WorkflowTransitionError(
        req.fromState || 'UPLOADED',
        toState,
        `Không tìm thấy phiên bản "${versionNo}" của tài liệu "${documentId}" trong CSDL`
      );
    }

    // Actual current state in DB
    const actualCurrentState = versionRow.status as WorkflowState;

    // Guard: Verify client fromState matches real DB state (BUG-005)
    if (req.fromState && req.fromState !== actualCurrentState) {
      throw new WorkflowTransitionError(
        req.fromState,
        toState,
        `Trạng thái thực tế trong CSDL là "${actualCurrentState}", không khớp với fromState "${req.fromState}" của client`
      );
    }

    // 1. Verify state transition is valid according to state machine
    if (!this.canTransition(actualCurrentState, toState)) {
      throw new WorkflowTransitionError(actualCurrentState, toState, 'Trạng thái chuyển tiếp không nằm trong danh mục cho phép của State Machine');
    }

    // 2. Verify role permission
    if (!this.checkRolePermission(toState, role)) {
      throw new WorkflowTransitionError(actualCurrentState, toState, `Role "${role}" không có quyền chuyển trạng thái sang "${toState}"`);
    }

    const projectId = doc.projectId || 'PRJ-01';

    // 2.5 Critical Conflict Guard (E6-T4 AC): Critical conflict always blocks ORGANIZED
    if (toState === 'ORGANIZED') {
      const unresolvedCritical = dbRepository.conflicts.getUnresolvedByProject(projectId, 'Critical');
      if (unresolvedCritical.length > 0) {
        throw new WorkflowTransitionError(
          actualCurrentState,
          toState,
          `Dự án còn ${unresolvedCritical.length} xung đột nghiêm trọng (Critical Conflicts) chưa được giải quyết. Bắt buộc phải giải quyết trước khi chuyển sang ORGANIZED.`
        );
      }
    }

    const timestamp = new Date().toISOString();

    // 3. Update document and document_versions in SQLite with atomic compare-and-set inside transaction (NEW-06, BUG-005)
    let mappedStatus = doc.status;
    if (toState === 'ORGANIZED') mappedStatus = 'Approved';
    else if (toState === 'REVIEW_REQUIRED' || toState === 'FEEDBACK_REQUIRED') mappedStatus = 'In Review';
    else if (toState === 'FAILED') mappedStatus = 'Draft';

    const tx = db.transaction(() => {
      const updateRes = db.prepare(`
        UPDATE document_versions
        SET status = ?, change_summary = coalesce(?, change_summary)
        WHERE document_id = ? AND version_no = ? AND status = ?
      `).run(toState, reason || null, documentId, versionNo, actualCurrentState);

      if (updateRes.changes === 0) {
        return false;
      }

      doc.status = mappedStatus;
      doc.updatedAt = timestamp.replace('T', ' ').slice(0, 16);
      dbRepository.documents.upsert(doc);

      // Log chained immutable AuditEvent inside same transaction
      this.recordAuditEvent({
        entityType: 'Document',
        entityId: documentId,
        action: 'WORKFLOW_TRANSITION',
        actor,
        role: (role as any) || 'Reviewer / Approver',
        details: {
          fromState: actualCurrentState,
          toState,
          role,
          reason: reason || 'Chuyển trạng thái workflow',
          metadata: metadata || {}
        },
        timestamp
      });

      return true;
    });

    const casSuccess = tx.immediate();
    if (!casSuccess) {
      throw new WorkflowTransitionError(
        actualCurrentState,
        toState,
        `Xung đột đồng thời: Phiên bản "${versionNo}" đã bị thay đổi trạng thái bởi tiến trình khác (CAS failed)`
      );
    }
  }

  /**
   * Mark older pending version as SUPERSEDED when a new version is submitted (E3-T3.3, BUG-018)
   * Enforces state machine transitions and closes pending review decisions.
   */
  public async supersedePreviousVersions(documentId: string, currentVersionNo: string, actor: string): Promise<number> {
    const timestamp = new Date().toISOString();

    // Query pending versions (do not supersede active in-flight worker stages: FILE_PROCESSING, AI_ANALYSIS, VALIDATION)
    const olderVersions = db.prepare(`
      SELECT id, version_no, status FROM document_versions
      WHERE document_id = ? AND version_no != ? AND status IN ('UPLOADED', 'REVIEW_REQUIRED', 'FEEDBACK_REQUIRED', 'ORGANIZED')
    `).all(documentId, currentVersionNo) as Array<{ id: string; version_no: string; status: WorkflowState }>;

    let supersededCount = 0;
    for (const oldVer of olderVersions) {
      try {
        await this.transition({
          documentId,
          versionNo: oldVer.version_no,
          fromState: oldVer.status,
          toState: 'SUPERSEDED',
          actor,
          role: 'System Worker',
          reason: `Được thay thế bởi phiên bản mới ${currentVersionNo}`
        });
        supersededCount++;

        // Close pending knowledge units belonging to older version
        db.prepare(`
          UPDATE knowledge_units
          SET status = 'Superseded', updated_at = ?
          WHERE id IN (SELECT unit_id FROM knowledge_sources WHERE document_version_id = ?)
            AND status IN ('Draft', 'In Review')
        `).run(timestamp, oldVer.id);
      } catch (err: any) {
        console.warn(`[WorkflowEngine] Could not supersede version ${oldVer.version_no}:`, err.message);
      }
    }

    return supersededCount;
  }

  /**
   * Granular stage isolation (E3-T3 AC):
   * When reviewer modifies only the Document Type/Category, update metadata without re-triggering Understanding.
   */
  public async updateDocumentCategory(documentId: string, newCategory: any, actor: string): Promise<void> {
    const doc = dbRepository.documents.getById(documentId);
    if (!doc) throw new Error(`Document ${documentId} not found`);

    const oldCategory = doc.category;
    doc.category = newCategory;
    doc.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
    dbRepository.documents.upsert(doc);

    this.recordAuditEvent({
      entityType: 'Document',
      entityId: documentId,
      action: 'CATEGORY_RECLASSIFIED',
      actor,
      details: {
        oldCategory,
        newCategory,
        note: 'Stage Understanding is preserved (stage isolation)'
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Helper: Record chained immutable audit event
   */
  private recordAuditEvent(params: { 
    entityType: 'Document'; 
    entityId: string; 
    action: string; 
    actor: string; 
    role?: any;
    details: any; 
    timestamp: string; 
  }): void {
    const previousEventHash = dbRepository.auditEvents.getLatestHash();
    const eventId = `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const role = params.role || 'Reviewer / Approver';

    const eventHash = computeAuditEventHash(
      previousEventHash,
      eventId,
      params.actor,
      role,
      params.action,
      params.entityType,
      params.entityId,
      params.timestamp
    );

    const event: AuditEvent = {
      id: eventId,
      user: params.actor,
      role,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: typeof params.details === 'string' ? params.details : JSON.stringify(params.details),
      timestamp: params.timestamp,
      eventHash,
      previousEventHash
    };

    dbRepository.auditEvents.add(event);
  }
}

export const defaultWorkflowEngine = new WorkflowEngine();
