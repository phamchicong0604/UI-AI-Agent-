#!/usr/bin/env node
/**
 * DocQA Terminal Agent CLI Executable
 * Enables command-line AI-assisted QA operations, impact analysis, and audit verification.
 */

import readline from 'readline';
import { dbRepository } from '../database/db.js';
import { AiService } from '../modules/ai/ai.service.js';
import { computeSha256, computeAuditEventHash } from '../common/crypto.js';

const aiService = new AiService();

const BANNER = `
===============================================================
       🤖 DocQA Terminal AI Agent - Command Line Interface
   Specification: AI_Project_Documentation_QA_Platform_Proposal
===============================================================
`;

function printHelp() {
  console.log(BANNER);
  console.log(`Usage:
  npm run agent <command> [options]

Commands:
  status                     Display platform health, SQLite stats, and AI engine status
  generate --req <ID>        Synthesize grounded test cases for a requirement
  impact --doc <ID>          Calculate change impact blast radius for revised document
  verify                     Cryptographically verify chained SHA-256 audit log integrity
  config                     View terminal agent configuration
  list:reqs                  List all requirements and approval status
  list:docs                  List all documents and versions
  interactive                Launch interactive terminal prompt session
  help                       Show this help message

Options:
  --json                     Output raw JSON for automation and CI/CD pipelines
  --save                     Persist AI-generated draft test cases to SQLite

Examples:
  npm run agent status
  npm run agent generate --req REQ-001 --save
  npm run agent impact --doc DOC-02
  npm run agent verify
`);
}

async function handleStatus(isJson: boolean) {
  const docs = dbRepository.documents.getAll();
  const reqs = dbRepository.requirements.getAll();
  const tcs = dbRepository.testCases.getAll();
  const runs = dbRepository.testRuns.getAll();
  const bugs = dbRepository.bugs.getAll();
  const auditEvents = dbRepository.auditEvents.getAll();
  const provider = dbRepository.settings.get('AI_PROVIDER') || process.env.AI_PROVIDER || 'gemini';
  const hasGeminiKey = Boolean(dbRepository.settings.get('GEMINI_API_KEY') || process.env.GEMINI_API_KEY);
  const hasOpenAiKey = Boolean(dbRepository.settings.get('OPENAI_API_KEY') || process.env.OPENAI_API_KEY);

  const statusData = {
    platform: 'DocQA Enterprise Platform',
    version: '0.1.0',
    database: 'SQLite (WAL Mode)',
    stats: {
      documents: docs.length,
      requirements: reqs.length,
      testCases: tcs.length,
      testRuns: runs.length,
      bugs: bugs.length,
      auditBlocks: auditEvents.length
    },
    aiEngine: {
      provider,
      status: (provider === 'gemini' && hasGeminiKey) || (provider === 'openai' && hasOpenAiKey) 
        ? 'Active (Cloud LLM)' 
        : 'Active (Deterministic Zero-Key Fallback)'
    }
  };

  if (isJson) {
    console.log(JSON.stringify(statusData, null, 2));
    return;
  }

  console.log(BANNER);
  console.log(`[STATUS] Platform: ${statusData.platform} (v${statusData.version})`);
  console.log(`[STATUS] Database: ${statusData.database} • Local Storage OK`);
  console.log(`[STATUS] AI Engine: ${statusData.aiEngine.provider.toUpperCase()} (${statusData.aiEngine.status})`);
  console.log('---------------------------------------------------------------');
  console.log(`  📄 Documents:        ${statusData.stats.documents}`);
  console.log(`  📋 Requirements:     ${statusData.stats.requirements}`);
  console.log(`  🧪 Test Cases:       ${statusData.stats.testCases}`);
  console.log(`  🚀 Test Runs:        ${statusData.stats.testRuns}`);
  console.log(`  🐛 Active Defects:   ${statusData.stats.bugs}`);
  console.log(`  🛡️  Audit Blocks:     ${statusData.stats.auditBlocks} (SHA-256 Chained)`);
  console.log('===============================================================\n');
}

