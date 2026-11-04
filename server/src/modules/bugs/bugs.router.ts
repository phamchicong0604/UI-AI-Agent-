import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response.js';
import { BugItem } from '../../common/types.js';
import { dbRepository } from '../../database/db.js';
import { authenticateUser, requireAuth, checkProjectAccess } from '../../common/auth.js';

export const bugsRouter = Router();

bugsRouter.get('/', authenticateUser, (req: Request, res: Response) => {
  const { status, severity, projectId } = req.query;
  const targetProjectId = (projectId as string) || (req.user as any)?.projectId;

  if (targetProjectId) {
    if (req.user && !checkProjectAccess(req.user, targetProjectId)) {
      return sendError(res, `Bạn không có quyền truy cập lỗi của dự án "${targetProjectId}".`, 403);
    }
  }

  let result = dbRepository.bugs.getAll();
  if (targetProjectId) {
    result = result.filter(b => (b as any).projectId === targetProjectId || (b as any).project_id === targetProjectId);
  } else if (req.user) {
    const isSysAdmin = dbRepository.users.getById(req.user.id)?.role === 'Project Admin';
    if (!isSysAdmin) {
      const allowedProjects = new Set(dbRepository.projectMembers.getProjectsForUser(req.user.id));
      result = result.filter(b => {
        const pId = (b as any).projectId || (b as any).project_id;
        return pId && allowedProjects.has(pId);
      });
    }
  }

  if (status && status !== 'ALL') result = result.filter(b => b.status === status);
  if (severity && severity !== 'ALL') result = result.filter(b => b.severity === severity);
  sendSuccess(res, result);
});

bugsRouter.get('/:id', authenticateUser, (req: Request, res: Response) => {
  const bug = dbRepository.bugs.getById(req.params.id);
  if (!bug) return sendError(res, 'Bug not found', 404);

  // Fail-closed project isolation (R6-03)
  const projId = (bug as any).projectId || (bug as any).project_id;
  if (!projId || (req.user && !checkProjectAccess(req.user, projId))) {
    return sendError(res, `Bạn không có quyền truy cập lỗi thuộc dự án "${projId || 'không xác định'}" (R6-03).`, 403);
  }
  sendSuccess(res, bug);
});

bugsRouter.post('/', authenticateUser, requireAuth, (req: Request, res: Response) => {
  const { title, description, severity, priority, assignee, environment, buildVersion, stepsToReproduce, expectedResult, actualResult, linkedRequirementId, linkedTestCaseId, linkedTestRunId, linkedEvidenceIds, projectId } = req.body;
  if (!title) return sendError(res, 'Title is required', 400);

  const projId = projectId || (req.user as any)?.projectId || 'PRJ-01';
  if (req.user && !checkProjectAccess(req.user, projId)) {
    return sendError(res, `Bạn không có quyền báo cáo lỗi trong dự án "${projId}".`, 403);
  }

  const existing = dbRepository.bugs.getAll();
  const newBug: BugItem & { projectId?: string } = {
    id: `BUG-00${existing.length + 1}`,
    projectId: projId,
    title,
    description: description || '',
    severity: severity || 'Major',
    priority: priority || 'High',
    status: 'Open',
    assignee: assignee || 'Tech Lead / DEV',
    environment: environment || 'QA',
    buildVersion: buildVersion || 'build-1048',
    stepsToReproduce: Array.isArray(stepsToReproduce) ? stepsToReproduce : [],
    expectedResult: expectedResult || '',
    actualResult: actualResult || '',
    linkedRequirementId,
    linkedTestCaseId,
    linkedTestRunId,
    linkedEvidenceIds: Array.isArray(linkedEvidenceIds) ? linkedEvidenceIds : [],
    createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
    updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
  };

  dbRepository.bugs.upsert(newBug as any);
  sendSuccess(res, newBug, 'Defect logged and persisted to SQLite', 201);
});

bugsRouter.patch('/:id/status', authenticateUser, requireAuth, (req: Request, res: Response) => {
  const { status } = req.body;
  const bug = dbRepository.bugs.getById(req.params.id);
  if (!bug) return sendError(res, 'Bug not found', 404);

  // Fail-closed project isolation (R6-03)
  const projId = (bug as any).projectId || (bug as any).project_id;
  if (!projId || (req.user && !checkProjectAccess(req.user, projId))) {
    return sendError(res, `Bạn không có quyền cập nhật lỗi thuộc dự án "${projId || 'không xác định'}" (R6-03).`, 403);
  }

  bug.status = status;
  bug.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
  dbRepository.bugs.upsert(bug);
  sendSuccess(res, bug, `Bug status updated to ${status}`);
});
