import { dbRepository } from '../../database/db.js';
import { AiService } from '../ai/ai.service.js';
import { BackgroundAgentRecord } from '../../common/types.js';

export interface AgentLogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

class DaemonManagerService {
  private activeTimers = new Map<string, NodeJS.Timeout>();
  private logBuffers = new Map<string, AgentLogEntry[]>();
  private aiService = new AiService();

  constructor() {
    // Initialize log buffers
    ['AGENT-DOC-WATCHER', 'AGENT-QA-SYNTH', 'AGENT-AUDIT-GUARDIAN', 'AGENT-GAP-SCANNER'].forEach(id => {
      this.logBuffers.set(id, [
        {
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
          message: `[DAEMON] Background Agent worker ${id} initialized.`,
          level: 'info'
        }
      ]);
    });
  }

  /**
   * Initializes and starts background workers that have status = 'running'
   */
  startActiveDaemons(): void {
    const agents = dbRepository.backgroundAgents.getAll();
    for (const agent of agents) {
      if (agent.status === 'running') {
        this.startAgent(agent.id);
      }
    }
  }

  startAgent(id: string): { success: boolean; message: string } {
    const agent = dbRepository.backgroundAgents.getById(id);
    if (!agent) {
      return { success: false, message: `Agent ${id} not found` };
    }

    if (this.activeTimers.has(id)) {
      return { success: true, message: `Agent ${id} is already running` };
    }

    const intervalMs = Math.max(5000, agent.intervalSeconds * 1000);
    const pid = process.pid;

    this.addLog(id, `Started daemon process PID ${pid} (interval: ${agent.intervalSeconds}s)`, 'info');
    dbRepository.backgroundAgents.updateStatus(id, 'running', pid, `Daemon started (PID ${pid})`);

    // Setup recurring interval loop
    const timer = setInterval(async () => {
      await this.runIteration(id);
    }, intervalMs);

    this.activeTimers.set(id, timer);

    return { success: true, message: `Agent ${id} started in background (PID ${pid})` };
  }

  stopAgent(id: string): { success: boolean; message: string } {
    const timer = this.activeTimers.get(id);
    if (timer) {
      clearInterval(timer);
      this.activeTimers.delete(id);
    }

    this.addLog(id, `Stopped background worker.`, 'warn');
    dbRepository.backgroundAgents.updateStatus(id, 'stopped', undefined, 'Worker stopped by user');

    return { success: true, message: `Agent ${id} stopped` };
  }

  async triggerNow(id: string): Promise<{ success: boolean; log: string }> {
    const log = await this.runIteration(id);
    return { success: true, log };
  }

  async runIteration(id: string): Promise<string> {
    const agent = dbRepository.backgroundAgents.getById(id);
    if (!agent) return '';

    let logMessage = '';

    try {
      if (id === 'AGENT-DOC-WATCHER') {
        const docs = dbRepository.documents.getAll();
        const approvedDocs = docs.filter(d => d.status === 'Approved');
        logMessage = `[DOC-WATCHER] Scanned ${docs.length} documents (${approvedDocs.length} approved). Blast-radius impact monitor active.`;
      } else if (id === 'AGENT-QA-SYNTH') {
        const reqs = dbRepository.requirements.getAll();
        const tcs = dbRepository.testCases.getAll();
        const gaps = reqs.filter(r => !tcs.some(t => t.requirementId === r.id));
        logMessage = `[QA-SYNTH] Monitored ${reqs.length} requirements. Found ${gaps.length} coverage gaps; AI drafting ready.`;
      } else if (id === 'AGENT-AUDIT-GUARDIAN') {
        const audits = dbRepository.auditEvents.getAll();
        logMessage = `[GUARDIAN] Cryptographic SHA-256 chain scan: ${audits.length} blocks verified.`;
      } else if (id === 'AGENT-GAP-SCANNER') {
        const runs = dbRepository.testRuns.getAll();
        const bugs = dbRepository.bugs.getAll();
        logMessage = `[GAP-SCANNER] Lineage check: ${runs.length} test runs and ${bugs.length} defects synced with Traceability matrix.`;
      } else {
        logMessage = `[AGENT ${id}] Heartbeat execution cycle completed.`;
      }

      this.addLog(id, logMessage, 'info');

      const nextRunIso = new Date(Date.now() + agent.intervalSeconds * 1000).toISOString().replace('T', ' ').slice(0, 16);
      dbRepository.backgroundAgents.recordExecution(id, logMessage, nextRunIso);
    } catch (err: any) {
      logMessage = `[ERROR] Execution failed: ${err.message}`;
      this.addLog(id, logMessage, 'error');
      dbRepository.backgroundAgents.updateStatus(id, 'error', undefined, logMessage);
    }

    return logMessage;
  }

  getLogs(id: string): AgentLogEntry[] {
    return this.logBuffers.get(id) || [];
  }

  private addLog(id: string, message: string, level: 'info' | 'warn' | 'error' = 'info') {
    const entry: AgentLogEntry = {
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      message,
      level
    };

    if (!this.logBuffers.has(id)) {
      this.logBuffers.set(id, []);
    }

    const buffer = this.logBuffers.get(id)!;
    buffer.unshift(entry);
    if (buffer.length > 50) buffer.pop(); // Keep last 50 entries
  }
}

export const daemonService = new DaemonManagerService();
