import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response.js';
import { RequirementItem } from '../../common/types.js';
import { dbRepository } from '../../database/db.js';

export const requirementsRouter = Router();

requirementsRouter.get('/', (req: Request, res: Response) => {
  const reqs = dbRepository.requirements.getAll();
  sendSuccess(res, reqs);
});

requirementsRouter.get('/:id', (req: Request, res: Response) => {
  const reqItem = dbRepository.requirements.getById(req.params.id);
  if (!reqItem) return sendError(res, 'Requirement not found', 404);
  sendSuccess(res, reqItem);
});

requirementsRouter.post('/', (req: Request, res: Response) => {
  const { title, description, type, priority, businessRules, acceptanceCriteria, sourceReferences, owner } = req.body;
  if (!title) return sendError(res, 'Title is required', 400);

  const existing = dbRepository.requirements.getAll();
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
    owner: owner || 'BA User',
    approver: 'Minh Tran (PM)',
    createdAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
  };

  dbRepository.requirements.upsert(newReq);
  sendSuccess(res, newReq, 'Requirement created and persisted to SQLite', 201);
});

requirementsRouter.patch('/:id/status', (req: Request, res: Response) => {
  const { status, userRole } = req.body;
  const reqItem = dbRepository.requirements.getById(req.params.id);
  if (!reqItem) return sendError(res, 'Requirement not found', 404);

  // BR-AUTH-01
  if (status === 'Approved' && userRole && !['Project Admin', 'Reviewer / Approver', 'PM / Project Lead'].includes(userRole)) {
    return sendError(res, 'Permission denied: Approver role required to approve requirement', 403);
  }

  reqItem.status = status;
  reqItem.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
  dbRepository.requirements.upsert(reqItem);
  sendSuccess(res, reqItem, `Requirement status updated to ${status}`);
});
