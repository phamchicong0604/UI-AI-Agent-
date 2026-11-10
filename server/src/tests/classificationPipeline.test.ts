import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import net from 'net';
import { randomUUID } from 'crypto';
import { app } from '../app.js';
import { db, dbRepository } from '../database/db.js';
import { defaultJobQueue } from '../modules/workflow/jobQueue.js';
import { registerPipelineHandlers } from '../modules/workflow/pipelineWorker.js';
import { signUserSession } from '../common/auth.js';

/**
 * M0-T2: ClassificationScorer wired into the upload pipeline.
 * Every test uploads through the real /documents/upload route and lets the real PIPELINE_RUN handler run.
 */
describe('M0-T2: Deterministic classification in the upload pipeline', () => {
  let server: http.Server;
  let baseUrl: string;
  let testProjectId: string;
  const adminToken = signUserSession({ id: 'usr_admin', username: 'admin', name: 'Alex Nguyen', role: 'Project Admin' });

  // Test plan with a business-rules half: 06_QA must win, 02_Business_Requirements must score >= 0.50.
  // The file name makes detectCategory() guess 02 ("business" is checked before "qa"), so the test proves
  // the scorer, not the provisional guess, decides the final folder.
  const QA_FILE_NAME = 'business_test_plan_qa.md';
  const QA_CONTENT = [
    '# Master Test Plan',
    'This test plan defines the test strategy, every test case and the regression scope for QA.',
    '## Test Strategy',
    'Each test case has acceptance criteria and a defect workflow.',
    '## Test Case Catalogue',
    'Regression test case list with pass/fail status.',
    '## Business Rule Summary',
    'Business rule: a merchant earns a voucher after onboarding.',
    '## User Story Mapping',
    'Each user story links to a business requirement in the BRD.',
    '## BRD Workflow',
    'The business requirement workflow follows the BRD.'
  ].join('\n');

  const uploadFile = async (fileName: string, content: string, category?: string) => {
    const boundary = `----DocQABoundary${randomUUID().replace(/-/g, '')}`;
    const parts = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="projectId"',
      '',
      testProjectId
    ];
    if (category) {
      parts.push(`--${boundary}`, 'Content-Disposition: form-data; name="category"', '', category);
    }
    parts.push(
      `--${boundary}`,
      `Content-Disposition: form-data; name="files"; filename="${fileName}"`,
      'Content-Type: text/markdown',
      '',
      content,
      `--${boundary}--`
    );

    const res = await fetch(`${baseUrl}/api/v1/documents/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${adminToken}`
      },
      body: parts.join('\r\n')
    });
    expect([200, 201]).toContain(res.status);
    const json = (await res.json()) as any;
    expect(json.data.documents.length).toBe(1);
    return json.data.documents[0] as { id: string; category: string; categorySource?: string };
  };

  const drainQueue = async () => {
    for (let i = 0; i < 20; i++) {
      if ((await defaultJobQueue.processNext(5)) === 0) break;
    }
  };

  const reclassifyAudits = (docId: string) =>
    dbRepository.auditEvents.getAll().filter(e => e.entityId === docId && e.action === 'CATEGORY_RECLASSIFIED');

  const pipelineJobCount = (docId: string) =>
    (db.prepare(`
      SELECT COUNT(*) AS n FROM jobs
      WHERE type = 'PIPELINE_RUN' AND json_extract(payload, '$.documentId') = ?
    `).get(docId) as { n: number }).n;

  beforeAll(async () => {
    registerPipelineHandlers();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as net.AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    testProjectId = `PRJ-CLS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    db.prepare("UPDATE users SET must_change_password = 0 WHERE id = 'usr_admin'").run();
    db.prepare(`
      INSERT OR REPLACE INTO projects (id, name, key, description, version, author, members_count, data, created_at, updated_at)
      VALUES (?, 'Classification Test Project', 'CLS', 'Desc', 'v1.0', 'Admin', 1, '{}', datetime('now'), datetime('now'))
    `).run(testProjectId);
    db.prepare("INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, 'usr_admin', 'Project Admin', datetime('now'))")
      .run(`pm_${testProjectId}_admin`, testProjectId);
  });

  it('AUTO upload: document ends in the scorer folder with secondary categories and a system audit event', async () => {
    const created = await uploadFile(QA_FILE_NAME, QA_CONTENT);
    // Provisional value from detectCategory() before the pipeline runs
    expect(created.category).toBe('02_Business_Requirements');
    expect(created.categorySource).toBe('AUTO');

    await drainQueue();

    const doc = dbRepository.documents.getById(created.id)!;
    expect(doc.category).toBe('06_QA');
    expect(doc.categorySource).toBe('AUTO');
    expect(doc.classification?.suggestedCategory).toBe('06_QA');
    expect(doc.classification?.isAmbiguous).toBe(false);
    expect(doc.classification?.score).toBeGreaterThanOrEqual(0.75);
    expect(doc.secondaryCategories).toEqual(['02_Business_Requirements']);
    expect(doc.needsHumanReview).toBe(false);

    // The indexed category column (used by folder listing) agrees with the JSON blob
    const row = db.prepare('SELECT category FROM documents WHERE id = ?').get(created.id) as { category: string };
    expect(row.category).toBe('06_QA');

    const version = db.prepare('SELECT status FROM document_versions WHERE document_id = ?').get(created.id) as { status: string };
    expect(version.status).toBe('REVIEW_REQUIRED');

    const audits = reclassifyAudits(created.id);
    expect(audits.length).toBe(1);
    expect(audits[0].user).toBe('System Worker');
    expect(audits[0].role).toBe('System Worker');
    const details = JSON.parse(audits[0].details as string);
    expect(details.oldCategory).toBe('02_Business_Requirements');
    expect(details.newCategory).toBe('06_QA');
    expect(details.source).toBe('AUTO');

    // Reclassification must not re-enqueue the pipeline
    expect(pipelineJobCount(created.id)).toBe(1);
  });

  it('Ambiguous upload: provisional 01 folder, needsHumanReview set, first in the review queue, cleared by a reviewer', async () => {
    // detectCategory() guesses 06_QA from "plan"; the scorer finds no usable signal (top score < 0.40)
    const created = await uploadFile('weekend_plan.txt', 'Nothing in this note matches any taxonomy signal at all.');
    expect(created.category).toBe('06_QA');

    await drainQueue();

    const doc = dbRepository.documents.getById(created.id)!;
    expect(doc.classification?.isAmbiguous).toBe(true);
    expect(doc.classification!.score).toBeLessThan(0.4);
    expect(doc.category).toBe('01_Project_Overview');
    expect(doc.needsHumanReview).toBe(true);
    expect(doc.secondaryCategories).toEqual([]);
    expect(reclassifyAudits(created.id).length).toBe(1);

    // A second document in the same project with a Critical conflict, i.e. a strictly higher risk score
    const highRiskId = `doc-high-${randomUUID()}`;
    dbRepository.documents.upsert({
      id: highRiskId,
      projectId: testProjectId,
      title: 'High Risk Payment Gateway BRD',
      category: '02_Business_Requirements',
      currentVersion: 'v1.0',
      status: 'Draft',
      author: 'Author B',
      updatedAt: '2026-11-03',
      description: 'Payment logic with conflicts',
      tags: [],
      linkedRequirementsCount: 0,
      versions: []
    });
    const now = new Date().toISOString();
    const unitA = { id: `ku-cls-${randomUUID()}`, projectId: testProjectId, unitType: 'Requirement' as const, content: 'Timeout 15m', subject: 'Timeout', action: 'Set', condition: null, evidenceLevel: 'Explicit' as const, status: 'Draft' as const, createdAt: now, updatedAt: now };
    const unitB = { ...unitA, id: `ku-cls-${randomUUID()}`, content: 'Timeout 30m' };
    dbRepository.knowledgeUnits.create(unitA);
    dbRepository.knowledgeUnits.create(unitB);
    dbRepository.conflicts.create({
      id: `conf-${randomUUID()}`,
      projectId: testProjectId,
      unitAId: unitA.id,
      unitBId: unitB.id,
      conflictType: 'Contradiction',
      severity: 'Critical',
      description: 'Timeout value conflict',
      resolution: 'UNRESOLVED',
      resolvedBy: null,
      resolvedAt: null,
      createdAt: now
    });

    const fetchQueue = async () => {
      const res = await fetch(`${baseUrl}/api/v1/documents/review-queue?projectId=${testProjectId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      expect(res.status).toBe(200);
      return ((await res.json()) as any).data as any[];
    };

    let queue = await fetchQueue();
    const ambiguousItem = queue.find(i => i.document.id === created.id);
    const highRiskItem = queue.find(i => i.document.id === highRiskId);
    expect(highRiskItem.riskResult.riskScore).toBeGreaterThan(ambiguousItem.riskResult.riskScore);
    expect(queue[0].document.id).toBe(created.id);
    expect(queue[0].document.needsHumanReview).toBe(true);

    // Reviewer confirms a category through the existing PATCH route
    const patchRes = await fetch(`${baseUrl}/api/v1/documents/${created.id}/category`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ category: '08_Change_History' })
    });
    expect(patchRes.status).toBe(200);

    const confirmed = dbRepository.documents.getById(created.id)!;
    expect(confirmed.category).toBe('08_Change_History');
    expect(confirmed.needsHumanReview).toBe(false);
    expect(confirmed.categorySource).toBe('USER');
    expect(pipelineJobCount(created.id)).toBe(1);

    queue = await fetchQueue();
    expect(queue[0].document.id).toBe(highRiskId);
  });

  it('Uploader-chosen category is kept and the scorer result is stored only as a suggestion', async () => {
    const created = await uploadFile(QA_FILE_NAME, QA_CONTENT, '04_UI_UX');
    expect(created.category).toBe('04_UI_UX');
    expect(created.categorySource).toBe('USER');

    await drainQueue();

    const doc = dbRepository.documents.getById(created.id)!;
    expect(doc.category).toBe('04_UI_UX');
    expect(doc.categorySource).toBe('USER');
    expect(doc.classification?.suggestedCategory).toBe('06_QA');
    expect(doc.secondaryCategories).toEqual(['02_Business_Requirements']);
    expect(doc.needsHumanReview).toBe(false);
    expect(reclassifyAudits(created.id).length).toBe(0);
  });

  it('does not classify a version that was superseded before the worker ran', async () => {
    const created = await uploadFile(QA_FILE_NAME, QA_CONTENT);
    db.prepare("UPDATE document_versions SET status = 'SUPERSEDED' WHERE document_id = ?").run(created.id);

    await drainQueue();

    const doc = dbRepository.documents.getById(created.id)!;
    expect(doc.category).toBe('02_Business_Requirements');
    expect(doc.classification).toBeUndefined();
    expect(reclassifyAudits(created.id).length).toBe(0);
  });
});
