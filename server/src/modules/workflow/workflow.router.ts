import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response.js';
import { dbRepository } from '../../database/db.js';
import { defaultWorkflowEngine } from './workflowEngine.js';

export const workflowRouter = Router();

/**
 * GET /api/v1/jobs/:id
 * Retrieve background job status and results
 */
workflowRouter.get('/jobs/:id', (req: Request, res: Response) => {
  const job = dbRepository.jobs.getById(req.params.id);
  if (!job) return sendError(res, 'Job not found', 404);
  sendSuccess(res, {
    ...job,
    payload: job.payload ? JSON.parse(job.payload) : null,
    result: job.result ? JSON.parse(job.result) : null
  });
});

/**
 * POST /api/v1/jobs/:id/cancel
 * Cancel a pending or running job
 */
workflowRouter.post('/jobs/:id/cancel', (req: Request, res: Response) => {
  const reason = (req.body.reason as string) || 'Cancelled by user';
  const success = dbRepository.jobs.cancel(req.params.id, reason);
  if (!success) {
    return sendError(res, 'Job could not be cancelled (either not found or already completed/failed)', 400);
  }
  sendSuccess(res, { id: req.params.id, status: 'CANCELLED' }, 'Công việc đã được hủy thành công');
});

/**
 * POST /api/v1/jobs/:id/retry
 * Re-trigger a failed job
 */
workflowRouter.post('/jobs/:id/retry', (req: Request, res: Response) => {
  const job = dbRepository.jobs.getById(req.params.id);
  if (!job) return sendError(res, 'Job not found', 404);
  if (job.status !== 'FAILED') {
    return sendError(res, 'Chỉ có thể retry công việc ở trạng thái FAILED', 400);
  }

  // Reset job to PENDING with 0 attempts and run immediately
  dbRepository.jobs.create({
    ...job,
    status: 'PENDING',
    attempts: 0,
    lockedBy: null,
    lockedAt: null,
    nextRunAt: new Date().toISOString(),
    lastError: null,
    updatedAt: new Date().toISOString()
  });

  sendSuccess(res, { id: job.id, status: 'PENDING' }, 'Công việc đã được lập lịch chạy lại');
});

/**
 * POST /api/v1/workflow/transition
 * Perform a state machine transition with audit trail & role verification
 */
workflowRouter.post('/transition', async (req: Request, res: Response) => {
  const { documentId, versionNo, fromState, toState, actor, role, reason, metadata } = req.body;
  if (!documentId || !fromState || !toState) {
    return sendError(res, 'documentId, fromState và toState là bắt buộc', 400);
  }

  try {
    await defaultWorkflowEngine.transition({
      documentId,
      versionNo,
      fromState,
      toState,
      actor: actor || 'System User',
      role: role || 'Reviewer / Approver',
      reason,
      metadata
    });

    sendSuccess(res, { documentId, fromState, toState }, `Chuyển trạng thái thành công sang ${toState}`);
  } catch (err: any) {
    sendError(res, err.message, 400);
  }
});

/**
 * PATCH /api/v1/workflow/documents/:id/category
 * Reclassify document category with stage isolation (preserves Stage 2 Understanding)
 */
workflowRouter.patch('/documents/:id/category', async (req: Request, res: Response) => {
  const { category, actor } = req.body;
  if (!category) return sendError(res, 'category là bắt buộc', 400);

  try {
    await defaultWorkflowEngine.updateDocumentCategory(req.params.id, category, actor || 'Reviewer');
    sendSuccess(res, { id: req.params.id, category }, 'Cập nhật phân loại tài liệu thành công (bảo toàn tri thức Understanding)');
  } catch (err: any) {
    sendError(res, err.message, 400);
  }
});
