import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response.js';
import { TestCaseItem } from '../../common/types.js';
import { dbRepository } from '../../database/db.js';
import { authenticateUser, requireAuth, checkProjectAccess, getUserRoleInProject } from '../../common/auth.js';

export const testcasesRouter = Router();

testcasesRouter.get('/', authenticateUser, (req: Request, res: Response) => {
  const { status, type, priority, requirementId, projectId } = req.query;
  const targetProjectId = (projectId as string) || (req.user as any)?.projectId;

  if (req.user && targetProjectId && !checkProjectAccess(req.user, targetProjectId)) {
    return sendError(res, `Bạn không có quyền truy cập test case của dự án "${targetProjectId}".`, 403);
  }

  let result = dbRepository.testCases.getAll();
  if (targetProjectId) {
    result = result.filter(t => (t as any).projectId === targetProjectId || (t as any).project_id === targetProjectId);
  }

  if (status && status !== 'ALL') result = result.filter(t => t.status === status);
  if (type && type !== 'ALL') result = result.filter(t => t.type === type);
  if (priority && priority !== 'ALL') result = result.filter(t => t.priority === priority);
  if (requirementId) result = result.filter(t => t.requirementId === requirementId);

  sendSuccess(res, result);
});

/**
 * GET /api/v1/testcases/:id/workspace
 * Dedicated endpoint returning the 3-column workspace data package (Proposal Section 7.1)
 */
testcasesRouter.get('/:id/workspace', authenticateUser, (req: Request, res: Response) => {
  const tc = dbRepository.testCases.getById(req.params.id);
  if (!tc) return sendError(res, 'Test case not found', 404);

  if (req.user && (tc as any).projectId && !checkProjectAccess(req.user, (tc as any).projectId)) {
    return sendError(res, `Bạn không có quyền truy cập test case thuộc dự án "${(tc as any).projectId}".`, 403);
  }

  sendSuccess(res, {
    column1_Requirement: {
      requirementId: tc.requirementId,
      requirementTitle: tc.requirementTitle,
      sourceReferences: tc.sourceReferences
    },
    column2_TestProcedure: {
      id: tc.id,
      title: tc.title,
      scenario: tc.scenario,
      preconditions: tc.preconditions,
      testData: tc.testData,
      type: tc.type,
      priority: tc.priority,
      status: tc.status,
      steps: tc.steps
    },
    column3_CitationsAndReviews: {
      sourceReferences: tc.sourceReferences,
      relatedEvidenceIds: tc.relatedEvidenceIds,
      reviewComments: tc.reviewComments,
      isAiDrafted: Boolean(tc.isAiDrafted)
    }
  });
});

testcasesRouter.post('/', authenticateUser, requireAuth, (req: Request, res: Response) => {
  const { requirementId, requirementTitle, title, scenario, preconditions, testData, type, priority, steps, sourceReferences, isAiDrafted, projectId } = req.body;
  if (!title || !requirementId) return sendError(res, 'Title and requirementId are required', 400);

  const projId = projectId || (req.user as any)?.projectId || 'PRJ-01';
  if (req.user && !checkProjectAccess(req.user, projId)) {
    return sendError(res, `Bạn không có quyền tạo test case trong dự án "${projId}".`, 403);
  }

  const existing = dbRepository.testCases.getAll();
  const newTc: TestCaseItem & { projectId?: string } = {
    id: `TC-CUSTOM-00${existing.length + 1}`,
    projectId: projId,
    requirementId,
    requirementTitle: requirementTitle || requirementId,
    title,
    scenario: scenario || '',
    preconditions: preconditions || '',
    testData: testData || '',
    type: type || 'Positive',
    priority: priority || 'High',
    status: 'Draft',
    version: 'v1.0',
    sourceReferences: Array.isArray(sourceReferences) ? sourceReferences : [],
    steps: Array.isArray(steps) ? steps : [],
    reviewComments: [],
    relatedEvidenceIds: [],
    isAiDrafted: Boolean(isAiDrafted),
    createdAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
  };

  dbRepository.testCases.upsert(newTc as any);
  sendSuccess(res, newTc, 'Test case created and persisted to SQLite', 201);
});

testcasesRouter.patch('/:id/status', authenticateUser, requireAuth, (req: Request, res: Response) => {
  const { status } = req.body;
  const tc = dbRepository.testCases.getById(req.params.id);
  if (!tc) return sendError(res, 'Test case not found', 404);

  const projId = (tc as any).projectId || (tc as any).project_id || 'PRJ-01';
  if (req.user && !checkProjectAccess(req.user, projId)) {
    return sendError(res, `Bạn không có quyền cập nhật test case thuộc dự án "${projId}".`, 403);
  }

  // BR-AUTH-01: Only Approver/Admin roles in the target project can approve test cases (Condition 3, NEW-11, R4-07)
  if (status === 'Approved') {
    const effectiveRole = req.user ? (getUserRoleInProject(req.user.id, projId) || req.user.role) : null;
    if (!effectiveRole || !['Project Admin', 'Reviewer / Approver', 'PM / Project Lead'].includes(effectiveRole)) {
      return sendError(res, `Permission denied: Vai trò "${effectiveRole || 'QA'}" trong dự án "${projId}" không có quyền phê duyệt test case (Condition 3).`, 403);
    }
  }

  tc.status = status;
  tc.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
  dbRepository.testCases.upsert(tc);
  sendSuccess(res, tc, `Test case transitioned to ${status}`);
});

testcasesRouter.post('/:id/comments', authenticateUser, requireAuth, (req: Request, res: Response) => {
  const { content, decision } = req.body;
  const tc = dbRepository.testCases.getById(req.params.id);
  if (!tc) return sendError(res, 'Test case not found', 404);

  const projId = (tc as any).projectId || (tc as any).project_id || 'PRJ-01';
  if (req.user && !checkProjectAccess(req.user, projId)) {
    return sendError(res, `Bạn không có quyền thêm nhận xét vào test case thuộc dự án "${projId}".`, 403);
  }

  // Enforce role authorization for approval/rejection decisions (R4-07, NEW-11, Condition 3)
  if (decision === 'Approved' || decision === 'Changes Requested') {
    const userRole = req.user ? getUserRoleInProject(req.user.id, projId) : null;
    const allowedRoles = ['Reviewer / Approver', 'PM / Project Lead', 'Project Admin'];
    if (!userRole || !allowedRoles.includes(userRole)) {
      return sendError(
        res,
        `Chỉ có vai trò ${allowedRoles.join(', ')} trong dự án "${projId}" mới có quyền phê duyệt hoặc yêu cầu chỉnh sửa test case (R4-07).`,
        403
      );
    }
  }

  const effectiveRole = req.user ? (getUserRoleInProject(req.user.id, projId) || req.user.role) : 'QA';
  const author = req.user?.name || req.user?.username || 'Reviewer';
  const role = effectiveRole;

  const newComment = {
    id: `RC-0${tc.reviewComments.length + 1}`,
    author: author || 'Reviewer',
    role: role || 'QA',
    content,
    createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
    decision: decision || undefined
  };

  tc.reviewComments.push(newComment);
  if (decision === 'Approved') {
    tc.status = 'Approved';
  } else if (decision === 'Changes Requested') {
    tc.status = 'Draft';
  }
  tc.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);

  dbRepository.testCases.upsert(tc);
  sendSuccess(res, tc, 'Comment and review decision recorded');
});
