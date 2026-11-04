import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import http from 'http';
import net from 'net';
import { app } from '../app.js';
import { db, dbRepository } from '../database/db.js';
import { defaultJobQueue, SqliteJobQueue } from '../modules/workflow/jobQueue.js';
import { registerPipelineHandlers } from '../modules/workflow/pipelineWorker.js';
import { defaultWorkflowEngine, ALLOWED_TRANSITIONS } from '../modules/workflow/workflowEngine.js';
import { signUserSession } from '../common/auth.js';

describe('Bug Review Phase 3: Pipeline & Job Queue (BUG-010, BUG-012, BUG-013, BUG-018)', () => {
  let server: http.Server;
  let baseUrl: string;
  const testProjectId = `PRJ-P3-${Date.now()}`;
  const adminToken = signUserSession({ id: 'usr_admin', username: 'admin', name: 'Alex Nguyen', role: 'Project Admin' });

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
    db.prepare("DELETE FROM jobs WHERE id LIKE 'JOB-P3-%'").run();
    db.prepare(`
      INSERT OR REPLACE INTO projects (id, name, key, description, version, author, members_count, ai_policy, data, created_at, updated_at)
      VALUES (?, 'Pipeline Test Project', 'PTP', 'Desc', 'v1.0', 'Admin', 1, 'ALLOW_EXTERNAL', '{}', datetime('now'), datetime('now'))
    `).run(testProjectId);
  });

  describe('BUG-010: Job Queue & Workflow Integration in App', () => {
    it('uploading a document should enqueue a PIPELINE_RUN job and worker should process it to REVIEW_REQUIRED', async () => {
      const boundary = '----WebKitFormBoundaryXYZ999';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="projectId"',
        '',
        testProjectId,
        `--${boundary}`,
        'Content-Disposition: form-data; name="files"; filename="security_policy.md"',
        'Content-Type: text/markdown',
        '',
        '# Quy chuẩn bảo mật thông tin\nYêu cầu hệ thống phải khóa tài khoản sau 5 lần đăng nhập thất bại liên tiếp.',
        `--${boundary}--`
      ].join('\r\n');

      const res = await fetch(`${baseUrl}/api/v1/documents/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Authorization': `Bearer ${adminToken}`
        },
        body
      });

      expect([200, 201]).toContain(res.status);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.documents.length).toBe(1);

      const createdDoc = json.data.documents[0];

      // Verify a PIPELINE_RUN job was enqueued specifically for this document (R2-16)
      const pendingJobs = db.prepare(`
        SELECT * FROM jobs 
        WHERE type = 'PIPELINE_RUN' 
          AND status = 'PENDING' 
          AND json_extract(payload, '$.documentId') = ?
      `).all(createdDoc.id) as any[];

      expect(pendingJobs.length).toBe(1);

      // Trigger worker cycle
      const processed = await defaultJobQueue.processNext(5);
      expect(processed).toBeGreaterThanOrEqual(1);

      // Verify document version transitioned to REVIEW_REQUIRED
      const versionRow = db.prepare(`
        SELECT status FROM document_versions WHERE document_id = ?
      `).get(createdDoc.id) as { status: string };

      expect(versionRow.status).toBe('REVIEW_REQUIRED');

      // Verify knowledge units were extracted and stored
      const units = dbRepository.knowledgeUnits.getByProject(testProjectId);
      expect(units.length).toBeGreaterThan(0);
    });
  });

  describe('BUG-018: State Machine Spec Adherence & Superseding', () => {
    it('FEEDBACK_REQUIRED should allow transition to SUPERSEDED', () => {
      expect(ALLOWED_TRANSITIONS.FEEDBACK_REQUIRED).toContain('SUPERSEDED');
      expect(ALLOWED_TRANSITIONS.REVIEW_REQUIRED).toContain('SUPERSEDED');
      expect(ALLOWED_TRANSITIONS.ORGANIZED).toContain('SUPERSEDED');
    });

    it('supersedePreviousVersions should mark older versions and pending reviews as Superseded', async () => {
      const docId = `DOC-SUPERSEDE-${Date.now()}`;
      db.prepare(`
        INSERT INTO documents (id, project_id, category, status, data, updated_at)
        VALUES (?, ?, '01_Project_Overview', 'In Review', '{}', datetime('now'))
      `).run(docId, testProjectId);

      const v1Id = `v1_row_${Date.now()}`;
      const v2Id = `v2_row_${Date.now()}`;

      db.prepare(`
        INSERT INTO document_versions (id, document_id, version_no, file_id, status, created_by, created_at)
        VALUES (?, ?, 'v1.0', NULL, 'REVIEW_REQUIRED', 'Author', datetime('now')),
               (?, ?, 'v2.0', NULL, 'UPLOADED', 'Author', datetime('now'))
      `).run(v1Id, docId, v2Id, docId);

      // Supersede older versions for v2.0
      const count = await defaultWorkflowEngine.supersedePreviousVersions(docId, 'v2.0', 'Author');
      expect(count).toBeGreaterThanOrEqual(1);

      const v1Row = db.prepare('SELECT status FROM document_versions WHERE id = ?').get(v1Id) as { status: string };
      expect(v1Row.status).toBe('SUPERSEDED');

      const v2Row = db.prepare('SELECT status FROM document_versions WHERE id = ?').get(v2Id) as { status: string };
      expect(v2Row.status).toBe('UPLOADED'); // Current version is NOT superseded!
    });
  });

  describe('BUG-012 & BUG-013: Optimistic Job Locking, Heartbeat & Stale Recovery', () => {
    it('stale lock recovery should increment attempts and eventually fail after maxAttempts', () => {
      const queue = new SqliteJobQueue('worker-test-stale');
      const jobId = `JOB-CRASH-${Date.now()}`;

      // Simulate a crashed job in RUNNING state locked 10 minutes ago
      const tenMinutesAgo = new Date(Date.now() - 600 * 1000).toISOString();
      dbRepository.jobs.create({
        id: jobId,
        type: 'PIPELINE_RUN',
        status: 'RUNNING',
        payload: '{}',
        result: null,
        attempts: 2,
        maxAttempts: 3,
        lockedBy: 'worker-dead-pid',
        lockedAt: tenMinutesAgo,
        nextRunAt: tenMinutesAgo,
        lastError: null,
        createdAt: tenMinutesAgo,
        updatedAt: tenMinutesAgo
      });

      // Recover stale locks
      const recovered = dbRepository.jobs.resetStaleLocks(60);
      expect(recovered).toBeGreaterThanOrEqual(1);

      const jobAfterRecovery = dbRepository.jobs.getById(jobId);
      // Attempt 2 + 1 = 3 (reached maxAttempts 3) -> Should be marked FAILED, not infinite PENDING
      expect(jobAfterRecovery?.status).toBe('FAILED');
      expect(jobAfterRecovery?.attempts).toBe(3);
    });

    it('BUG-012: worker cannot complete a job it does not own or that is not running', () => {
      const jobId = `JOB-LOCK-${Date.now()}`;
      dbRepository.jobs.create({
        id: jobId,
        type: 'PIPELINE_RUN',
        status: 'RUNNING',
        payload: '{}',
        result: null,
        attempts: 0,
        maxAttempts: 3,
        lockedBy: 'worker-authorized',
        lockedAt: new Date().toISOString(),
        nextRunAt: new Date().toISOString(),
        lastError: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Wrong worker tries to complete
      const completedWrong = dbRepository.jobs.complete(jobId, { done: true }, 'worker-imposter');
      expect(completedWrong).toBe(false);

      // Legitimate worker completes
      const completedRight = dbRepository.jobs.complete(jobId, { done: true }, 'worker-authorized');
      expect(completedRight).toBe(true);

      const finalJob = dbRepository.jobs.getById(jobId);
      expect(finalJob?.status).toBe('COMPLETED');
    });

    it('BUG-012: cancelJob triggers abort signal and cancels running or pending job', async () => {
      const queue = new SqliteJobQueue('worker-cancel-test');
      let signalAbortedDuringExecution = false;

      queue.registerHandler('PIPELINE_RUN', async (_payload, _job, signal) => {
        // Wait briefly to allow cancellation call
        await new Promise<void>((resolve) => {
          const checkTimer = setInterval(() => {
            if (signal?.aborted) {
              signalAbortedDuringExecution = true;
              clearInterval(checkTimer);
              resolve();
            }
          }, 20);
          setTimeout(() => {
            clearInterval(checkTimer);
            resolve();
          }, 500);
        });
      });

      const jobId = queue.enqueue('PIPELINE_RUN', { documentId: 'DOC-CANCEL-TEST' });

      // Start processing in background
      const processPromise = queue.processNext(1);

      // Cancel the job while in-flight
      await new Promise(r => setTimeout(r, 50));
      const cancelled = queue.cancelJob(jobId, 'User requested cancellation during execution');
      expect(cancelled).toBe(true);

      await processPromise;
      expect(signalAbortedDuringExecution).toBe(true);

      const finalJob = dbRepository.jobs.getById(jobId);
      expect(finalJob?.status).toBe('CANCELLED');
      expect(finalJob?.lastError).toContain('cancellation');
    });

    it('BUG-013: two competing workers do not execute the same job twice (atomic locking)', async () => {
      const queue1 = new SqliteJobQueue('worker-compete-1');
      const queue2 = new SqliteJobQueue('worker-compete-2');

      let executionCount = 0;
      const handler = async () => {
        executionCount++;
        await new Promise(r => setTimeout(r, 30));
      };

      queue1.registerHandler('PIPELINE_RUN', handler);
      queue2.registerHandler('PIPELINE_RUN', handler);

      queue1.enqueue('PIPELINE_RUN', { test: 'compete-lock' });

      // Run both workers concurrently
      const [p1, p2] = await Promise.all([
        queue1.processNext(1),
        queue2.processNext(1)
      ]);

      expect(p1 + p2).toBe(1);
      expect(executionCount).toBe(1);
    });
  });
});
