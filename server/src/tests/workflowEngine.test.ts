import { describe, it, expect, beforeEach } from 'vitest';
import { db, dbRepository } from '../database/db.js';
import { WorkflowEngine, WorkflowTransitionError } from '../modules/workflow/workflowEngine.js';
import { DocumentItem } from '../common/types.js';

describe('Workflow Engine & State Transitions (E3-T3)', () => {
  const engine = new WorkflowEngine();
  const testDocId = `DOC-WF-${Date.now()}`;

  beforeEach(() => {
    // Seed initial test document
    const doc: DocumentItem = {
      id: testDocId,
      projectId: 'PRJ-01',
      title: 'Workflow Test Document',
      category: '01_Project_Overview',
      currentVersion: 'v1.0',
      status: 'Draft',
      author: 'QA Lead',
      updatedAt: '2026-11-03 10:00',
      description: 'Document for workflow testing',
      tags: ['Test'],
      linkedRequirementsCount: 0,
      versions: []
    };
    dbRepository.documents.upsert(doc);

    db.prepare(`
      INSERT OR REPLACE INTO document_versions (id, document_id, version_no, file_id, extracted_content, status, change_summary, created_by, created_at)
      VALUES (?, ?, 'v1.0', NULL, 'Baseline content', 'UPLOADED', 'Initial', 'QA Lead', '2026-11-03')
    `).run(`${testDocId}-v1.0`, testDocId);
  });

  it('should validate allowed state transitions and block invalid state transitions', async () => {
    // 1. Valid transition: UPLOADED -> FILE_PROCESSING
    await expect(engine.transition({
      documentId: testDocId,
      fromState: 'UPLOADED',
      toState: 'FILE_PROCESSING',
      actor: 'System Worker',
      role: 'System Worker',
      reason: 'Job started'
    })).resolves.not.toThrow();

    // 2. Invalid transition: FILE_PROCESSING -> ORGANIZED (cannot jump stages without review/validation)
    await expect(engine.transition({
      documentId: testDocId,
      fromState: 'FILE_PROCESSING',
      toState: 'ORGANIZED',
      actor: 'Tester',
      role: 'Reviewer / Approver'
    })).rejects.toThrow(WorkflowTransitionError);
  });

  it('should enforce role-based access control for transitions (e.g. non-approver cannot approve)', async () => {
    // Set version state to REVIEW_REQUIRED
    db.prepare("UPDATE document_versions SET status = 'REVIEW_REQUIRED' WHERE document_id = ?").run(testDocId);

    // Document Author trying to approve document -> Rejection
    await expect(engine.transition({
      documentId: testDocId,
      fromState: 'REVIEW_REQUIRED',
      toState: 'ORGANIZED',
      actor: 'Doc Author',
      role: 'Document Author',
      reason: 'Author trying to self-approve'
    })).rejects.toThrow(/không có quyền/);

    // Reviewer / Approver approving document -> Success
    await expect(engine.transition({
      documentId: testDocId,
      fromState: 'REVIEW_REQUIRED',
      toState: 'ORGANIZED',
      actor: 'Senior Reviewer',
      role: 'Reviewer / Approver',
      reason: 'Requirements and rules validated by QA team'
    })).resolves.not.toThrow();

    const updatedDoc = dbRepository.documents.getById(testDocId);
    expect(updatedDoc?.status).toBe('Approved');
  });

  it('should create immutable chained AuditEvent on every transition', async () => {
    const initialAuditCount = dbRepository.auditEvents.getAll().length;

    db.prepare("UPDATE document_versions SET status = 'VALIDATION' WHERE document_id = ?").run(testDocId);

    await engine.transition({
      documentId: testDocId,
      fromState: 'VALIDATION',
      toState: 'REVIEW_REQUIRED',
      actor: 'Validation Worker',
      role: 'System Worker',
      reason: 'Semantic score 0.84 < 0.90, requires human review'
    });

    const audits = dbRepository.auditEvents.getAll();
    expect(audits.length).toBe(initialAuditCount + 1);

    const latest = audits[0];
    expect(latest.action).toBe('WORKFLOW_TRANSITION');
    expect(latest.entityId).toBe(testDocId);
    const details = typeof latest.details === 'string' ? JSON.parse(latest.details) : latest.details;
    expect(details.fromState).toBe('VALIDATION');
    expect(details.toState).toBe('REVIEW_REQUIRED');
    expect(latest.eventHash).toBeDefined();
    expect(latest.previousEventHash).toBeDefined();
  });

  it('should supersede previous versions when a new version is uploaded (E3-T3.3)', async () => {
    // Add v1.0 and v1.1 in REVIEW_REQUIRED
    db.prepare(`
      INSERT OR REPLACE INTO document_versions (id, document_id, version_no, file_id, extracted_content, status, change_summary, created_by, created_at)
      VALUES (?, ?, 'v1.1', NULL, 'New content', 'UPLOADED', 'New revision', 'Author', '2026-11-03')
    `).run(`${testDocId}-v1.1`, testDocId);

    const supersededCount = await engine.supersedePreviousVersions(testDocId, 'v1.1', 'Author');
    expect(supersededCount).toBeGreaterThanOrEqual(1);

    const v1 = db.prepare("SELECT status FROM document_versions WHERE id = ?").get(`${testDocId}-v1.0`) as any;
    expect(v1.status).toBe('SUPERSEDED');
  });

  it('should update document category with stage isolation without re-triggering Understanding (E3-T3 AC)', async () => {
    const initialAudits = dbRepository.auditEvents.getAll().length;

    await engine.updateDocumentCategory(testDocId, '03_System_Requirements', 'Lead BA');

    const updatedDoc = dbRepository.documents.getById(testDocId);
    expect(updatedDoc?.category).toBe('03_System_Requirements');

    // Verify audit event records stage isolation note
    const audits = dbRepository.auditEvents.getAll();
    expect(audits.length).toBe(initialAudits + 1);
    expect(audits[0].action).toBe('CATEGORY_RECLASSIFIED');
    const lastDetails = typeof audits[0].details === 'string' ? JSON.parse(audits[0].details) : audits[0].details;
    expect(lastDetails.note).toContain('Stage Understanding is preserved');
  });
});
