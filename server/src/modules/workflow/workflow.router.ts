import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response.js';
import { dbRepository } from '../../database/db.js';
import { defaultWorkflowEngine } from './workflowEngine.js';
import { defaultJobQueue } from './jobQueue.js';
import { authenticateUser, requireAuth, checkProjectAccess, getUserRoleInProject } from '../../common/auth.js';
import { ALL_TAXONOMY_CATEGORIES } from '../documents/classificationScorer.js';

export const workflowRouter = Router();

/**
 * GET /api/v1/jobs/:id or /api/v1/workflow/jobs/:id
 * Retrieve background job status and results with authentication and project isolation (NEW-13, R2-14, R3-05)
 */
workflowRouter.get(
  ['/jobs/:id', '/workflow/jobs/:id'],
  authenticateUser,
  requireAuth,
  (req: Request, res: Response) => {
    const job = dbRepository.jobs.getById(req.params.id);
    if (!job) return sendError(res, 'Job not found', 404);

    let parsedPayload: any = null;
    try {
      parsedPayload = job.payload ? JSON.parse(job.payload) : null;
    } catch {
      parsedPayload = job.payload;
    }

    const jobProjectId = parsedPayload?.projectId;
    if (jobProjectId && req.user && !checkProjectAccess(req.user, jobProjectId)) {
      return sendError(res, `Bạn không có quyền truy cập thông tin công việc của dự án "${jobProjectId}".`, 403);
    }

    if (parsedPayload && parsedPayload.documentText) {
      delete parsedPayload.documentText;
    }
    const parsedResult = job.result ? JSON.parse(job.result) : null;

    sendSuccess(res, {
      ...job,
      payload: parsedPayload,
      result: parsedResult
    });
  }
);

/**
 * POST /api/v1/jobs/:id/cancel or /api/v1/workflow/jobs/:id/cancel
 * Cancel a pending or running job with role enforcement and project isolation (NEW-13, R3-05, R6-01)
 */
workflowRouter.post(
  ['/jobs/:id/cancel', '/workflow/jobs/:id/cancel'],
  authenticateUser,
  requireAuth,
  (req: Request, res: Response) => {
    const job = dbRepository.jobs.getById(req.params.id);
    if (!job) return sendError(res, 'Job not found', 404);

    let targetProjectId: string | undefined;
    if (job.documentId) {
      const jobDoc = dbRepository.documents.getById(job.documentId);
      if (jobDoc) targetProjectId = jobDoc.projectId;
    }
    if (!targetProjectId) {
      try {
        const parsedPayload = job.payload ? JSON.parse(job.payload) : null;
        if (parsedPayload?.projectId) targetProjectId = parsedPayload.projectId;
      } catch {}
    }

    if (!targetProjectId) {
      if (req.user?.role === 'Project Admin') {
        targetProjectId = 'PRJ-01';
      } else {
        return sendError(res, 'Công việc không xác định được dự án nguồn. Truy cập bị từ chối (R6-03).', 403);
      }
    }

    if (req.user && !checkProjectAccess(req.user, targetProjectId)) {
      return sendError(res, `Bạn không có quyền hủy công việc của dự án "${targetProjectId}".`, 403);
    }

    const effectiveRole = req.user ? getUserRoleInProject(req.user.id, targetProjectId) : null;
    const allowedRoles = ['Project Admin', 'PM / Project Lead'];
    if (!effectiveRole || !allowedRoles.includes(effectiveRole)) {
      return sendError(res, `Permission denied: Vai trò "${effectiveRole || 'None'}" trong dự án "${targetProjectId}" không có quyền hủy công việc (R6-01).`, 403);
    }

    const reason = (req.body.reason as string) || `Cancelled by ${req.user?.name || effectiveRole || 'user'}`;
    const success = defaultJobQueue.cancelJob(req.params.id, reason);
    if (!success) {
      return sendError(res, 'Job could not be cancelled (either not found or already completed/failed)', 400);
    }
    sendSuccess(res, { id: req.params.id, status: 'CANCELLED' }, 'Công việc đã được hủy thành công');
  }
);

/**
 * POST /api/v1/jobs/:id/retry or /api/v1/workflow/jobs/:id/retry
 * Re-trigger a failed job with role enforcement and project isolation (BUG-011, NEW-13, R3-05, R6-01)
 */
workflowRouter.post(
  ['/jobs/:id/retry', '/workflow/jobs/:id/retry'],
  authenticateUser,
  requireAuth,
  (req: Request, res: Response) => {
    const job = dbRepository.jobs.getById(req.params.id);
    if (!job) return sendError(res, 'Job not found', 404);

    let targetProjectId: string | undefined;
    if (job.documentId) {
      const jobDoc = dbRepository.documents.getById(job.documentId);
      if (jobDoc) targetProjectId = jobDoc.projectId;
    }
    if (!targetProjectId) {
      try {
        const parsedPayload = job.payload ? JSON.parse(job.payload) : null;
        if (parsedPayload?.projectId) targetProjectId = parsedPayload.projectId;
      } catch {}
    }

    if (!targetProjectId) {
      if (req.user?.role === 'Project Admin') {
        targetProjectId = 'PRJ-01';
      } else {
        return sendError(res, 'Công việc không xác định được dự án nguồn. Truy cập bị từ chối (R6-03).', 403);
      }
    }

    if (req.user && !checkProjectAccess(req.user, targetProjectId)) {
      return sendError(res, `Bạn không có quyền chạy lại công việc của dự án "${targetProjectId}".`, 403);
    }

    const effectiveRole = req.user ? getUserRoleInProject(req.user.id, targetProjectId) : null;
    const allowedRoles = ['Project Admin', 'PM / Project Lead'];
    if (!effectiveRole || !allowedRoles.includes(effectiveRole)) {
      return sendError(res, `Permission denied: Vai trò "${effectiveRole || 'None'}" trong dự án "${targetProjectId}" không có quyền chạy lại công việc (R6-01).`, 403);
    }

    if (job.status !== 'FAILED') {
      return sendError(res, 'Chỉ có thể retry công việc ở trạng thái FAILED', 400);
    }

    // Reset job to PENDING using atomic UPDATE instead of failing INSERT (BUG-011)
    const resetSuccess = dbRepository.jobs.resetForRetry(job.id);
    if (!resetSuccess) {
      return sendError(res, 'Không thể lập lịch chạy lại công việc', 500);
    }

    sendSuccess(res, { id: job.id, status: 'PENDING' }, 'Công việc đã được lập lịch chạy lại');
  }
);

