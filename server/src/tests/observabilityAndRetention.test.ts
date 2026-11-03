import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { DatabaseMigrator } from '../database/migrator.js';
import { allMigrations } from '../database/migrations/index.js';
import { ObservabilityService } from '../modules/ai/observabilityService.js';
import { RetentionService } from '../modules/documents/retentionService.js';
import { defaultFileStore } from '../common/fileStore.js';
import { dbRepository } from '../database/db.js';

describe('Observability & Retention (Epic E10)', () => {
  let db: InstanceType<typeof Database>;
  const testProjectId = 'prj-obs-test';

  beforeEach(() => {
    db = new Database(':memory:');
    const migrator = new DatabaseMigrator(db, allMigrations);
    migrator.runPendingMigrations();

    // Seed test project
    db.prepare(`
      INSERT INTO projects (id, name, key, description, version, author, members_count, ai_policy, data, created_at, updated_at)
      VALUES (?, 'Observability Project', 'OBS', 'Testing observability & retention', 'v1.0.0', 'Lead QA', 2, 'ALLOW_EXTERNAL', '{}', datetime('now'), datetime('now'))
    `).run(testProjectId);
  });

  afterEach(() => {
    db.close();
  });

  describe('ObservabilityService (E10-T1, E10-T2)', () => {
    it('aggregates tokens, latency, cost estimate, and calculates Human Correction Rate', () => {
      // 1. Seed a skill and skill version
      const skillRow = db.prepare(`SELECT id FROM skills WHERE name = 'Extraction'`).get() as any;
      const skillId = skillRow?.id || 'SKILL-EXTRACTION';
      const skillVerId = 'sv-extract-' + randomUUID();

      db.prepare(`
        INSERT INTO skill_versions (id, skill_id, version, prompt_template, prompt_hash, input_schema, output_schema, model_recommended, created_at)
        VALUES (?, ?, 'v1.0.0', 'Extract rules', 'hash123', '{}', '{}', 'gemini-2.0-flash', datetime('now'))
      `).run(skillVerId, skillId);

      // Seed a document and version
      const docId = 'doc-obs-1';
      const docVerId = 'dv-obs-1';
      db.prepare(`
        INSERT INTO documents (id, project_id, category, status, updated_at, data)
        VALUES (?, ?, '02_Business_Requirements', 'Draft', datetime('now'), '{}')
      `).run(docId, testProjectId);

      db.prepare(`
        INSERT INTO document_versions (id, document_id, version_no, status, created_by, created_at)
        VALUES (?, ?, 'v1.0', 'Draft', 'Tester', datetime('now'))
      `).run(docVerId, docId);

      // 2. Seed 2 pipeline runs (1 completed with 1000 tokens, 1 failed)
      const run1Id = 'run-' + randomUUID();
      const run2Id = 'run-' + randomUUID();
      db.prepare(`
        INSERT INTO pipeline_runs (id, document_version_id, skill_version_id, model_id, provider, status, tokens_prompt, tokens_completion, latency_ms, created_at)
        VALUES 
          (?, ?, ?, 'gemini-2.0-flash', 'google', 'COMPLETED', 800, 200, 350, datetime('now')),
          (?, ?, ?, 'gemini-2.0-flash', 'google', 'FAILED', 0, 0, 100, datetime('now'))
      `).run(run1Id, docVerId, skillVerId, run2Id, docVerId, skillVerId);

      // 3. Seed review decisions: 1 Approve, 1 Reject (Human Correction Rate = 50%)
      db.prepare(`
        INSERT INTO review_decisions (id, target_type, target_id, decision, reviewer, created_at)
        VALUES 
          ('rd-1', 'PipelineRun', ?, 'Approve', 'Reviewer A', datetime('now')),
          ('rd-2', 'PipelineRun', ?, 'Reject', 'Reviewer B', datetime('now'))
      `).run(run1Id, docVerId);

      const report = ObservabilityService.getObservabilityReport(db);

      expect(report.summary.totalRuns).toBe(2);
      expect(report.summary.successRuns).toBe(1);
      expect(report.summary.failedRuns).toBe(1);
      expect(report.summary.overallErrorRate).toBe(50.0);
      expect(report.summary.totalTokensPrompt).toBe(800);
      expect(report.summary.totalTokensCompletion).toBe(200);
      expect(report.summary.totalTokens).toBe(1000);
      expect(report.summary.totalCostEstimateUsd).toBeGreaterThan(0);

      // Verify Human Correction Rate (E10-T2)
      const correction = report.humanCorrectionRates.find(c => c.skillVersionId === skillVerId);
      expect(correction).toBeDefined();
      expect(correction?.totalDecisions).toBe(2);
      expect(correction?.rejectedCount).toBe(1);
      expect(correction?.correctionRate).toBe(50.0);
    });
  });

  describe('RetentionService (E10-T3)', () => {
    it('cleans up pipeline runs older than retention period', () => {
      const skillVerId = 'sv-ret-v1';
      db.prepare(`
        INSERT OR IGNORE INTO skills (id, name, created_at) VALUES ('skill-ret', 'RetSkill', datetime('now'))
      `).run();
      db.prepare(`
        INSERT INTO skill_versions (id, skill_id, version, prompt_template, prompt_hash, input_schema, output_schema, created_at)
        VALUES (?, 'skill-ret', 'v1.0.0', 't', 'h', '{}', '{}', datetime('now'))
      `).run(skillVerId);

      const docVerId = 'dv-ret-1';
      db.prepare(`
        INSERT INTO documents (id, project_id, category, status, updated_at, data)
        VALUES ('doc-ret', ?, '01_Project_Overview', 'Draft', datetime('now'), '{}')
      `).run(testProjectId);
      db.prepare(`
        INSERT INTO document_versions (id, document_id, version_no, status, created_by, created_at)
        VALUES (?, 'doc-ret', 'v1.0', 'Draft', 'Tester', datetime('now'))
      `).run(docVerId);

      // Seed 1 expired run (40 days old) and 1 fresh run (1 day old)
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
      const freshDate = new Date().toISOString();

      db.prepare(`
        INSERT INTO pipeline_runs (id, document_version_id, skill_version_id, model_id, provider, status, created_at)
        VALUES 
          ('run-old', ?, ?, 'gemini-flash', 'google', 'COMPLETED', ?),
          ('run-fresh', ?, ?, 'gemini-flash', 'google', 'COMPLETED', ?)
      `).run(docVerId, skillVerId, oldDate, docVerId, skillVerId, freshDate);

      const cleanup = RetentionService.cleanExpiredRuns(db, 30);
      expect(cleanup.deletedRunsCount).toBe(1);

      const remaining = db.prepare('SELECT count(*) as count FROM pipeline_runs').get() as any;
      expect(remaining.count).toBe(1);
    });

    it('cascade deletes project files on disk, removes db records, and creates AuditEvent', async () => {
      // 1. Create a dummy file in fileStore
      const storageKey = `projects/${testProjectId}/doc-test/file.txt`;
      const dummyBuffer = Buffer.from('Retention test content');
      await defaultFileStore.put('file.txt', dummyBuffer, storageKey);

      const fileId = 'file-' + randomUUID();
      db.prepare(`
        INSERT INTO stored_files (id, storage_key, original_name, mime_type, size_bytes, sha256, created_at)
        VALUES (?, ?, 'file.txt', 'text/plain', 22, 'hash', datetime('now'))
      `).run(fileId, storageKey);

      db.prepare(`
        INSERT INTO documents (id, project_id, category, status, updated_at, data)
        VALUES ('doc-cascade', ?, '01_Project_Overview', 'Draft', datetime('now'), '{}')
      `).run(testProjectId);

      db.prepare(`
        INSERT INTO document_versions (id, document_id, version_no, file_id, status, created_by, created_at)
        VALUES ('dv-cascade', 'doc-cascade', 'v1.0', ?, 'Draft', 'Tester', datetime('now'))
      `).run(fileId);

      // 2. Perform cascade project deletion
      const res = await RetentionService.cascadeDeleteProject(db, testProjectId, 'QA Admin');

      expect(res.projectId).toBe(testProjectId);
      expect(res.deletedFilesCount).toBe(1);
      expect(res.auditEventId).toBeDefined();
      expect(res.auditHash).toBeDefined();

      // Verify file is gone from disk
      const existsOnDisk = await defaultFileStore.exists(storageKey);
      expect(existsOnDisk).toBe(false);

      // Verify project is deleted from DB
      const projectRow = db.prepare('SELECT * FROM projects WHERE id = ?').get(testProjectId);
      expect(projectRow).toBeUndefined();
    });
  });
});
