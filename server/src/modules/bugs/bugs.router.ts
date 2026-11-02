import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response.js';
import { BugItem } from '../../common/types.js';
import { dbRepository } from '../../database/db.js';

export const bugsRouter = Router();

bugsRouter.get('/', (req: Request, res: Response) => {
  const { status, severity } = req.query;
  let result = dbRepository.bugs.getAll();
  if (status && status !== 'ALL') result = result.filter(b => b.status === status);
  if (severity && severity !== 'ALL') result = result.filter(b => b.severity === severity);
  sendSuccess(res, result);
});

bugsRouter.post('/', (req: Request, res: Response) => {
  const { title, description, severity, priority, assignee, environment, buildVersion, stepsToReproduce, expectedResult, actualResult, linkedRequirementId, linkedTestCaseId, linkedTestRunId, linkedEvidenceIds } = req.body;
  if (!title) return sendError(res, 'Title is required', 400);

  const existing = dbRepository.bugs.getAll();
  const newBug: BugItem = {
    id: `BUG-00${existing.length + 1}`,
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

  dbRepository.bugs.upsert(newBug);
  sendSuccess(res, newBug, 'Defect logged and persisted to SQLite', 201);
});

bugsRouter.patch('/:id/status', (req: Request, res: Response) => {
  const { status } = req.body;
  const bug = dbRepository.bugs.getById(req.params.id);
  if (!bug) return sendError(res, 'Bug not found', 404);

  bug.status = status;
  bug.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
  dbRepository.bugs.upsert(bug);
  sendSuccess(res, bug, `Bug status updated to ${status}`);
});