/**
 * POST /api/v1/workflow/transition
 * Perform a state machine transition with audit trail & role verification (BUG-005, R3-05, R6-01)
 */
workflowRouter.post(
  ['/workflow/transition', '/transition'],
  authenticateUser,
  requireAuth,
  async (req: Request, res: Response) => {
    const { documentId, versionNo, fromState, toState, reason, metadata } = req.body;
    if (!documentId || !toState) {
      return sendError(res, 'documentId và toState là bắt buộc', 400);
    }

    const doc = dbRepository.documents.getById(documentId);
    if (!doc) return sendError(res, 'Document not found', 404);

    if (req.user && !checkProjectAccess(req.user, doc.projectId)) {
      return sendError(res, `Bạn không có quyền chuyển đổi trạng thái tài liệu thuộc dự án "${doc.projectId}".`, 403);
    }

    const authenticatedRole = req.user ? getUserRoleInProject(req.user.id, doc.projectId || 'PRJ-01') : null;
    if (!authenticatedRole) {
      return sendError(res, `Permission denied: Bạn không phải thành viên của dự án "${doc.projectId}" (Condition 3).`, 403);
    }

    const allowedTransitionRoles = ['Project Admin', 'Reviewer / Approver', 'PM / Project Lead'];
    if (['Approved', 'Rejected'].includes(toState) && (!authenticatedRole || !allowedTransitionRoles.includes(authenticatedRole))) {
      return sendError(res, `Permission denied: Vai trò "${authenticatedRole}" trong dự án "${doc.projectId}" không có quyền phê duyệt/từ chối tài liệu (Condition 3, R6-01).`, 403);
    }
    const authenticatedActor = req.user?.name || req.user?.id || 'Reviewer';

    try {
      await defaultWorkflowEngine.transition({
        documentId,
        versionNo,
        fromState,
        toState,
        actor: authenticatedActor,
        role: authenticatedRole,
        reason,
        metadata
      });

      sendSuccess(res, { documentId, fromState, toState }, `Chuyển trạng thái thành công sang ${toState}`);
    } catch (err: any) {
      const isMismatch = err.message && err.message.includes('không khớp với fromState');
      sendError(res, err.message, isMismatch ? 409 : 400);
    }
  }
);

/**
 * PATCH /api/v1/workflow/documents/:id/category
 * Reclassify document category with stage isolation (preserves Stage 2 Understanding) (R6-01)
 */
workflowRouter.patch(
  ['/workflow/documents/:id/category', '/documents/:id/category'],
  authenticateUser,
  requireAuth,
  async (req: Request, res: Response) => {
    const { category, actor } = req.body;
    if (!category) return sendError(res, 'category là bắt buộc', 400);
    if (typeof category !== 'string' || !(ALL_TAXONOMY_CATEGORIES as string[]).includes(category)) {
      return sendError(res, 'category phải là một trong 8 thư mục chuẩn', 400);
    }

    const doc = dbRepository.documents.getById(req.params.id);
    if (!doc) return sendError(res, 'Document not found', 404);

    if (req.user && !checkProjectAccess(req.user, doc.projectId)) {
      return sendError(res, `Bạn không có quyền phân loại tài liệu thuộc dự án "${doc.projectId}".`, 403);
    }

    // Role dynamic evaluation per project (Condition 3, R6-01): User must be Admin, Approver, PM or BA specifically in doc.projectId
    const effectiveRole = req.user ? getUserRoleInProject(req.user.id, doc.projectId || 'PRJ-01') : null;
    const allowedRoles = ['Project Admin', 'Reviewer / Approver', 'PM / Project Lead', 'BA'];
    if (!effectiveRole || !allowedRoles.includes(effectiveRole)) {
      return sendError(res, `Permission denied: Vai trò "${effectiveRole || 'None'}" trong dự án "${doc.projectId}" không có quyền phân loại tài liệu (Condition 3, R6-01).`, 403);
    }

    const userActor = req.user?.name || actor || 'Reviewer';
    try {
      await defaultWorkflowEngine.updateDocumentCategory(req.params.id, category, userActor);
      sendSuccess(res, { id: req.params.id, category }, 'Cập nhật phân loại tài liệu thành công (bảo toàn tri thức Understanding)');
    } catch (err: any) {
      sendError(res, err.message, 400);
    }
  }
);
