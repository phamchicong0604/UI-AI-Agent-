import { describe, it, expect, beforeEach } from 'vitest';
import { db, dbRepository } from '../database/db.js';
import { SqliteJobQueue } from '../modules/workflow/jobQueue.js';

describe('Job Queue on SQLite (E3-T2)', () => {
  beforeEach(() => {
    // Clear jobs table for test isolation
    db.exec("DELETE FROM jobs WHERE id LIKE 'JOB-TEST-%'");
  });

  it('should enqueue, poll, lock and complete a job successfully', async () => {
    const queue = new SqliteJobQueue('worker-test-1');
    let handledPayload: any = null;

    queue.registerHandler('EXTRACT_FILE', async (payload) => {
      handledPayload = payload;
      return { status: 'ok', extractedChars: 150 };
    });

    const jobId = `JOB-TEST-${Date.now()}-1`;
    queue.enqueue('EXTRACT_FILE', { docId: 'DOC-99', path: '/test.md' }, { id: jobId });

    const jobBefore = dbRepository.jobs.getById(jobId);
    expect(jobBefore).not.toBeNull();
    expect(jobBefore?.status).toBe('PENDING');
    expect(jobBefore?.attempts).toBe(0);

    // Process job
    const executedCount = await queue.processNext();
    expect(executedCount).toBe(1);
    expect(handledPayload).toEqual({ docId: 'DOC-99', path: '/test.md' });

    const jobAfter = dbRepository.jobs.getById(jobId);
    expect(jobAfter?.status).toBe('COMPLETED');
    expect(jobAfter?.lockedBy).toBeNull();
    expect(JSON.parse(jobAfter?.result || '{}')).toEqual({ status: 'ok', extractedChars: 150 });
  });

  it('should retry failed job with backoff and mark FAILED when max_attempts is reached', async () => {
    const queue = new SqliteJobQueue('worker-test-2');
    let callCount = 0;

    queue.registerHandler('PIPELINE_RUN', async () => {
      callCount++;
      throw new Error('AI Provider rate limit exceeded (HTTP 429)');
    });

    const jobId = `JOB-TEST-${Date.now()}-2`;
    queue.enqueue('PIPELINE_RUN', { docId: 'DOC-100' }, { id: jobId, maxAttempts: 2 });

    // Attempt 1 -> Fails and schedules retry
    await queue.processNext();
    let job = dbRepository.jobs.getById(jobId);
    expect(job?.status).toBe('PENDING');
    expect(job?.attempts).toBe(1);
    expect(job?.lastError).toContain('HTTP 429');
    expect(job?.lockedBy).toBeNull();

    // Fast-forward next_run_at to now for test
    db.prepare("UPDATE jobs SET next_run_at = datetime('now', '-1 minute') WHERE id = ?").run(jobId);

    // Attempt 2 -> Fails and exhausts maxAttempts (2)
    await queue.processNext();
    job = dbRepository.jobs.getById(jobId);
    expect(job?.status).toBe('FAILED');
    expect(job?.attempts).toBe(2);
    expect(callCount).toBe(2);
  });

  it('should cancel pending or running jobs via cancel method', () => {
    const queue = new SqliteJobQueue('worker-test-3');
    const jobId = `JOB-TEST-${Date.now()}-3`;
    queue.enqueue('SEMANTIC_VALIDATION', { docId: 'DOC-101' }, { id: jobId });

    const cancelled = dbRepository.jobs.cancel(jobId, 'User aborted pipeline');
    expect(cancelled).toBe(true);

    const job = dbRepository.jobs.getById(jobId);
    expect(job?.status).toBe('CANCELLED');
    expect(job?.lastError).toBe('User aborted pipeline');
  });

  it('should recover orphaned running jobs if server crashed (resetStaleLocks)', () => {
    const jobId = `JOB-TEST-${Date.now()}-crash`;
    const tenMinutesAgo = new Date(Date.now() - 600 * 1000).toISOString();

    // Simulate an abandoned job from a crashed server process
    db.prepare(`
      INSERT INTO jobs (id, type, payload, status, attempts, max_attempts, locked_by, locked_at, next_run_at, created_at, updated_at)
      VALUES (?, 'EXTRACT_FILE', '{}', 'RUNNING', 1, 3, 'dead-worker-pid-9999', ?, ?, ?, ?)
    `).run(jobId, tenMinutesAgo, tenMinutesAgo, tenMinutesAgo, tenMinutesAgo);

    // Recover stale locks older than 300 seconds
    const recovered = dbRepository.jobs.resetStaleLocks(300);
    expect(recovered).toBeGreaterThanOrEqual(1);

    const recoveredJob = dbRepository.jobs.getById(jobId);
    expect(recoveredJob?.status).toBe('PENDING');
    expect(recoveredJob?.lockedBy).toBeNull();
    expect(recoveredJob?.lockedAt).toBeNull();
  });
});
