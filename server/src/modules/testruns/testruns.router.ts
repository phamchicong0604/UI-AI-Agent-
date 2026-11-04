import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response.js';
import { TestRunItem } from '../../common/types.js';
import { dbRepository } from '../../database/db.js';
import { authenticateUser, requireAuth, checkProjectAccess } from '../../common/auth.js';

export const testrunsRouter = Router();

testrunsRouter.get('/', authenticateUser, (req: Request, res: Response) => {
  const { projectId } = req.query;
  const targetProjectId = (projectId as string) || (req.user as any)?.projectId;

  if (req.user && targetProjectId && !checkProjectAccess(req.user, targetProjectId)) {
    return sendError(res, `Bạn không có quyền truy cập đợt kiểm thử của dự án "${targetProjectId}".`, 403);
  }

  let runs = dbRepository.testRuns.getAll();
  if (targetProjectId) {
    runs = runs.filter(r => (r as any).projectId === targetProjectId || (r as any).project_id === targetProjectId);
  }
  sendSuccess(res, runs);
});

testrunsRouter.get('/:id', authenticateUser, (req: Request, res: Response) => {
  const run = dbRepository.testRuns.getById(req.params.id);
  if (!run) return sendError(res, 'Test run not found', 404);
  if (req.user && (run as any).projectId && !checkProjectAccess(req.user, (run as any).projectId)) {
    return sendError(res, `Bạn không có quyền truy cập đợt kiểm thử thuộc dự án "${(run as any).projectId}".`, 403);
  }
  sendSuccess(res, run);
});

testrunsRouter.post('/', authenticateUser, requireAuth, (req: Request, res: Response) => {
  const { title, environment, buildVersion, scope, testCaseIds, createdBy, projectId } = req.body;
  if (!title) return sendError(res, 'Title is required', 400);

  const projId = projectId || (req.user as any)?.projectId || 'PRJ-01';
  if (req.user && !checkProjectAccess(req.user, projId)) {
    return sendError(res, `Bạn không có quyền tạo đợt kiểm thử trong dự án "${projId}".`, 403);
  }

  const existing = dbRepository.testRuns.getAll();
  const id = `RUN-${new Date().toISOString().slice(0, 10)}-${existing.length + 1}`;
  const newRun: TestRunItem & { projectId?: string } = {
    id,
    projectId: projId,
    title,
    environment: environment || 'QA',
    buildVersion: buildVersion || 'build-1048',
    scope: scope || '',
    status: 'In Progress',
    createdBy: createdBy || req.user?.name || 'QA Lead',
    createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
    records: Array.isArray(testCaseIds) ? testCaseIds.map((tcId: string) => ({
      testCaseId: tcId,
      testCaseTitle: tcId,
      status: 'Not Run',
      actualResult: '',
      evidenceIds: []
    })) : []
  };

  dbRepository.testRuns.upsert(newRun as any);
  sendSuccess(res, newRun, 'Test run initialized and saved in SQLite', 201);
});

testrunsRouter.post('/:id/execute', authenticateUser, requireAuth, (req: Request, res: Response) => {
  const { testCaseId, status, actualResult, executedBy, evidenceIds } = req.body;
  const run = dbRepository.testRuns.getById(req.params.id);
  if (!run) return sendError(res, 'Test run not found', 404);

  if (req.user && (run as any).projectId && !checkProjectAccess(req.user, (run as any).projectId)) {
    return sendError(res, `Bạn không có quyền thực thi đợt kiểm thử thuộc dự án "${(run as any).projectId}".`, 403);
  }

  let record = run.records.find(r => r.testCaseId === testCaseId);
  if (!record) {
    record = {
      testCaseId,
      testCaseTitle: testCaseId,
      status,
      actualResult: actualResult || '',
      executedBy: executedBy || req.user?.name || 'QA Tester',
      executedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      evidenceIds: Array.isArray(evidenceIds) ? evidenceIds : []
    };
    run.records.push(record);
  } else {
    record.status = status;
    record.actualResult = actualResult;
    record.executedBy = executedBy || req.user?.name || 'QA Tester';
    record.executedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
    if (evidenceIds) record.evidenceIds = evidenceIds;
  }

  dbRepository.testRuns.upsert(run);
  sendSuccess(res, run, 'Execution result saved to SQLite');
});
