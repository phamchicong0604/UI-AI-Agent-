import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response.js';
import { RequirementItem } from '../../common/types.js';
import { dbRepository } from '../../database/db.js';
import { authenticateUser, requireAuth, requireRole, checkProjectAccess, getUserRoleInProject } from '../../common/auth.js';

export const requirementsRouter = Router();

requirementsRouter.get('/', authenticateUser, (req: Request, res: Response) => {
  const projectId = (req.query.projectId as string) || (req.user as any)?.projectId;
  if (projectId) {
    if (!checkProjectAccess(req.user, projectId)) {
      return sendError(res, `Bạn không có quyền truy cập yêu cầu của dự án "${projectId}".`, 403);
    }
    return sendSuccess(res, dbRepository.requirements.getAll(projectId));
  }

  // Fail-closed without a target project: only a global Project Admin sees everything,
  // other users only see requirements of projects they are a member of (R7-02)
  const isSysAdmin = req.user ? dbRepository.users.getById(req.user.id)?.role === 'Project Admin' : false;
  if (isSysAdmin) {
    return sendSuccess(res, dbRepository.requirements.getAll());
  }
  const allowedProjects = req.user ? dbRepository.projectMembers.getProjectsForUser(req.user.id) : [];
  sendSuccess(res, allowedProjects.flatMap(pId => dbRepository.requirements.getAll(pId)));
});

requirementsRouter.get('/:id', authenticateUser, (req: Request, res: Response) => {
  const reqItem = dbRepository.requirements.getById(req.params.id);
  if (!reqItem) return sendError(res, 'Requirement not found', 404);
  // Fail-closed project isolation (R7-02)
  const projId = reqItem.projectId;
  if (!projId || !checkProjectAccess(req.user, projId)) {
    return sendError(res, `Bạn không có quyền truy cập yêu cầu thuộc dự án "${projId || 'không xác định'}" (R7-02).`, 403);
  }
  sendSuccess(res, reqItem);
});

requirementsRouter.post('/', authenticateUser, requireAuth, (req: Request, res: Response) => {
  const { title, description, type, priority, businessRules, acceptanceCriteria, sourceReferences, owner, projectId } = req.body;
  if (!title) return sendError(res, 'Title is required', 400);

  const projId = projectId || (req.user as any)?.projectId || 'PRJ-01';
  if (!checkProjectAccess(req.user, projId)) {
    return sendError(res, `Bạn không có quyền tạo yêu cầu trong dự án "${projId}".`, 403);
  }

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

  // Fail-closed project isolation (R7-02)
  const targetProj = reqItem.projectId;
  if (!targetProj || !checkProjectAccess(req.user, targetProj)) {
    return sendError(res, `Bạn không có quyền cập nhật yêu cầu thuộc dự án "${targetProj || 'không xác định'}" (R7-02).`, 403);
  }

  // BR-AUTH-01: Only Approver/Admin roles in the target project can approve/reject requirements (Condition 3, NEW-11, R6-01)
  const effectiveRole = req.user ? getUserRoleInProject(req.user.id, targetProj) : null;
  if (status === 'Approved' || status === 'Rejected') {
    if (!effectiveRole || !['Project Admin', 'Reviewer / Approver', 'PM / Project Lead'].includes(effectiveRole)) {
      return sendError(res, `Permission denied: Vai trò "${effectiveRole || 'QA'}" trong dự án "${targetProj}" không có quyền phê duyệt/từ chối yêu cầu (Condition 3).`, 403);
    }
  }

  reqItem.status = status;
  reqItem.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
  dbRepository.requirements.upsert(reqItem);
  sendSuccess(res, reqItem, `Requirement status updated to ${status}`);
});