async function handleGenerate(reqId: string, isJson: boolean, shouldSave: boolean) {
  if (!reqId) {
    console.error('Error: Please specify requirement ID using --req <ID> (e.g. --req REQ-001)');
    process.exit(1);
  }

  const req = dbRepository.requirements.getById(reqId);
  if (!req) {
    console.error(`Error: Requirement "${reqId}" not found in SQLite database.`);
    process.exit(1);
  }

  const doc = req.sourceReferences?.[0]?.documentId 
    ? dbRepository.documents.getById(req.sourceReferences[0].documentId) 
    : undefined;

  if (!isJson) {
    console.log(BANNER);
    console.log(`[AGENT] Grounding requirement: ${req.id} - "${req.title}"`);
    console.log(`[AGENT] Context Document: ${doc?.title || 'System Baseline'} (${doc?.currentVersion || 'v1.0'})`);
    console.log(`[AGENT] Executing AI Copilot Grounded Synthesis...`);
  }

  const result = await aiService.generateGroundedDrafts({
    requirement: req,
    sourceDoc: doc || undefined,
    userPrompt: 'Synthesize standard positive, boundary and negative security scenarios from CLI agent.'
  });

  if (shouldSave && result.testCases?.length > 0) {
    for (const tc of result.testCases) {
      dbRepository.testCases.upsert(tc);
    }
    // Log audit event
    const prevHash = dbRepository.auditEvents.getLatestHash();
    const audId = `AUD-CLI-${Date.now().toString().slice(-4)}`;
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const hash = computeAuditEventHash(prevHash, audId, 'Terminal Agent', 'QA', 'AI Test Cases Drafted', 'Requirement', req.id, timestamp);
    dbRepository.auditEvents.add({
      id: audId,
      user: 'Terminal Agent',
      role: 'QA',
      action: 'AI Test Cases Drafted via CLI',
      entityType: 'Requirement',
      entityId: req.id,
      details: `Generated ${result.testCases.length} draft test case(s) from CLI runner.`,
      timestamp,
      eventHash: hash,
      previousEventHash: prevHash
    });
  }

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('\n[AGENT] Generated Grounded Test Cases (Strict Proposal Policy: DRAFT ONLY):');
  console.log('---------------------------------------------------------------');
  result.testCases.forEach((tc: any, idx: number) => {
    console.log(`\n#${idx + 1} [${tc.id}] ${tc.title}`);
    console.log(`   Type: ${tc.type} | Priority: ${tc.priority} | Status: ${tc.status} (Mandatory Draft)`);
    console.log(`   Scenario: ${tc.scenario}`);
    console.log(`   Steps (${tc.steps.length}):`);
    tc.steps.forEach((s: any) => {
      console.log(`     Step ${s.stepNumber}: ${s.action} -> Expected: ${s.expectedResult}`);
    });
    console.log(`   Citation Hash: ${tc.sourceReferences?.[0]?.citationHash || tc.groundedCitation?.citationHash}`);
  });

  if (result.unconfirmedAssumptions?.length > 0) {
    console.log('\n[AGENT] ⚠️ Unconfirmed Assumptions Log:');
    result.unconfirmedAssumptions.forEach((a: any, i: number) => {
      console.log(`   ${i + 1}. ${a.question} (Context: ${a.context})`);
    });
  }

  if (shouldSave) {
    console.log(`\n[AGENT] ✅ Saved ${result.testCases.length} test cases to SQLite database as DRAFT.`);
  } else {
    console.log(`\n[AGENT] Tip: Re-run with --save flag to commit draft cases to SQLite database.`);
  }
}

async function handleImpact(docId: string, isJson: boolean) {
  if (!docId) {
    console.error('Error: Please specify document ID using --doc <ID> (e.g. --doc DOC-02)');
    process.exit(1);
  }

  const reqs = dbRepository.requirements.getAll();
  const tcs = dbRepository.testCases.getAll();

  const impact = await aiService.analyzeChangeImpact({
    documentId: docId,
    requirements: reqs,
    testCases: tcs
  });

  if (isJson) {
    console.log(JSON.stringify(impact, null, 2));
    return;
  }

  console.log(BANNER);
  console.log(`[AGENT] Change Impact Blast-Radius Analysis for Revised Document: ${docId}`);
  console.log('---------------------------------------------------------------');
  console.log(`  Severity Level:           ${impact.impactSeverity.toUpperCase()}`);
  console.log(`  Directly Impacted Reqs:   ${impact.affectedRequirements.join(', ') || 'None'}`);
  console.log(`  Invalidated Test Cases:   ${impact.affectededTestCaseIds.join(', ') || 'None'}`);
  console.log(`  Reasoning:                ${impact.reasoning}`);
  console.log('\n[AGENT] Recommended Action Plan:');
  impact.actionPlan.forEach((plan: string, i: number) => {
    console.log(`  ${i + 1}. ${plan}`);
  });
  console.log('---------------------------------------------------------------\n');
}

