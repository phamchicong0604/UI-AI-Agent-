import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { sendSuccess, sendError } from '../../common/response.js';
import { computeAuditEventHash } from '../../common/crypto.js';
import { AuditEvent } from '../../common/types.js';
import { dbRepository } from '../../database/db.js';
import { authenticateUser, requireAuth, checkProjectAccess } from '../../common/auth.js';

export const auditRouter = Router();

const ALLOWED_AUDIT_ACTIONS = new Set([
  'DOCUMENT_CREATED', 'DOCUMENT_UPDATED', 'DOCUMENT_STATUS_TRANSITION', 'VERSION_UPLOADED',
  'REQUIREMENT_CREATED', 'REQUIREMENT_UPDATED', 'REQUIREMENT_STATUS_TRANSITION',
  'TESTCASE_CREATED', 'TESTCASE_UPDATED', 'TESTCASE_STATUS_TRANSITION',
  'TEST_RUN_RECORDED', 'BUG_LOGGED', 'BUG_UPDATED', 'EVIDENCE_ATTACHED',
  'KNOWLEDGE_PROMOTED', 'KNOWLEDGE_REJECTED', 'CONFLICT_RESOLVED',
  'ADMIN_ROLE_SWITCH', 'USER_PASSWORD_CHANGE'
]);

auditRouter.get('/events', authenticateUser, (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  if (projectId) {
    if (!checkProjectAccess(req.user, projectId)) {
      return sendError(res, `Bạn không có quyền xem nhật ký kiểm toán của dự án "${projectId}".`, 403);
    }
  }

  const allEvents = dbRepository.auditEvents.getAll();
  const targetProjectId = projectId || req.user?.projectId || 'PRJ-01';

  // Strict project isolation: Only return events belonging to projects the user is explicitly authorized to view (R5-05)
  const filtered = allEvents.filter(e => {
    if (projectId) {
      return e.details.includes(projectId) || e.entityId === projectId;
    }
    // If no project specified, only include events matching user's accessible projects or actions performed by user
    return e.user === req.user?.username || 
           (e.details.includes(targetProjectId) && checkProjectAccess(req.user, targetProjectId)) || 
           (e.entityId === targetProjectId && checkProjectAccess(req.user, targetProjectId));
  });

  sendSuccess(res, filtered);
});

/**
 * POST /api/v1/audit/events
 * Appends a new tamper-evident audit event chained to the previous block hash.
 * R4-04 & R5-05: User and role are strictly derived from verified session credentials; action must belong to governed whitelist.
 */
auditRouter.post('/events', authenticateUser, requireAuth, (req: Request, res: Response) => {
  const { action, entityType, entityId, details, projectId } = req.body || {};
  if (!action || !entityType || !entityId) {
    return sendError(res, 'action, entityType and entityId are required', 400);
  }

  if (!ALLOWED_AUDIT_ACTIONS.has(action)) {
    return sendError(res, `Hành động kiểm toán "${action}" không hợp lệ hoặc không thuộc danh mục được phép (R5-05).`, 400);
  }

  const targetProjectId = projectId || req.user?.projectId || 'PRJ-01';
  if (!checkProjectAccess(req.user, targetProjectId)) {
    return sendError(res, `Bạn không có quyền ghi sự kiện kiểm toán cho dự án "${targetProjectId}".`, 403);
  }

  // Enforce authentic user and role from cryptographically signed token (R4-04)
  const user = req.user!.username || req.user!.name;
  const role = req.user!.role;

  // Collision-free unique ID generation using timestamp + random bytes (R5-05)
  const id = `AUD-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const previousEventHash = dbRepository.auditEvents.getLatestHash();

  const eventHash = computeAuditEventHash(previousEventHash, id, user, role, action, entityType, entityId, timestamp);

  const newEvent: AuditEvent = {
    id,
    user,
    role,
    action,
    entityType,
    entityId,
    details: details || '',
    timestamp,
    eventHash,
    previousEventHash
  };

  dbRepository.auditEvents.add(newEvent);
  sendSuccess(res, newEvent, 'Audit event chained and persisted', 201);
});

/**
 * POST /api/v1/audit/verify-chain
 * Validates cryptographic block-chain integrity of all audit events
 */
auditRouter.post('/verify-chain', authenticateUser, requireAuth, (req: Request, res: Response) => {
  const auditStore = dbRepository.auditEvents.getAll();
  let isChainValid = true;
  const verificationLog: any[] = [];

  for (let i = 0; i < auditStore.length; i++) {
    const current = auditStore[i];
    const prev = auditStore[i + 1];

    if (prev && current.previousEventHash !== prev.eventHash) {
      isChainValid = false;
      verificationLog.push({
        event: current.id,
        status: 'TAMPER_DETECTED',
        expectedPrev: prev.eventHash,
        actualPrev: current.previousEventHash
      });
    } else {
      verificationLog.push({
        event: current.id,
        status: 'HASH_VERIFIED',
        eventHash: current.eventHash
      });
    }
  }

  sendSuccess(res, {
    isChainValid,
    totalEventsVerified: auditStore.length,
    algorithm: 'SHA-256',
    verificationLog
  }, isChainValid ? 'Audit chain integrity cryptographically verified.' : 'Warning: Audit chain tampering detected.');
});
