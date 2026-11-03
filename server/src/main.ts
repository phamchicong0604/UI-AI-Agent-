import dotenv from 'dotenv';
dotenv.config();

import { app } from './app.js';
import { initializePipelineWorkers } from './modules/workflow/pipelineWorker.js';
import { defaultJobQueue } from './modules/workflow/jobQueue.js';

const PORT = process.env.PORT || 5001;

// Start background Job Queue worker & Stage Handlers (BUG-010)
initializePipelineWorkers();

const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 DocQA Backend Server running on http://localhost:${PORT}`);
  console.log(`🤖 AI Engine: Unified AI Connection Manager`);
  console.log(`⚙️  Job Queue Worker: Running`);
  console.log(`📖 API Spec: AI_Project_Documentation_QA_Platform_Proposal.docx`);
  console.log(`🛡️  SHA-256 Checksum & Chained Audit Logging: Enabled`);
  console.log(`====================================================`);
});

// Graceful shutdown handling
const shutdown = async () => {
  console.log('[Server] Shutting down gracefully...');
  await defaultJobQueue.stop();
  server.close(() => {
    console.log('[Server] Closed remaining connections.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
