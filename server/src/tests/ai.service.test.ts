import { describe, it, expect } from 'vitest';
import { AiService } from '../modules/ai/ai.service.js';
import { RequirementItem, DocumentItem, TestCaseItem } from '../common/types.js';

describe('AI Copilot Service (Proposal Section 8 & 8.1 Governance)', () => {
  const aiService = new AiService();

  const mockReq: RequirementItem = {
    id: 'REQ-AUTH-TEST',
    title: 'Two-Factor Authentication for Admin Accounts',
    description: 'System must require TOTP code when Admin logs in from an unknown device IP.',
    type: 'Functional',
    priority: 'Critical',
    businessRules: [
      'BR-AUTH-10: Max 3 failed TOTP attempts before 15-minute lockout.'
    ],
    acceptanceCriteria: [
      { id: 'AC-01', text: 'Prompt user for 6-digit TOTP code', completed: true },
      { id: 'AC-02', text: 'Lock account for 15 minutes after 3 invalid inputs', completed: true }
    ],
    sourceReferences: [
      {
        documentId: 'DOC-02',
        documentTitle: 'BRD - Authentication & RBAC',
        version: 'v1.2',
        section: 'Section 4.3'
      }
    ],
    status: 'Approved',
    owner: 'Sarah Le (Lead BA)',
    approver: 'Minh Tran (PM)',
    createdAt: '2026-11-01',
    updatedAt: '2026-11-02 10:00'
  };

  const mockDoc: DocumentItem = {
    id: 'DOC-02',
    title: 'BRD - Authentication & RBAC',
    category: '02_Business_Requirements',
    currentVersion: 'v1.2',
    status: 'Approved',
    author: 'Sarah Le',
    updatedAt: '2026-11-02 09:15',
    description: 'Security requirements and business rules',
    tags: ['Auth', 'RBAC'],
    linkedRequirementsCount: 1,
    versions: []
  };

  it('should generate grounded test cases adhering to strict AI governance rules', async () => {
    const result = await aiService.generateGroundedDrafts({
      requirement: mockReq,
      sourceDoc: mockDoc,
      userPrompt: 'Test standard positive and boundary conditions'
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result.testCases)).toBe(true);
    expect(result.testCases.length).toBeGreaterThan(0);

    // Rule 1: All generated test cases MUST have status = 'Draft'
    result.testCases.forEach((tc: TestCaseItem) => {
      expect(tc.status).toBe('Draft');
      expect(tc.isAiDrafted).toBe(true);
      expect(tc.steps.length).toBeGreaterThan(0);

      // Rule 2: Must have SHA-256 citation hash grounded in source document
      expect(tc.sourceReferences.length).toBeGreaterThan(0);
      tc.sourceReferences.forEach((ref: any) => {
        expect(ref.citationHash).toBeDefined();
        expect(ref.citationHash.startsWith('sha256:')).toBe(true);
      });
    });

    // Rule 3: Must surface unconfirmed assumptions
    expect(Array.isArray(result.unconfirmedAssumptions)).toBe(true);
  });

  it('should compute change impact blast-radius correctly when document is revised', async () => {
    const mockTestCases: TestCaseItem[] = [
      {
        id: 'TC-01',
        requirementId: 'REQ-AUTH-TEST',
        requirementTitle: 'Two-Factor Authentication for Admin Accounts',
        title: 'Verify valid TOTP submission',
        scenario: 'User enters valid 6-digit code',
        preconditions: '',
        testData: '',
        type: 'Positive',
        priority: 'Critical',
        status: 'Approved',
        version: 'v1.0',
        sourceReferences: [],
        steps: [],
        reviewComments: [],
        relatedEvidenceIds: [],
        createdAt: '2026-11-01',
        updatedAt: '2026-11-01'
      }
    ];

    const impact = await aiService.analyzeChangeImpact({
      documentId: 'DOC-02',
      requirements: [mockReq],
      testCases: mockTestCases
    });

    expect(impact).toBeDefined();
    expect(impact.revisedDocument).toBe('DOC-02');
    expect(impact.affectedRequirements).toContain('REQ-AUTH-TEST');
    expect(impact.affectededTestCaseIds).toContain('TC-01');
    expect(Array.isArray(impact.actionPlan)).toBe(true);
  });
});