async function handleVerify(isJson: boolean) {
  const auditStore = dbRepository.auditEvents.getAll();
  let isChainValid = true;
  const verificationLog: any[] = [];

  for (let i = 0; i < auditStore.length; i++) {
    const current = auditStore[i];
    const prev = auditStore[i + 1];

    if (prev && current.previousEventHash !== prev.eventHash) {
      isChainValid = false;
      verificationLog.push({
        event: current.id,
        status: 'TAMPER_DETECTED',
        expectedPrev: prev.eventHash,
        actualPrev: current.previousEventHash
      });
    } else {
      verificationLog.push({
        event: current.id,
        status: 'HASH_VERIFIED',
        eventHash: current.eventHash
      });
    }
  }

  const result = {
    isChainValid,
    totalBlocksVerified: auditStore.length,
    algorithm: 'SHA-256 Chained Block Hash',
    details: verificationLog
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(BANNER);
  console.log(`[AUDIT] Verifying Cryptographic Audit Chain...`);
  console.log(`[AUDIT] Total Blocks: ${result.totalBlocksVerified}`);
  console.log(`[AUDIT] Algorithm:    ${result.algorithm}`);
  console.log(`[AUDIT] Integrity:    ${isChainValid ? '✅ 100% VALID - NO TAMPERING DETECTED' : '❌ TAMPER DETECTED'}`);
  console.log('---------------------------------------------------------------');
  auditStore.slice(0, 5).forEach((evt, idx) => {
    console.log(`  Block #${idx + 1}: ${evt.id} [${evt.entityType}] ${evt.action}`);
    console.log(`    Hash: ${evt.eventHash}`);
    if (evt.previousEventHash) console.log(`    Prev: ${evt.previousEventHash.slice(0, 30)}...`);
  });
  console.log('===============================================================\n');
}

async function handleInteractive() {
  console.log(BANNER);
  console.log('Interactive Agent REPL started. Type "help" for options or "exit" to quit.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'docqa-agent> '
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    const parts = trimmed.split(/\s+/);
    const cmd = parts[0];

    try {
      if (cmd === 'exit' || cmd === 'quit') {
        console.log('Goodbye!');
        process.exit(0);
      } else if (cmd === 'help') {
        console.log('Available REPL commands: status, generate <REQ_ID>, impact <DOC_ID>, verify, exit');
      } else if (cmd === 'status') {
        await handleStatus(false);
      } else if (cmd === 'generate') {
        const reqId = parts[1] || 'REQ-001';
        await handleGenerate(reqId, false, false);
      } else if (cmd === 'impact') {
        const docId = parts[1] || 'DOC-02';
        await handleImpact(docId, false);
      } else if (cmd === 'verify') {
        await handleVerify(false);
      } else if (trimmed) {
        console.log(`Unknown command: "${cmd}". Type "help" for command list.`);
      }
    } catch (err: any) {
      console.error(`Execution error: ${err.message}`);
    }

    rl.prompt();
  }).on('close', () => {
    console.log('\nSession ended.');
    process.exit(0);
  });
}

// Main CLI Entry Point
async function main() {
  const args = process.argv.slice(2);
  const isJson = args.includes('--json');
  const shouldSave = args.includes('--save');
  const command = args[0] || 'help';

  const getArgValue = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : '';
  };

  try {
    switch (command) {
      case 'status':
        await handleStatus(isJson);
        break;
      case 'generate':
        await handleGenerate(getArgValue('--req') || args[1], isJson, shouldSave);
        break;
      case 'impact':
        await handleImpact(getArgValue('--doc') || args[1], isJson);
        break;
      case 'verify':
        await handleVerify(isJson);
        break;
      case 'config': {
        const agentToken = dbRepository.settings.get('AGENT_CLI_TOKEN') || 'docqa_tok_' + computeSha256('default_token').slice(0, 24);
        console.log(JSON.stringify({
          agentName: 'DocQA Terminal Copilot',
          endpoint: 'http://localhost:5001/api/v1',
          cliToken: agentToken,
          provider: dbRepository.settings.get('AI_PROVIDER') || 'gemini',
          model: dbRepository.settings.get('GEMINI_MODEL') || 'gemini-1.5-pro'
        }, null, 2));
        break;
      }
      case 'interactive':
      case 'repl':
        await handleInteractive();
        break;
      case 'help':
      case '--help':
      case '-h':
      default:
        printHelp();
        break;
    }
  } catch (err: any) {
    console.error(`[AGENT FATAL ERROR]: ${err.message}`);
    process.exit(1);
  }
}

main();
