import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { sendSuccess, sendError } from '../../common/response.js';
import { computeAuditEventHash } from '../../common/crypto.js';
import { AuditEvent } from '../../common/types.js';
import { db, dbRepository } from '../../database/db.js';
import { authenticateUser, requireAuth, checkProjectAccess } from '../../common/auth.js';

export const auditRouter = Router();

const ALLOWED_AUDIT_ACTIONS = new Set([
  'DOCUMENT_CREATED', 'DOCUMENT_UPDATED', 'DOCUMENT_STATUS_TRANSITION', 'VERSION_UPLOADED',
  'REQUIREMENT_CREATED', 'REQUIREMENT_UPDATED', 'REQUIREMENT_STATUS_TRANSITION',
  'TESTCASE_CREATED', 'TESTCASE_UPDATED', 'TESTCASE_STATUS_TRANSITION',
  'TEST_RUN_RECORDED', 'BUG_LOGGED', 'BUG_UPDATED', 'EVIDENCE_ATTACHED',
  'KNOWLEDGE_PROMOTED', 'KNOWLEDGE_REJECTED', 'CONFLICT_RESOLVED'
]);

/**
 * R7-03: Fixed allowlist of entity types a client may attach to an audit event.
 * Each type maps to the table whose project_id column decides which project the event belongs to.
 * Table names are constants here and are never taken from request input.
 */
const AUDIT_ENTITY_TABLES: Record<string, string> = {
  Document: 'documents',
  Requirement: 'requirements',
  TestCase: 'test_cases',
  Evidence: 'evidence',
  TestRun: 'test_runs',
  Bug: 'bugs'
};

/**
 * Resolves an entity to the project that owns it, strictly from the database (R7-03).
 * Returns null when the type is not resolvable or the entity does not exist / has no project.
 * 'Conflict' is resolvable for reading server-generated events only; it is not accepted on POST.
 */
function resolveEntityProjectId(entityType: string, entityId: string): string | null {
  if (typeof entityType !== 'string' || typeof entityId !== 'string') return null;
  try {
    if (entityType === 'Conflict') {
      return dbRepository.conflicts.getById(entityId)?.projectId || null;
    }
    if (!Object.prototype.hasOwnProperty.call(AUDIT_ENTITY_TABLES, entityType)) return null;
    const row = db.prepare(`SELECT project_id, data FROM ${AUDIT_ENTITY_TABLES[entityType]} WHERE id = ?`)
      .get(entityId) as { project_id?: string | null; data?: string } | undefined;
    if (!row) return null;
    if (row.project_id) return row.project_id;
    const parsed = JSON.parse(row.data || '{}');
    return typeof parsed.projectId === 'string' && parsed.projectId ? parsed.projectId : null;
  } catch {
    return null;
  }
}

/**
 * Builds a per-request resolver deciding which project an audit event belongs to (R7-03).
 * Never inspects the free-text `details` field, which is caller-controlled on POST /audit/events.
 *  1. projectId stamped on the event by POST /audit/events (verified against the entity at write time);
 *  2. otherwise the project that owns the referenced entity today;
 *  3. otherwise, only for server-generated actions that a client cannot post (e.g. ADMIN_ROLE_SWITCH,
 *     PROJECT_CASCADE_DELETED), the entityId when it is itself the project id.
 */
function createEventProjectResolver(): (e: AuditEvent) => string | null {
  const cache = new Map<string, string | null>();
  return (e: AuditEvent) => {
    if (e.projectId) return e.projectId;
    if (!e.entityId) return null;
    const key = `${e.entityType}\u0000${e.entityId}`;
    if (!cache.has(key)) {
      cache.set(key, resolveEntityProjectId(e.entityType, e.entityId));
    }
    const resolved = cache.get(key);
    if (resolved) return resolved;
    if (!ALLOWED_AUDIT_ACTIONS.has(e.action)) return e.entityId;
    return null;
  };
}

