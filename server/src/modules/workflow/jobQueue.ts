import { JobRecord, JobType } from '../../common/types.js';
import { db, dbRepository } from '../../database/db.js';

export type JobHandler<T = any> = (payload: T, job: JobRecord, signal?: AbortSignal) => Promise<any>;

export interface EnqueueOptions {
  maxAttempts?: number;
  runAt?: Date;
  id?: string;
}

export class SqliteJobQueue {
  private workerId: string;
  private handlers = new Map<string, JobHandler>();
  private activeAbortControllers = new Map<string, AbortController>();
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isProcessing = false;
  private stageTimeoutMs = 60000; // 60 seconds per job execution default

  constructor(workerId?: string, stageTimeoutMs?: number) {
    this.workerId = workerId || `worker-${process.pid}-${Math.random().toString(36).slice(2, 7)}`;
    if (stageTimeoutMs) this.stageTimeoutMs = stageTimeoutMs;
  }

  /**
   * Register a processing handler for a specific JobType
   */
  public registerHandler<T = any>(type: JobType | string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler);
  }

  /**
   * Enqueue a new background job into SQLite
   */
  public enqueue<T = any>(type: JobType, payload: T, options?: EnqueueOptions): string {
    const id = options?.id || `JOB-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const nextRunAt = options?.runAt ? options.runAt.toISOString() : now;

    const job: JobRecord = {
      id,
      type,
      payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
      status: 'PENDING',
      attempts: 0,
      maxAttempts: options?.maxAttempts || 3,
      lockedBy: null,
      lockedAt: null,
      nextRunAt,
      lastError: null,
      result: null,
      createdAt: now,
      updatedAt: now
    };

    dbRepository.jobs.create(job);
    return id;
  }

  /**
   * Start polling worker loop.
   * Recovers stale locked jobs from previous server crash automatically (E3-T2).
   */
  public start(pollIntervalMs = 1000): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // 1. Recover any jobs left in RUNNING from a previously terminated server
    const recovered = dbRepository.jobs.resetStaleLocks(60);
    if (recovered > 0) {
      console.log(`[JobQueue] Recovered ${recovered} stale jobs from previous server run.`);
    }

    // 2. Start polling
    this.timer = setInterval(async () => {
      if (!this.isRunning || this.isProcessing) return;
      try {
        // Periodically recover stale abandoned locks from crashed workers (BUG-013)
        dbRepository.jobs.resetStaleLocks(60);
        await this.processNext();
      } catch (err: any) {
        console.error('[JobQueue] Error during poll cycle:', err.message);
      }
    }, pollIntervalMs);
  }

  /**
   * Cancel an in-flight or queued job immediately (BUG-012, R3-10)
   */
  public cancelJob(jobId: string, reason?: string): boolean {
    const controller = this.activeAbortControllers.get(jobId);
    if (controller) {
      controller.abort(new Error(reason || 'Job cancelled by user request'));
    }
    const cancelled = dbRepository.jobs.cancel(jobId, reason);
    if (cancelled) {
      try {
        const job = dbRepository.jobs.getById(jobId);
        if (job) {
          const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
          if (payload?.documentVersionId) {
            db.prepare(`
              UPDATE document_versions
              SET status = 'CANCELLED'
              WHERE id = ? AND status NOT IN ('ORGANIZED', 'SUPERSEDED')
            `).run(payload.documentVersionId);
          }
        }
      } catch {}
    }
    return cancelled;
  }

  /**
   * Stop worker gracefully
   */
  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Poll and execute available pending jobs.
   * Can be called directly in unit tests for deterministic testing.
   */
  public async processNext(batchLimit = 5): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      const lockedJobs = dbRepository.jobs.pollAndLock(this.workerId, batchLimit);
      if (lockedJobs.length === 0) return 0;

      for (const job of lockedJobs) {
        await this.executeJob(job);
      }

      return lockedJobs.length;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute an individual locked job with timeout protection and retry backoff
   */
  private async executeJob(job: JobRecord): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      const err = `No handler registered for job type "${job.type}"`;
      dbRepository.jobs.failWithRetry(job.id, err);
      return;
    }

    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(job.payload);
    } catch {
      parsedPayload = job.payload;
    }

    const abortController = new AbortController();
    this.activeAbortControllers.set(job.id, abortController);
    let timeoutHandle: NodeJS.Timeout | null = null;
    let heartbeatHandle: NodeJS.Timeout | null = null;

    try {
      // 1. Start heartbeat to periodically refresh locked_at (BUG-013)
      heartbeatHandle = setInterval(() => {
        dbRepository.jobs.heartbeat(job.id, this.workerId);
      }, Math.min(10000, Math.max(1000, Math.floor(this.stageTimeoutMs / 4))));

      // 2. Execute with stage timeout and ensure timer is properly cleared (BUG-034, NEW-04)
      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
          abortController.abort(new Error(`Job stage timeout after ${this.stageTimeoutMs}ms`));
          reject(new Error(`Job stage timeout after ${this.stageTimeoutMs}ms`));
        }, this.stageTimeoutMs);
      });

      const result = await Promise.race([
        handler(parsedPayload, job, abortController.signal),
        timeoutPromise
      ]);

      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      if (heartbeatHandle) {
        clearInterval(heartbeatHandle);
        heartbeatHandle = null;
      }

      // 3. Mark completed with worker ownership verification (BUG-012)
      dbRepository.jobs.complete(job.id, result, this.workerId);
    } catch (err: any) {
      abortController.abort();
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      if (heartbeatHandle) {
        clearInterval(heartbeatHandle);
        heartbeatHandle = null;
      }

      const errorMessage = err?.message || String(err);
      // Fail with exponential backoff: attempts 1 -> 5s, 2 -> 10s, 3 -> 20s
      dbRepository.jobs.failWithRetry(job.id, errorMessage, undefined, this.workerId);
    } finally {
      this.activeAbortControllers.delete(job.id);
    }
  }
}

export const defaultJobQueue = new SqliteJobQueue();
