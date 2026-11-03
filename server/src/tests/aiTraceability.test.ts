import { describe, it, expect } from 'vitest';
import { dbRepository } from '../database/db.js';
import { computeSha256 } from '../common/crypto.js';

describe('AI Traceability & Governance Tables (E1-T4)', () => {
  it('should have seeded baseline AI skills and version contracts', () => {
    const skills = dbRepository.skills.getAll();
    expect(skills.length).toBeGreaterThanOrEqual(6);

    const intake = dbRepository.skills.getById('SKILL-INTAKE');
    expect(intake).toBeDefined();
    expect(intake?.name).toBe('Intake');

    const versions = dbRepository.skills.getVersions('SKILL-INTAKE');
    expect(versions.length).toBeGreaterThanOrEqual(1);

    const v1 = versions[0];
    expect(v1.version).toBe('1.0.0');
    expect(v1.promptHash.startsWith('sha256:')).toBe(true);
    expect(JSON.parse(v1.inputSchema)).toBeDefined();
    expect(JSON.parse(v1.outputSchema)).toBeDefined();
  });

  it('should support tracking pipeline runs linked to document versions and skill versions', () => {
    const existingVersions = dbRepository.documentVersions.getByDocumentId('DOC-01');
    const docVerId = existingVersions.length > 0 ? existingVersions[0].id : 'DOC-01-v1_0';
    const skillVerId = 'SKILL-INTAKE@1.0.0';
    const runId = 'RUN-TRACE-TEST-001';

    dbRepository.pipelineRuns.upsert({
      id: runId,
      documentVersionId: docVerId,
      skillVersionId: skillVerId,
      modelId: 'gemini-3.8-flash-medium',
      provider: 'google',
      status: 'SUCCESS',
      inputPayload: JSON.stringify({ filename: 'DOC-01.md' }),
      outputPayload: JSON.stringify({ extractedRules: 4 }),
      tokensPrompt: 450,
      tokensCompletion: 180,
      latencyMs: 1250,
      errorMessage: null,
      createdAt: '2026-11-03 10:00:00'
    });

    const run = dbRepository.pipelineRuns.getById(runId);
    expect(run).toBeDefined();
    expect(run?.documentVersionId).toBe(docVerId);
    expect(run?.skillVersionId).toBe(skillVerId);
    expect(run?.modelId).toBe('gemini-3.8-flash-medium');
    expect(run?.tokensPrompt).toBe(450);
    expect(run?.latencyMs).toBe(1250);

    // Verify traceability lookup by document version
    const runsForDoc = dbRepository.pipelineRuns.getByDocumentVersion(docVerId);
    expect(runsForDoc.some(r => r.id === runId)).toBe(true);
  });

  it('should record and retrieve human review decisions', () => {
    const targetId = 'DOC-01-v1_0';
    const decId = `DEC-TEST-${Date.now()}`;

    dbRepository.reviewDecisions.create({
      id: decId,
      targetType: 'document_version',
      targetId,
      decision: 'Approve',
      reviewer: 'Duc Pham (QA Lead)',
      comment: 'Meets all acceptance criteria and cryptographic baseline.',
      createdAt: '2026-11-03 11:00:00'
    });

    const decisions = dbRepository.reviewDecisions.getByTarget('document_version', targetId);
    expect(decisions.length).toBeGreaterThanOrEqual(1);

    const found = decisions.find(d => d.id === decId);
    expect(found).toBeDefined();
    expect(found?.decision).toBe('Approve');
    expect(found?.reviewer).toBe('Duc Pham (QA Lead)');
  });

  it('should manage inter-document relationships (duplicate_of, references)', () => {
    const relId = 'REL-01-02';

    dbRepository.documentRelationships.upsert({
      id: relId,
      sourceDocId: 'DOC-01',
      targetDocId: 'DOC-02',
      relationshipType: 'references',
      confidenceScore: 0.98,
      createdAt: '2026-11-03 12:00:00'
    });

    const relationshipsDoc1 = dbRepository.documentRelationships.getByDocument('DOC-01');
    expect(relationshipsDoc1.length).toBeGreaterThanOrEqual(1);

    const found = relationshipsDoc1.find(r => r.id === relId);
    expect(found).toBeDefined();
    expect(found?.relationshipType).toBe('references');
    expect(found?.confidenceScore).toBe(0.98);
  });
});
