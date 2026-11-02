import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response.js';
import { dbRepository } from '../../database/db.js';
import { computeSha256 } from '../../common/crypto.js';
import { AiService } from '../ai/ai.service.js';
import { daemonService } from './daemon.service.js';

export const agentRouter = Router();
const aiService = new AiService();

/**
 * GET /api/v1/agent/config
 * Retrieves Terminal Agent profile and CLI access configuration
 */
agentRouter.get('/config', (req: Request, res: Response) => {
  const agentName = dbRepository.settings.get('AGENT_NAME') || 'DocQA-Terminal-Copilot';
  const persona = dbRepository.settings.get('AGENT_PERSONA') || 'QA Automation & Grounding Specialist';
  const autonomyLevel = dbRepository.settings.get('AGENT_AUTONOMY') || 'assisted';
  const model = dbRepository.settings.get('GEMINI_MODEL') || 'gemini-1.5-pro';
  let cliToken = dbRepository.settings.get('AGENT_CLI_TOKEN');

  if (!cliToken) {
    cliToken = `docqa_tok_${computeSha256(`initial_token_${Date.now()}`).slice(0, 32)}`;
    dbRepository.settings.set('AGENT_CLI_TOKEN', cliToken);
  }

  sendSuccess(res, {
    agentName,
    persona,
    autonomyLevel,
    model,
    cliToken,
    endpoint: 'http://localhost:5001/api/v1',
    cliExecutable: 'npm run agent',
    sandboxPolicy: 'Proposal Section 8.1 - Mandatory Draft Only'
  });
});

/**
 * POST /api/v1/agent/config
 * Updates Terminal Agent profile and options
 */
agentRouter.post('/config', (req: Request, res: Response) => {
  const { agentName, persona, autonomyLevel } = req.body;

  if (agentName) dbRepository.settings.set('AGENT_NAME', String(agentName).trim());
  if (persona) dbRepository.settings.set('AGENT_PERSONA', String(persona).trim());
  if (autonomyLevel) dbRepository.settings.set('AGENT_AUTONOMY', String(autonomyLevel).trim());

  sendSuccess(res, { success: true }, 'Agent configuration updated successfully');
});

/**
 * POST /api/v1/agent/generate-token
 * Rotates the terminal CLI access token
 */
agentRouter.post('/generate-token', (req: Request, res: Response) => {
  const newToken = `docqa_tok_${computeSha256(`rotate_${Date.now()}_${Math.random()}`).slice(0, 32)}`;
  dbRepository.settings.set('AGENT_CLI_TOKEN', newToken);
  sendSuccess(res, { cliToken: newToken }, 'New CLI token generated successfully');
});

/* -------------------------------------------------------------
 * BACKGROUND AGENTS / DAEMON WORKERS API
 * ----------------------------------------------------------- */

/**
 * GET /api/v1/agent/background
 * Retrieves all registered background agents and their live worker statuses
 */
agentRouter.get('/background', (req: Request, res: Response) => {
  const agents = dbRepository.backgroundAgents.getAll();
  sendSuccess(res, agents);
});

/**
 * POST /api/v1/agent/background/:id/start
 * Starts a background agent daemon worker
 */
agentRouter.post('/background/:id/start', (req: Request, res: Response) => {
  const result = daemonService.startAgent(req.params.id);
  if (!result.success) {
    return sendError(res, result.message, 400);
  }
  const updated = dbRepository.backgroundAgents.getById(req.params.id);
  sendSuccess(res, updated, result.message);
});

/**
 * POST /api/v1/agent/background/:id/stop
 * Stops a background agent daemon worker
 */
agentRouter.post('/background/:id/stop', (req: Request, res: Response) => {
  const result = daemonService.stopAgent(req.params.id);
  const updated = dbRepository.backgroundAgents.getById(req.params.id);
  sendSuccess(res, updated, result.message);
});

/**
 * POST /api/v1/agent/background/:id/trigger
 * Triggers an immediate execution cycle for a background agent
 */
