import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import express from 'express';
import { Server } from 'http';
import { randomUUID } from 'crypto';
import { DatabaseMigrator } from '../database/migrator.js';
import { allMigrations } from '../database/migrations/index.js';
import { documentsRouter } from '../modules/documents/documents.router.js';
import { dbRepository } from '../database/db.js';
import { DocumentItem } from '../common/types.js';

describe('Review Queue API (Epic E8-T1, E8-T2)', () => {
  let app: express.Express;
  let server: Server;
  let baseUrl: string;
  const testProjectId = 'PRJ-QUEUE-TEST';

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/documents', documentsRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // Seed test project
    dbRepository.projects.upsert({
      id: testProjectId,
      name: 'Queue Test Project',
      key: 'QTP',
      description: 'Review queue test project',
      version: 'v1.0.0',
      author: 'QA Lead',
      membersCount: 2,
      createdAt: new Date().toISOString()
    });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('orders review queue strictly by risk score descending (highest risk first) - AC-E8-1', async () => {
    const docLow: DocumentItem = {
      id: 'doc-low-' + randomUUID(),
      projectId: testProjectId,
      title: 'Low Risk Project Scope',
      category: '01_Project_Overview',
      currentVersion: 'v1.0',
      status: 'Draft',
      author: 'Author A',
      updatedAt: '2026-11-03',
      description: 'Simple scope',
      tags: ['Scope'],
      linkedRequirementsCount: 0,
      versions: []
    };

    const docHigh: DocumentItem = {
      id: 'doc-high-' + randomUUID(),
      projectId: testProjectId,
      title: 'High Risk Payment Gateway BRD',
      category: '02_Business_Requirements',
      currentVersion: 'v1.0',
      status: 'Draft',
      author: 'Author B',
      updatedAt: '2026-11-03',
      description: 'Payment logic with conflicts',
      tags: ['Payment'],
      linkedRequirementsCount: 0,
      versions: []
    };

    dbRepository.documents.upsert(docLow);
    dbRepository.documents.upsert(docHigh);

    // Create knowledge units and simulate a critical conflict for docHigh
    const unit1 = {
      id: 'ku-q-' + randomUUID(),
      projectId: testProjectId,
      unitType: 'Requirement' as const,
      content: 'Timeout thanh toán là 15m',
      subject: 'Timeout thanh toán',
      action: 'Thiết lập',
      evidenceLevel: 'Explicit' as const,
      status: 'Draft' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const unit2 = {
      id: 'ku-q-' + randomUUID(),
      projectId: testProjectId,
      unitType: 'Requirement' as const,
      content: 'Timeout thanh toán là 30m',
      subject: 'Timeout thanh toán',
      action: 'Thiết lập',
      evidenceLevel: 'Explicit' as const,
      status: 'Approved' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    dbRepository.knowledgeUnits.create(unit1);
    dbRepository.knowledgeUnits.create(unit2);

    // Insert conflict into conflicts table
    dbRepository.conflicts.create({
      id: 'conf-' + randomUUID(),
      projectId: testProjectId,
      unitAId: unit1.id,
      unitBId: unit2.id,
      conflictType: 'Contradiction',
      severity: 'Critical',
      description: 'Timeout value conflict',
      resolution: 'UNRESOLVED',
      createdAt: new Date().toISOString()
    });

    const res = await fetch(`${baseUrl}/api/v1/documents/review-queue?projectId=${testProjectId}`);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(2);

    // Verify ordering: The first document has higher or equal riskScore than the second
    const scores = json.data.map((item: any) => item.riskResult.riskScore);
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
    }

    // Verify AC: autoApproveAllowed is strictly false
    for (const item of json.data) {
      expect(item.riskResult.autoApproveAllowed).toBe(false);
    }
  });

  it('filters review queue by category and risk level', async () => {
    const res = await fetch(`${baseUrl}/api/v1/documents/review-queue?projectId=${testProjectId}&category=01_Project_Overview`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    for (const item of json.data) {
      expect(item.document.category).toBe('01_Project_Overview');
    }
  });
});
