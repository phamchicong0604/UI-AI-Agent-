import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { sendSuccess, sendError } from '../../common/response.js';
import { db, dbRepository } from '../../database/db.js';
import { defaultKnowledgeService } from './knowledgeService.js';
import { authenticateUser, requireRole, checkProjectAccess } from '../../common/auth.js';
import { ConflictRecord } from '../../common/types.js';
import { computeAuditEventHash } from '../../common/crypto.js';

export const knowledgeRouter = Router();

/**
 * GET /api/v1/knowledge-units
 * List atomic knowledge units with optional filters and source anchors (BUG-028)
 */
knowledgeRouter.get('/knowledge-units', authenticateUser, (req: Request, res: Response) => {
  const projectId = (req.query.projectId as string) || (req.user as any)?.projectId || 'PRJ-01';
  if (req.user && !checkProjectAccess(req.user, projectId)) {
    return sendError(res, `Bạn không có quyền truy cập tri thức của dự án "${projectId}".`, 403);
  }
  const status = req.query.status as string | undefined;
  const unitType = req.query.unitType as string | undefined;

  const rawUnits = dbRepository.knowledgeUnits.getByProject(projectId, { status, unitType });
  const units = rawUnits.map(u => {
    const sources = dbRepository.knowledgeSources.getByUnitId(u.id);
    const topSource = sources[0];
    return {
      ...u,
      headingPath: topSource?.headingPath || null,
      charOffsetStart: topSource?.charOffsetStart,
      charOffsetEnd: topSource?.charOffsetEnd,
      exactQuote: topSource?.exactQuote,
      sources
    };
  });
  sendSuccess(res, units);
});

/**
 * GET /api/v1/knowledge-units/:id
 * Retrieve a single knowledge unit with all anchored sources
 */
knowledgeRouter.get('/knowledge-units/:id', authenticateUser, (req: Request, res: Response) => {
  const unit = dbRepository.knowledgeUnits.getById(req.params.id);
  if (!unit) return sendError(res, 'Knowledge Unit không tồn tại', 404);
  if (req.user && !checkProjectAccess(req.user, unit.projectId)) {
    return sendError(res, `Bạn không có quyền truy cập tri thức thuộc dự án "${unit.projectId}".`, 403);
  }

  const sources = dbRepository.knowledgeSources.getByUnitId(unit.id);
  const topSource = sources[0];
  sendSuccess(res, {
    ...unit,
    headingPath: topSource?.headingPath || null,
    charOffsetStart: topSource?.charOffsetStart,
    charOffsetEnd: topSource?.charOffsetEnd,
    exactQuote: topSource?.exactQuote,
    sources
  });
});

/**
 * POST /api/v1/knowledge-units/:id/decision
 * Review decision on knowledge unit: Approve (promotes to Requirement/Rule) or Reject (E6-T2, E6-T3, BUG-003, BUG-004)
 */
knowledgeRouter.post(
  '/knowledge-units/:id/decision',
  authenticateUser,
  requireRole(['Project Admin', 'Reviewer / Approver', 'PM / Project Lead']),
  async (req: Request, res: Response) => {
    const { decision, reason, overrideExplicit } = req.body;
    if (!decision || !['Approve', 'Reject'].includes(decision)) {
      return sendError(res, 'decision phải là "Approve" hoặc "Reject"', 400);
    }

    const unit = dbRepository.knowledgeUnits.getById(req.params.id);
    if (!unit) return sendError(res, 'Knowledge Unit không tồn tại', 404);

    if (req.user && !checkProjectAccess(req.user, unit.projectId)) {
      return sendError(res, `Bạn không có quyền ra quyết định tri thức thuộc dự án "${unit.projectId}".`, 403);
    }

    const reviewerName = req.user?.name || req.user?.id || 'Reviewer';

    try {
      if (decision === 'Approve') {
        const promoteResult = await defaultKnowledgeService.promoteUnitToRequirementOrRule(
          unit.id, 
          reviewerName,
          { overrideExplicit, reason }
        );
        return sendSuccess(res, promoteResult, 'Đã phê duyệt tri thức và tự động thăng hạng sang Requirement');
      } else {
        const rejected = await defaultKnowledgeService.rejectUnit(unit.id, reviewerName, reason);
        return sendSuccess(res, { id: rejected.id, status: rejected.status }, 'Đã từ chối đơn vị tri thức');
      }
    } catch (err: any) {
      sendError(res, err.message, 400);
    }
  }
);

/**
 * GET /api/v1/conflicts
 * List conflicts for project with optional status and severity filters (BUG-027)
 */
knowledgeRouter.get('/conflicts', authenticateUser, (req: Request, res: Response) => {
  const projectId = (req.query.projectId as string) || (req.user as any)?.projectId || 'PRJ-01';
  if (req.user && !checkProjectAccess(req.user, projectId)) {
    return sendError(res, `Bạn không có quyền truy cập xung đột của dự án "${projectId}".`, 403);
  }
  const severity = req.query.severity as string | undefined;
  const status = req.query.status as string | undefined;

  let rawConflicts;
  if (status && status !== 'UNRESOLVED') {
    rawConflicts = dbRepository.conflicts.getByProject(projectId, severity);
    if (status !== 'ALL') {
      rawConflicts = rawConflicts.filter(c => (c as any).status === status || c.resolution === status);
    }
  } else {
    rawConflicts = dbRepository.conflicts.getUnresolvedByProject(projectId, severity);
  }

  const conflicts = rawConflicts.map((c: any) => ({
    ...c,
    resolutionNotes: c.resolution_notes || c.resolutionNotes
  }));
  sendSuccess(res, conflicts);
});