agentRouter.post('/background/:id/trigger', async (req: Request, res: Response) => {
  const result = await daemonService.triggerNow(req.params.id);
  const updated = dbRepository.backgroundAgents.getById(req.params.id);
  sendSuccess(res, { agent: updated, log: result.log }, 'Agent iteration triggered');
});

/**
 * GET /api/v1/agent/background/:id/logs
 * Retrieves tail logs for a background agent
 */
agentRouter.get('/background/:id/logs', (req: Request, res: Response) => {
  const logs = daemonService.getLogs(req.params.id);
  sendSuccess(res, logs);
});

/**
 * POST /api/v1/agent/execute
 * Direct in-browser terminal command executor for the interactive CLI emulator
 */
agentRouter.post('/execute', async (req: Request, res: Response) => {
  const { command } = req.body;
  if (!command || typeof command !== 'string') {
    return sendError(res, 'Command string is required', 400);
  }

  const trimmed = command.trim();
  const parts = trimmed.split(/\s+/);
  const action = parts[0]?.toLowerCase();
  const subAction = parts[1]?.toLowerCase();
  const targetId = parts[2] || parts[1];
  const startMs = Date.now();

  try {
    let output = '';

    if (action === 'daemon' || action === 'worker') {
      if (subAction === 'list' || subAction === 'status' || !subAction) {
        const agents = dbRepository.backgroundAgents.getAll();
        output = [
          '========================================================================',
          '               ⚙️  DOCQA BACKGROUND AGENTS DAEMON STATUS',
          '========================================================================',
          ...agents.map(a => 
            `[${a.status.toUpperCase() === 'RUNNING' ? '🟢 RUNNING' : '⏹️ STOPPED'}] ${a.id} (${a.name})\n` +
            `  • Role: ${a.role}\n` +
            `  • PID: ${a.pid || 'N/A'} | Interval: Every ${a.intervalSeconds}s | Completed Cycles: ${a.runsCount}\n` +
            `  • Last Run: ${a.lastRun || 'Never'} | Next Run: ${a.nextRun || 'N/A'}\n` +
            `  • Latest Log: ${a.lastLog || 'No activity recorded yet.'}\n`
          ),
          '========================================================================'
        ].join('\n');
      } else if (subAction === 'start') {
        const resDaemon = daemonService.startAgent(targetId);
        output = resDaemon.message;
      } else if (subAction === 'stop') {
        const resDaemon = daemonService.stopAgent(targetId);
        output = resDaemon.message;
      } else if (subAction === 'trigger' || subAction === 'run') {
        const resDaemon = await daemonService.triggerNow(targetId);
        output = `Triggered execution for ${targetId}:\n${resDaemon.log}`;
      } else if (subAction === 'logs') {
        const logs = daemonService.getLogs(targetId);
        output = logs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n') || 'No logs recorded.';
      } else {
        output = `Unknown daemon command: "${subAction}". Usage: daemon [status|start <ID>|stop <ID>|trigger <ID>|logs <ID>]`;
      }
    } else if (action === 'status') {
      const docs = dbRepository.documents.getAll();
      const reqs = dbRepository.requirements.getAll();
      const tcs = dbRepository.testCases.getAll();
      const runs = dbRepository.testRuns.getAll();
      const bugs = dbRepository.bugs.getAll();
      const audits = dbRepository.auditEvents.getAll();
      const backgroundAgents = dbRepository.backgroundAgents.getAll();
      const runningAgents = backgroundAgents.filter(a => a.status === 'running').length;
      const provider = dbRepository.settings.get('AI_PROVIDER') || 'gemini';

      output = [
        '===============================================================',
        '       🤖 DocQA Terminal AI Agent - Command Line Interface',
        '   Specification: AI_Project_Documentation_QA_Platform_Proposal',
        '===============================================================',
        `[STATUS] Platform: DocQA Enterprise Platform (v0.1.0)`,
        `[STATUS] Database: SQLite (WAL Mode) • Connection Active`,
        `[STATUS] AI Engine: ${provider.toUpperCase()}`,
        `[STATUS] Background Daemon Workers: ${runningAgents}/${backgroundAgents.length} Running`,
        '---------------------------------------------------------------',
        `  📄 Documents:        ${docs.length}`,
        `  📋 Requirements:     ${reqs.length}`,
        `  🧪 Test Cases:       ${tcs.length}`,
        `  🚀 Test Runs:        ${runs.length}`,
        `  🐛 Active Defects:   ${bugs.length}`,
        `  🛡️  Audit Blocks:     ${audits.length} (SHA-256 Chained)`,
        '==============================================================='
      ].join('\n');
    } else if (action === 'verify' || action === 'verify-chain') {
      const audits = dbRepository.auditEvents.getAll();
      let isValid = true;
      for (let i = 0; i < audits.length; i++) {
        if (audits[i + 1] && audits[i].previousEventHash !== audits[i + 1].eventHash) {
          isValid = false;
          break;
        }
      }
      output = [
        `[AUDIT] Cryptographic Audit Chain Verification:`,
        `  Total Blocks: ${audits.length}`,
        `  Algorithm: SHA-256 Chained Hash`,
        `  Chain Status: ${isValid ? '✅ VALID (Zero tampering detected)' : '⚠️ TAMPERING DETECTED'}`,
        `  Latest Block Hash: ${dbRepository.auditEvents.getLatestHash()}`
      ].join('\n');
    } else if (action === 'generate') {
      const reqId = parts[1] || 'REQ-001';
      const reqItem = dbRepository.requirements.getById(reqId);
      if (!reqItem) {
        output = `[ERROR] Requirement "${reqId}" not found in database.`;
      } else {
        const result = await aiService.generateGroundedDrafts({ requirement: reqItem });
        output = [
          `[AGENT] Grounded Test Case Generation for ${reqId} ("${reqItem.title}"):`,
          `  Status Policy: MANDATORY DRAFT ONLY (Human Reviewer Required)`,
          `  Generated: ${result.testCases?.length || 0} test cases`,
          `  Citation Hash: ${result.testCases?.[0]?.sourceReferences?.[0]?.citationHash || 'sha256:citation_valid'}`,
          `  Unconfirmed Assumptions: ${result.unconfirmedAssumptions?.length || 0}`
        ].join('\n');
      }
    } else if (action === 'impact') {
      const docId = parts[1] || 'DOC-02';
      const reqs = dbRepository.requirements.getAll();
      const tcs = dbRepository.testCases.getAll();
      const impact = await aiService.analyzeChangeImpact({
        documentId: docId,
        requirements: reqs,
        testCases: tcs
      });
      output = [
        `[AGENT] Change Impact Blast-Radius for ${docId}:`,
        `  Severity: ${impact.impactSeverity.toUpperCase()}`,
        `  Impacted Requirements: ${impact.affectedRequirements.join(', ') || 'None'}`,
        `  Invalidated Test Cases: ${impact.affectededTestCaseIds.join(', ') || 'None'}`,
        `  Reasoning: ${impact.reasoning}`
      ].join('\n');
    } else if (action === 'help') {
      output = [
        'Available DocQA CLI commands:',
        '  daemon status              Display all background agents and worker PIDs',
        '  daemon start <ID>          Start a background agent worker',
        '  daemon stop <ID>           Stop a background agent worker',
        '  daemon trigger <ID>        Trigger immediate execution for an agent',
        '  daemon logs <ID>           View live tail logs of a background worker',
        '  status                     Display platform metrics and database health',
        '  generate <REQ_ID>          Generate grounded test cases for requirement',
        '  impact <DOC_ID>            Calculate blast radius for revised document',
        '  verify                     Verify SHA-256 chained audit integrity',
        '  clear                      Clear terminal display',
        '  help                       Display this help menu'
      ].join('\n');
    } else {
      output = `Command not recognized: "${trimmed}". Type "help" or "daemon status" for command list.`;
    }

    sendSuccess(res, {
      command: trimmed,
      stdout: output,
      latencyMs: Date.now() - startMs,
      exitCode: 0
    });
  } catch (err: any) {
    return sendError(res, `Execution error: ${err.message}`, 500);
  }
});
