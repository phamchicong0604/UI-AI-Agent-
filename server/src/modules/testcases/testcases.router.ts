import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response.js';
import { TestCaseItem } from '../../common/types.js';
import { dbRepository } from '../../database/db.js';
import { authenticateUser, requireAuth } from '../../common/auth.js';

export const testcasesRouter = Router();

testcasesRouter.get('/', (req: Request, res: Response) => {
  const { status, type, priority, requirementId } = req.query;
  let result = dbRepository.testCases.getAll();

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
testcasesRouter.get('/:id/workspace', (req: Request, res: Response) => {
  const tc = dbRepository.testCases.getById(req.params.id);
  if (!tc) return sendError(res, 'Test case not found', 404);

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

testcasesRouter.post('/', (req: Request, res: Response) => {
  const { requirementId, requirementTitle, title, scenario, preconditions, testData, type, priority, steps, sourceReferences, isAiDrafted } = req.body;
  if (!title || !requirementId) return sendError(res, 'Title and requirementId are required', 400);

  const existing = dbRepository.testCases.getAll();
  const newTc: TestCaseItem = {
    id: `TC-CUSTOM-00${existing.length + 1}`,
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

  dbRepository.testCases.upsert(newTc);
  sendSuccess(res, newTc, 'Test case created and persisted to SQLite', 201);
});

testcasesRouter.patch('/:id/status', authenticateUser, requireAuth, (req: Request, res: Response) => {
  const { status } = req.body;
  const tc = dbRepository.testCases.getById(req.params.id);
  if (!tc) return sendError(res, 'Test case not found', 404);

  // BR-AUTH-01: Only Approver/Admin roles can approve test cases (NEW-11)
  if (status === 'Approved') {
    const userRole = req.user?.role;
    if (!userRole || !['Project Admin', 'Reviewer / Approver', 'PM / Project Lead'].includes(userRole)) {
      return sendError(res, 'Permission denied: Approver role required to approve test cases', 403);
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

  const author = req.user?.name || req.body.author || 'Reviewer';
  const role = req.user?.role || req.body.role || 'QA';

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
