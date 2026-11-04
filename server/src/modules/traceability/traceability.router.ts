import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response.js';
import { dbRepository } from '../../database/db.js';
import { authenticateUser, checkProjectAccess } from '../../common/auth.js';

export const traceabilityRouter = Router();

/**
 * GET /api/v1/traceability/matrix
 * Delivers dynamic end-to-end bidirectional traceability query across all tiers
 */
traceabilityRouter.get('/matrix', authenticateUser, (req: Request, res: Response) => {
  const { projectId } = req.query;
  const targetProjectId = (projectId as string) || (req.user as any)?.projectId;

  if (req.user && targetProjectId && !checkProjectAccess(req.user, targetProjectId)) {
    return sendError(res, `Bạn không có quyền truy cập ma trận liên kết của dự án "${targetProjectId}".`, 403);
  }

  let documents = dbRepository.documents.getAll(targetProjectId);
  let requirements = dbRepository.requirements.getAll(targetProjectId);
  let testCases = dbRepository.testCases.getAll();
  let testRuns = dbRepository.testRuns.getAll();
  let bugs = dbRepository.bugs.getAll();

  if (targetProjectId) {
    testCases = testCases.filter(t => (t as any).projectId === targetProjectId || (t as any).project_id === targetProjectId);
    testRuns = testRuns.filter(r => (r as any).projectId === targetProjectId || (r as any).project_id === targetProjectId);
    bugs = bugs.filter(b => (b as any).projectId === targetProjectId || (b as any).project_id === targetProjectId);
  }

  // Compute coverage gaps (AC-08)
  const rows = requirements.map(reqItem => {
    const linkedTCs = testCases.filter(tc => tc.requirementId === reqItem.id);
    const sourceDoc = documents.find(d => reqItem.sourceReferences.some(s => s.documentId === d.id));
    
    // Check if test cases have been executed in any test run
    const executionResults = linkedTCs.map(tc => {
      for (const run of testRuns) {
        const record = run.records.find(r => r.testCaseId === tc.id);
        if (record) return { runId: run.id, status: record.status, bugId: record.bugId };
      }
      return { runId: null, status: 'Not Run' };
    });

    const linkedBugs = bugs.filter(b => b.linkedRequirementId === reqItem.id || linkedTCs.some(tc => tc.id === b.linkedTestCaseId));

    const isCovered = linkedTCs.length > 0;
    const isPassing = executionResults.some(e => e.status === 'Pass');
    const hasActiveBug = linkedBugs.some(b => b.status === 'Open' || b.status === 'In Progress');

    return {
      requirementId: reqItem.id,
      requirementTitle: reqItem.title,
      requirementStatus: reqItem.status,
      priority: reqItem.priority,
      sourceDocument: sourceDoc ? { id: sourceDoc.id, title: sourceDoc.title, version: sourceDoc.currentVersion } : null,
      testCasesCount: linkedTCs.length,
      testCases: linkedTCs.map(tc => ({ id: tc.id, title: tc.title, status: tc.status })),
      executionStatus: executionResults.length > 0 ? executionResults[0].status : 'Not Run',
      linkedBugsCount: linkedBugs.length,
      linkedBugs: linkedBugs.map(b => ({ id: b.id, title: b.title, severity: b.severity, status: b.status })),
      hasCoverageGap: !isCovered,
      health: !isCovered ? 'Missing Tests' : hasActiveBug ? 'Defect Blocked' : isPassing ? 'Healthy' : 'Pending Verification'
    };
  });

  const totalReqs = requirements.length;
  const coveredReqs = rows.filter(r => !r.hasCoverageGap).length;
  const coverageRate = totalReqs > 0 ? Math.round((coveredReqs / totalReqs) * 100) : 0;

  sendSuccess(res, {
    pipeline: 'Document -> Requirement -> TestCase -> Run -> Evidence -> Bug',
    coverageGoal: '100% of approved requirements must link to at least 1 verified test case',
    metrics: {
      totalDocuments: documents.length,
      totalRequirements: totalReqs,
      coveredRequirements: coveredReqs,
      gapCount: totalReqs - coveredReqs,
      coverageRate: `${coverageRate}%`,
      totalTestCases: testCases.length,
      totalBugs: bugs.length
    },
    lineageRows: rows
  });
});
