import { Router, Request, Response } from 'express';
import { sendSuccess } from '../../common/response.js';
import { dbRepository } from '../../database/db.js';

export const traceabilityRouter = Router();

/**
 * GET /api/v1/traceability/matrix
 * Delivers dynamic end-to-end bidirectional traceability query across all tiers
 */
traceabilityRouter.get('/matrix', (req: Request, res: Response) => {
  const documents = dbRepository.documents.getAll();
  const requirements = dbRepository.requirements.getAll();
  const testCases = dbRepository.testCases.getAll();
  const testRuns = dbRepository.testRuns.getAll();
  const bugs = dbRepository.bugs.getAll();

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
