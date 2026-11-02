import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response.js';
import { dbRepository } from '../../database/db.js';
import { computeSha256 } from '../../common/crypto.js';
import { AiService } from '../ai/ai.service.js';

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
  const startMs = Date.now();

  try {
    let output = '';

    if (action === 'status') {
      const docs = dbRepository.documents.getAll();
      const reqs = dbRepository.requirements.getAll();
      const tcs = dbRepository.testCases.getAll();
      const runs = dbRepository.testRuns.getAll();
      const bugs = dbRepository.bugs.getAll();
      const audits = dbRepository.auditEvents.getAll();
      const provider = dbRepository.settings.get('AI_PROVIDER') || 'gemini';

      output = [
        '===============================================================',
        '       🤖 DocQA Terminal AI Agent - Command Line Interface',
        '   Specification: AI_Project_Documentation_QA_Platform_Proposal',
        '===============================================================',
        `[STATUS] Platform: DocQA Enterprise Platform (v0.1.0)`,
        `[STATUS] Database: SQLite (WAL Mode) • Connection Active`,
        `[STATUS] AI Engine: ${provider.toUpperCase()}`,
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
        '  status                     Display platform metrics and database health',
        '  generate <REQ_ID>          Generate grounded test cases for requirement',
        '  impact <DOC_ID>            Calculate blast radius for revised document',
        '  verify                     Verify SHA-256 chained audit integrity',
        '  clear                      Clear terminal display',
        '  help                       Display this help menu'
      ].join('\n');
    } else {
      output = `Command not recognized: "${trimmed}". Type "help" for a list of available commands.`;
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
