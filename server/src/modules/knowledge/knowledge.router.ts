import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response.js';
import { dbRepository } from '../../database/db.js';
import { defaultKnowledgeService } from './knowledgeService.js';

export const knowledgeRouter = Router();

/**
 * GET /api/v1/knowledge-units
 * List atomic knowledge units with optional filters
 */
knowledgeRouter.get('/knowledge-units', (req: Request, res: Response) => {
  const projectId = (req.query.projectId as string) || 'PRJ-01';
  const status = req.query.status as string | undefined;
  const unitType = req.query.unitType as string | undefined;

  const units = dbRepository.knowledgeUnits.getByProject(projectId, { status, unitType });
  sendSuccess(res, units);
});

/**
 * GET /api/v1/knowledge-units/:id
 * Retrieve a single knowledge unit with all anchored sources
 */
knowledgeRouter.get('/knowledge-units/:id', (req: Request, res: Response) => {
  const unit = dbRepository.knowledgeUnits.getById(req.params.id);
  if (!unit) return sendError(res, 'Knowledge Unit không tồn tại', 404);

  const sources = dbRepository.knowledgeSources.getByUnitId(unit.id);
  sendSuccess(res, {
    ...unit,
    sources
  });
});

/**
 * POST /api/v1/knowledge-units/:id/decision
 * Review decision on knowledge unit: Approve (promotes to Requirement/Rule) or Reject (E6-T2, E6-T3)
 */
knowledgeRouter.post('/knowledge-units/:id/decision', async (req: Request, res: Response) => {
  const { decision, reviewer } = req.body;
  if (!decision || !['Approve', 'Reject'].includes(decision)) {
    return sendError(res, 'decision phải là "Approve" hoặc "Reject"', 400);
  }

  const unit = dbRepository.knowledgeUnits.getById(req.params.id);
  if (!unit) return sendError(res, 'Knowledge Unit không tồn tại', 404);

  try {
    if (decision === 'Approve') {
      const promoteResult = await defaultKnowledgeService.promoteUnitToRequirementOrRule(unit.id, reviewer || 'Reviewer');
      return sendSuccess(res, promoteResult, 'Đã phê duyệt tri thức và tự động thăng hạng sang Requirement');
    } else {
      dbRepository.knowledgeUnits.updateStatus(unit.id, 'Rejected');
      return sendSuccess(res, { id: unit.id, status: 'Rejected' }, 'Đã từ chối đơn vị tri thức');
    }
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
});

/**
 * GET /api/v1/conflicts
 * List unresolved conflicts for project
 */
knowledgeRouter.get('/conflicts', (req: Request, res: Response) => {
  const projectId = (req.query.projectId as string) || 'PRJ-01';
  const severity = req.query.severity as string | undefined;

  const conflicts = dbRepository.conflicts.getUnresolvedByProject(projectId, severity);
  sendSuccess(res, conflicts);
});

/**
 * POST /api/v1/conflicts/:id/resolve
 * Resolve a knowledge conflict (E6-T4)
 */
knowledgeRouter.post('/conflicts/:id/resolve', (req: Request, res: Response) => {
  const { resolution, resolvedBy } = req.body;
  if (!resolution || !['KEEP_NEW_SUPERSEDE_OLD', 'REJECT_NEW_PRESERVE_OLD', 'MERGE_SPECIFICATION'].includes(resolution)) {
    return sendError(res, 'Phương án hòa giải resolution không hợp lệ', 400);
  }

  const success = dbRepository.conflicts.resolve(req.params.id, resolution, resolvedBy || 'Reviewer / Approver');
  if (!success) {
    return sendError(res, 'Không tìm thấy xung đột hoặc xung đột đã được giải quyết', 404);
  }

  sendSuccess(res, { id: req.params.id, resolution }, 'Đã giải quyết xung đột tri thức thành công');
});
