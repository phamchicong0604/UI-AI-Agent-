import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response.js';
import { RequirementItem } from '../../common/types.js';
import { dbRepository } from '../../database/db.js';
import { authenticateUser, requireAuth, requireRole } from '../../common/auth.js';

export const requirementsRouter = Router();

requirementsRouter.get('/', (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  const reqs = dbRepository.requirements.getAll(projectId);
  sendSuccess(res, reqs);
});

requirementsRouter.get('/:id', (req: Request, res: Response) => {
  const reqItem = dbRepository.requirements.getById(req.params.id);
  if (!reqItem) return sendError(res, 'Requirement not found', 404);
  sendSuccess(res, reqItem);
});

requirementsRouter.post('/', authenticateUser, requireAuth, (req: Request, res: Response) => {
  const { title, description, type, priority, businessRules, acceptanceCriteria, sourceReferences, owner, projectId } = req.body;
  if (!title) return sendError(res, 'Title is required', 400);

  const existing = dbRepository.requirements.getAll();
  const projId = projectId || (req.user as any)?.projectId || 'PRJ-01';
  const newReq: RequirementItem = {
    id: `REQ-00${existing.length + 1}`,
    title,
    description: description || '',
    type: type || 'Functional',
    priority: priority || 'High',
    businessRules: Array.isArray(businessRules) ? businessRules : [],
    acceptanceCriteria: Array.isArray(acceptanceCriteria) ? acceptanceCriteria : [],
    sourceReferences: Array.isArray(sourceReferences) ? sourceReferences : [],
    status: 'Draft',
    owner: owner || req.user?.name || 'BA User',
    approver: 'Minh Tran (PM)',
    createdAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
  };

  dbRepository.requirements.upsert({ ...newReq, projectId: projId });
  sendSuccess(res, newReq, 'Requirement created and persisted to SQLite', 201);
});

requirementsRouter.patch('/:id/status', authenticateUser, requireAuth, (req: Request, res: Response) => {
  const { status } = req.body;
  const reqItem = dbRepository.requirements.getById(req.params.id);
  if (!reqItem) return sendError(res, 'Requirement not found', 404);

  // BR-AUTH-01: Only Approver/Admin roles can approve requirements (NEW-11)
  if (status === 'Approved' || status === 'Rejected') {
    const userRole = req.user?.role;
    if (!userRole || !['Project Admin', 'Reviewer / Approver', 'PM / Project Lead'].includes(userRole)) {
      return sendError(res, 'Permission denied: Approver role required to approve/reject requirement', 403);
    }
  }

  reqItem.status = status;
  reqItem.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
  dbRepository.requirements.upsert(reqItem);
  sendSuccess(res, reqItem, `Requirement status updated to ${status}`);
});