/**
 * GET /api/v1/conflicts/:id
 * Retrieve a single conflict with resolution notes (BUG-027)
 */
knowledgeRouter.get('/conflicts/:id', authenticateUser, (req: Request, res: Response) => {
  const c = dbRepository.conflicts.getById(req.params.id);
  if (!c) return sendError(res, 'Conflict không tồn tại', 404);
  if (req.user && !checkProjectAccess(req.user, c.projectId)) {
    return sendError(res, `Bạn không có quyền truy cập xung đột thuộc dự án "${c.projectId}".`, 403);
  }
  sendSuccess(res, {
    ...c,
    resolutionNotes: c.resolutionNotes || (c as any).resolution_notes
  });
});

/**
 * POST /api/v1/conflicts/:id/resolve
 * Resolve a knowledge conflict with audit logging (E6-T4, BUG-003, BUG-026, BUG-027)
 */
knowledgeRouter.post(
  '/conflicts/:id/resolve',
  authenticateUser,
  requireRole(['Project Admin', 'Reviewer / Approver', 'PM / Project Lead']),
  (req: Request, res: Response) => {
    let { resolution, notes } = req.body;
    if (!resolution) {
      return sendError(res, 'Thiếu phương án hòa giải resolution', 400);
    }

    // Normalize resolution variants
    if (resolution === 'SUPERSEDE') resolution = 'KEEP_NEW_SUPERSEDE_OLD';
    else if (resolution === 'REJECT') resolution = 'REJECT_NEW_PRESERVE_OLD';
    else if (resolution === 'COEXIST' || resolution === 'MERGE') resolution = 'MERGE_SPECIFICATION';

    if (!['KEEP_NEW_SUPERSEDE_OLD', 'REJECT_NEW_PRESERVE_OLD', 'MERGE_SPECIFICATION'].includes(resolution)) {
      return sendError(res, 'Phương án hòa giải resolution không hợp lệ', 400);
    }

    // Guard: MERGE_SPECIFICATION / COEXIST requires confirmation notes (BUG-027)
    if (resolution === 'MERGE_SPECIFICATION' && (!notes || notes.trim().length < 5)) {
      return sendError(res, 'Phương án MERGE_SPECIFICATION / COEXIST bắt buộc phải có ghi chú xác nhận từ BA/Reviewer tối thiểu 5 ký tự', 400);
    }

    const conflict = db.prepare('SELECT * FROM conflicts WHERE id = ?').get(req.params.id) as any;
    if (!conflict) {
      return sendError(res, 'Không tìm thấy xung đột tri thức', 404);
    }

    if (req.user && !checkProjectAccess(req.user, conflict.project_id)) {
      return sendError(res, `Bạn không có quyền giải quyết xung đột thuộc dự án "${conflict.project_id}".`, 403);
    }

    if (conflict.resolution && conflict.resolution !== 'UNRESOLVED') {
      return sendError(res, 'Xung đột này đã được giải quyết trước đó (không thể giải quyết lại)', 409);
    }

    const resolvedByName = req.user?.name || req.user?.id || 'Reviewer / Approver';

    // BUG-027: Apply resolution impact on affected knowledge units in an atomic transaction
    const tx = db.transaction(() => {
      const success = dbRepository.conflicts.resolve(req.params.id, resolution, resolvedByName, notes?.trim());
      if (!success) {
        throw new Error('CONFLICT_ALREADY_RESOLVED');
      }

      if (resolution === 'KEEP_NEW_SUPERSEDE_OLD') {
        // Older unit (unit_a_id) transitions to Superseded
        if (conflict.unit_a_id) {
          dbRepository.knowledgeUnits.updateStatus(conflict.unit_a_id, 'Superseded');
        }
      } else if (resolution === 'REJECT_NEW_PRESERVE_OLD') {
        // Newer unit (unit_b_id) transitions to Rejected
        if (conflict.unit_b_id) {
          dbRepository.knowledgeUnits.updateStatus(conflict.unit_b_id, 'Rejected');
        }
      }

      // Record audit event for conflict resolution (BUG-027)
      const latestHash = dbRepository.auditEvents.getLatestHash();
      const eventId = `EVT-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const timestamp = new Date().toISOString();
      const action = 'CONFLICT_RESOLVED';
      const actor = resolvedByName;
      const role = (req.user?.role || 'Reviewer / Approver') as any;
      const details = `Resolved conflict ${req.params.id} with ${resolution}: ${notes || ''}`;
      const hash = computeAuditEventHash(latestHash, eventId, actor, role, action, 'Conflict', req.params.id, timestamp);

      dbRepository.auditEvents.add({
        id: eventId,
        user: actor,
        role,
        action,
        entityType: 'Conflict',
        entityId: req.params.id,
        details,
        timestamp,
        previousEventHash: latestHash,
        eventHash: hash
      });
    });

    try {
      tx.immediate();
    } catch (err: any) {
      if (err.message === 'CONFLICT_ALREADY_RESOLVED') {
        return sendError(res, 'Không thể giải quyết xung đột (có thể đã được cập nhật bởi phiên làm việc khác)', 409);
      }
      return sendError(res, `Lỗi khi giải quyết xung đột: ${err.message}`, 500);
    }

    sendSuccess(res, { id: req.params.id, resolution, resolvedBy: resolvedByName, notes: notes?.trim() }, 'Đã giải quyết xung đột tri thức thành công');
  }
);
