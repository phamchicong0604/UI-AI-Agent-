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
  UPLOADED: ['FILE_PROCESSING', 'CANCELLED'],
  FILE_PROCESSING: ['AI_ANALYSIS', 'REVIEW_REQUIRED', 'FAILED'],
  AI_ANALYSIS: ['VALIDATION', 'FAILED', 'CANCELLED'],
  VALIDATION: ['REVIEW_REQUIRED', 'ORGANIZED', 'FAILED'],
  REVIEW_REQUIRED: ['ORGANIZED', 'FEEDBACK_REQUIRED', 'REANALYSIS', 'CANCELLED', 'SUPERSEDED'],
  FEEDBACK_REQUIRED: ['REANALYSIS', 'CANCELLED'],
  REANALYSIS: ['VALIDATION', 'FAILED'],
  ORGANIZED: ['SUPERSEDED'],
  FAILED: ['FILE_PROCESSING', 'AI_ANALYSIS', 'CANCELLED'],
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

    if (toState === 'ORGANIZED') {
      return ['Reviewer / Approver', 'PM / Project Lead', 'System Worker'].includes(role);
    }
    if (toState === 'FEEDBACK_REQUIRED') {
      return ['Reviewer / Approver', 'PM / Project Lead'].includes(role);
    }
    if (toState === 'CANCELLED') {
      return ['Document Author', 'Project Admin', 'PM / Project Lead'].includes(role);
    }
    if (toState === 'REANALYSIS') {
      return ['Reviewer / Approver', 'Document Author', 'System Worker', 'Project Admin'].includes(role);
    }

    // Default system-driven pipeline transitions
    return ['System Worker', 'Project Admin'].includes(role);
  }

  /**
   * Execute state transition with audit logging and stage idempotency
   */
  public async transition(req: TransitionRequest): Promise<void> {
    const { documentId, fromState, toState, actor, role, reason, metadata } = req;

    // 1. Verify state transition is valid according to state machine
    if (!this.canTransition(fromState, toState)) {
      throw new WorkflowTransitionError(fromState, toState, 'Trạng thái chuyển tiếp không nằm trong danh mục cho phép của State Machine');
    }

    // 2. Verify role permission
    if (!this.checkRolePermission(toState, role)) {
      throw new WorkflowTransitionError(fromState, toState, `Role "${role}" không có quyền chuyển trạng thái sang "${toState}"`);
    }

    const timestamp = new Date().toISOString();

    // 3. Update document and document_versions in SQLite
    const doc = dbRepository.documents.getById(documentId);
    if (doc) {
      // Map workflow states to UI status lifecycle
      let mappedStatus = doc.status;
      if (toState === 'ORGANIZED') mappedStatus = 'Approved';
      else if (toState === 'REVIEW_REQUIRED' || toState === 'FEEDBACK_REQUIRED') mappedStatus = 'In Review';
      else if (toState === 'FAILED') mappedStatus = 'Draft';

      doc.status = mappedStatus;
      doc.updatedAt = timestamp.replace('T', ' ').slice(0, 16);
      dbRepository.documents.upsert(doc);
    }

    // Update document_versions status
    const versionNo = req.versionNo || doc?.currentVersion || 'v1.0';
    db.prepare(`
      UPDATE document_versions
      SET status = ?, change_summary = coalesce(?, change_summary)
      WHERE document_id = ? AND version_no = ?
    `).run(toState, reason || null, documentId, versionNo);

    // 4. Log chained immutable AuditEvent (E3-T3.4)
    this.recordAuditEvent({
      entityType: 'Document',
      entityId: documentId,
      action: 'WORKFLOW_TRANSITION',
      actor,
      role: (role as any) || 'Reviewer / Approver',
      details: {
        fromState,
        toState,
        role,
        reason: reason || 'Chuyển trạng thái workflow',
        metadata: metadata || {}
      },
      timestamp
    });
  }

  /**
   * Mark older pending version as SUPERSEDED when a new version is submitted (E3-T3.3)
   */
  public async supersedePreviousVersions(documentId: string, currentVersionNo: string, actor: string): Promise<number> {
    const timestamp = new Date().toISOString();
    const result = db.prepare(`
      UPDATE document_versions
      SET status = 'SUPERSEDED', change_summary = 'Được thay thế bởi phiên bản ' || ?
      WHERE document_id = ? AND version_no != ? AND status IN ('UPLOADED', 'FILE_PROCESSING', 'AI_ANALYSIS', 'VALIDATION', 'REVIEW_REQUIRED', 'FEEDBACK_REQUIRED')
    `).run(currentVersionNo, documentId, currentVersionNo);

    if (result.changes > 0) {
      this.recordAuditEvent({
        entityType: 'Document',
        entityId: documentId,
        action: 'VERSION_SUPERSEDED',
        actor,
        details: {
          currentVersionNo,
          supersededCount: result.changes,
          reason: `Tải lên phiên bản mới ${currentVersionNo}`
        },
        timestamp
      });
    }

    return result.changes;
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