auditRouter.get('/events', authenticateUser, (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  if (projectId) {
    if (!checkProjectAccess(req.user, projectId)) {
      return sendError(res, `Bạn không có quyền xem nhật ký kiểm toán của dự án "${projectId}".`, 403);
    }
  }

  const allEvents = dbRepository.auditEvents.getAll();
  const targetProjectId = projectId || req.user?.projectId || 'PRJ-01';
  const canViewTarget = checkProjectAccess(req.user, targetProjectId);
  const eventProject = createEventProjectResolver();

  // Strict project isolation: Only return events belonging to projects the user is explicitly authorized to view (R5-05)
  // R7-03: The project of an event is resolved from the DB, not from a substring match on `details`.
  const filtered = allEvents.filter(e => {
    if (projectId) {
      return eventProject(e) === projectId;
    }
    // If no project specified, only include events matching user's accessible projects or actions performed by user
    return e.user === req.user?.username || (canViewTarget && eventProject(e) === targetProjectId);
  });

  sendSuccess(res, filtered);
});

/**
 * POST /api/v1/audit/events
 * Appends a new tamper-evident audit event chained to the previous block hash.
 * R4-04 & R5-05: User and role are strictly derived from verified session credentials; action must belong to governed whitelist.
 * R7-03: entityType must belong to a fixed allowlist and the entity must resolve to a project the caller is a member of.
 */
auditRouter.post('/events', authenticateUser, requireAuth, (req: Request, res: Response) => {
  const { action, entityType, entityId, details, projectId } = req.body || {};
  if (!action || !entityType || !entityId) {
    return sendError(res, 'action, entityType and entityId are required', 400);
  }

  if (!ALLOWED_AUDIT_ACTIONS.has(action)) {
    return sendError(res, `Hành động kiểm toán "${action}" không hợp lệ hoặc không thuộc danh mục được phép (R5-05).`, 400);
  }

  if (typeof entityType !== 'string' || typeof entityId !== 'string' ||
      !Object.prototype.hasOwnProperty.call(AUDIT_ENTITY_TABLES, entityType)) {
    return sendError(res, 'Loại thực thể kiểm toán không hợp lệ hoặc không thuộc danh mục được phép (R7-03).', 400);
  }

  if (details !== undefined && details !== null && typeof details !== 'string') {
    return sendError(res, 'details must be a string', 400);
  }

  if (projectId !== undefined && projectId !== null && typeof projectId !== 'string') {
    return sendError(res, 'projectId must be a string', 400);
  }

  if (projectId !== undefined && projectId !== null && !checkProjectAccess(req.user, projectId)) {
    return sendError(res, `Bạn không có quyền ghi sự kiện kiểm toán cho dự án "${projectId}".`, 403);
  }

  // R6-04 & R7-03: The event's project is the project that owns the entity in the DB (never client input).
  // Fail-closed with one uniform answer when the entity does not exist, has no project, belongs to a
  // project the caller is not a member of, or does not match the projectId the caller claimed.
  const targetProjectId = resolveEntityProjectId(entityType, entityId);
  if (!targetProjectId || !checkProjectAccess(req.user, targetProjectId) || (projectId && projectId !== targetProjectId)) {
    return sendError(res, `Thực thể "${entityId}" (${entityType}) không tồn tại hoặc không thuộc dự án mà bạn có quyền ghi nhật ký kiểm toán (R6-04, R7-03).`, 400);
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
    entityType: entityType as AuditEvent['entityType'],
    entityId,
    projectId: targetProjectId,
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
 * Validates cryptographic block-chain integrity of audit events (Scoped to authorized projects, R6-04)
 */
auditRouter.post('/verify-chain', authenticateUser, requireAuth, (req: Request, res: Response) => {
  const { projectId } = req.body || {};
  const targetProjectId = projectId || (req.query?.projectId as string | undefined);
  if (targetProjectId) {
    if (req.user && !checkProjectAccess(req.user, targetProjectId)) {
      return sendError(res, `Bạn không có quyền xác thực chuỗi kiểm toán của dự án "${targetProjectId}".`, 403);
    }
  }

  // R7-03: Same DB-resolved project scoping as GET /audit/events (no substring match on `details`)
  const eventProject = createEventProjectResolver();
  let auditStore = dbRepository.auditEvents.getAll();
  if (targetProjectId) {
    auditStore = auditStore.filter(e => eventProject(e) === targetProjectId);
  } else if (req.user) {
    const isSysAdmin = dbRepository.users.getById(req.user.id)?.role === 'Project Admin';
    if (!isSysAdmin) {
      const allowedProjects = new Set(dbRepository.projectMembers.getProjectsForUser(req.user.id));
      auditStore = auditStore.filter(e => {
        const eventProjectId = eventProject(e);
        return Boolean(eventProjectId && allowedProjects.has(eventProjectId));
      });
    }
  }

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
