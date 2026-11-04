import { describe, it, expect } from 'vitest';
import { RequirementItem, TestCaseItem, TestRunItem, BugItem, DocumentItem, EvidenceItem } from '../types';
import { buildTraceabilityRows } from '../components/traceability/TraceabilityView';

describe('Traceability Matrix Logic & Verification (TraceabilityView)', () => {
  const mockDocs: DocumentItem[] = [
    {
      id: 'DOC-01',
      projectId: 'PRJ-01',
      title: 'Auth Spec',
      description: 'Authentication Specification',
      category: '02_Business_Requirements',
      currentVersion: 'v1.0',
      status: 'Approved',
      author: 'BA Team',
      updatedAt: '2026-11-04',
      contentMarkdown: '# Auth Spec',
      tags: ['auth'],
      linkedRequirementsCount: 2,
      versions: []
    }
  ];

  const mockRequirements: RequirementItem[] = [
    {
      id: 'REQ-01',
      title: 'Login via PBKDF2',
      description: 'System must hash passwords with PBKDF2',
      type: 'Functional',
      priority: 'High',
      businessRules: [],
      acceptanceCriteria: [],
      sourceReferences: [{ documentId: 'DOC-01', documentTitle: 'Auth Spec', version: 'v1.0', section: '1.1' }],
      status: 'Approved',
      owner: 'BA',
      approver: 'Lead',
      createdAt: '2026-11-04',
      updatedAt: '2026-11-04'
    },
    {
      id: 'REQ-02',
      title: 'Password change enforcement',
      description: 'Must change password on first login',
      type: 'Technical',
      priority: 'Critical',
      businessRules: [],
      acceptanceCriteria: [],
      sourceReferences: [{ documentId: 'DOC-01', documentTitle: 'Auth Spec', version: 'v1.0', section: '1.2' }],
      status: 'Approved',
      owner: 'BA',
      approver: 'Lead',
      createdAt: '2026-11-04',
      updatedAt: '2026-11-04'
    }
  ];

  const mockTestCases: TestCaseItem[] = [
    {
      id: 'TC-01',
      requirementId: 'REQ-01',
      requirementTitle: 'Login via PBKDF2',
      title: 'Verify PBKDF2 hashing',
      scenario: 'Valid user authentication',
      preconditions: 'None',
      testData: 'username: admin',
      type: 'Security',
      priority: 'High',
      status: 'Approved',
      version: 'v1.0',
      sourceReferences: [],
      steps: [],
      reviewComments: [],
      relatedEvidenceIds: ['EVD-01'],
      createdAt: '2026-11-04',
      updatedAt: '2026-11-04'
    }
  ];

  const mockTestRuns: TestRunItem[] = [
    {
      id: 'TR-01',
      title: 'Regression Suite',
      environment: 'STG',
      buildVersion: 'v1.0.0',
      scope: 'Auth',
      status: 'Completed',
      createdBy: 'Tester',
      createdAt: '2026-11-04',
      records: [
        {
          testCaseId: 'TC-01',
          testCaseTitle: 'Verify PBKDF2 hashing',
          status: 'Pass',
          actualResult: 'Passed successfully',
          executedAt: '2026-11-04',
          evidenceIds: ['EVD-01']
        }
      ]
    }
  ];

  const mockBugs: BugItem[] = [
    {
      id: 'BUG-01',
      title: 'Password salt too short',
      description: 'Salt is less than 16 bytes',
      severity: 'Major',
      priority: 'High',
      status: 'Open',
      assignee: 'Dev',
      environment: 'STG',
      buildVersion: 'v1.0.0',
      stepsToReproduce: ['Login with seed password'],
      expectedResult: 'Salt generated at 16 bytes minimum',
      actualResult: 'Salt generated at 8 bytes',
      linkedRequirementId: 'REQ-01',
      linkedTestCaseId: 'TC-01',
      linkedEvidenceIds: [],
      createdAt: '2026-11-04',
      updatedAt: '2026-11-04'
    }
  ];

  const mockEvidences: EvidenceItem[] = [
    {
      id: 'EVD-01',
      title: 'PBKDF2 SHA512 Test Log',
      description: 'Execution logs',
      type: 'Log',
      environment: 'STG',
      buildVersion: 'v1.0.0',
      status: 'Verified',
      storageRef: 'files/log.txt',
      fileSize: '12 KB',
      storageChecksum: 'sha256:abc',
      createdBy: 'Tester',
      createdAt: '2026-11-04',
      links: []
    }
  ];

  it('correctly maps requirements to linked documents, test cases, and runs via buildTraceabilityRows (R5-07)', () => {
    const rows = buildTraceabilityRows(
      mockRequirements,
      mockDocs,
      mockTestCases,
      mockTestRuns,
      mockEvidences,
      mockBugs
    );

    expect(rows.length).toBe(2);

    // REQ-01 has 1 test case, 1 run, 1 bug, no gap
    const req1 = rows.find(r => r.requirement.id === 'REQ-01');
    expect(req1).toBeDefined();
    expect(Boolean(req1?.document)).toBe(true);
    expect(req1?.document?.id).toBe('DOC-01');
    expect(req1?.testCases.length).toBe(1);
    expect(req1?.executions.length).toBe(1);
    expect(req1?.bugs.length).toBe(1);
    expect(req1?.hasGap).toBe(false);
    expect(req1?.hasBugs).toBe(true);

    // REQ-02 has 0 test cases -> gap detected
    const req2 = rows.find(r => r.requirement.id === 'REQ-02');
    expect(req2).toBeDefined();
    expect(Boolean(req2?.document)).toBe(true);
    expect(req2?.testCases.length).toBe(0);
    expect(req2?.hasGap).toBe(true);
    expect(req2?.hasBugs).toBe(false);
  });

  it('identifies coverage gap accurately for unlinked requirements via production logic', () => {
    const rows = buildTraceabilityRows(
      mockRequirements,
      mockDocs,
      mockTestCases,
      mockTestRuns,
      mockEvidences,
      mockBugs
    );

    const gapRows = rows.filter(r => r.hasGap);
    expect(gapRows.length).toBe(1);
    expect(gapRows[0].requirement.id).toBe('REQ-02');
  });

  it('filters matrix rows by GAPS_ONLY and WITH_BUGS modes on production engine output', () => {
    const rows = buildTraceabilityRows(
      mockRequirements,
      mockDocs,
      mockTestCases,
      mockTestRuns,
      mockEvidences,
      mockBugs
    );

    const gaps = rows.filter(r => r.hasGap);
    expect(gaps.length).toBe(1);
    expect(gaps[0].requirement.id).toBe('REQ-02');

    const withBugs = rows.filter(r => r.hasBugs);
    expect(withBugs.length).toBe(1);
    expect(withBugs[0].requirement.id).toBe('REQ-01');
  });
});
