import express from 'express';
import cors from 'cors';
import { aiRouter } from './modules/ai/ai.controller.js';
import { documentsRouter } from './modules/documents/documents.router.js';
import { requirementsRouter } from './modules/requirements/requirements.router.js';
import { evidenceRouter } from './modules/evidence/evidence.router.js';
import { testcasesRouter } from './modules/testcases/testcases.router.js';
import { testrunsRouter } from './modules/testruns/testruns.router.js';
import { bugsRouter } from './modules/bugs/bugs.router.js';
import { traceabilityRouter } from './modules/traceability/traceability.router.js';
import { auditRouter } from './modules/audit/audit.router.js';
import { settingsRouter } from './modules/settings/settings.router.js';

export const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'docqa-backend',
    version: '0.1.0',
    timestamp: new Date().toISOString()
  });
});

// Mount API v1 Routers
app.use('/api/v1/ai', aiRouter);
app.use('/api/v1/documents', documentsRouter);
app.use('/api/v1/requirements', requirementsRouter);
app.use('/api/v1/evidence', evidenceRouter);
app.use('/api/v1/testcases', testcasesRouter);
app.use('/api/v1/testruns', testrunsRouter);
app.use('/api/v1/bugs', bugsRouter);
app.use('/api/v1/traceability', traceabilityRouter);
app.use('/api/v1/audit', auditRouter);
app.use('/api/v1/settings', settingsRouter);

// Root summary endpoint
app.get('/api/v1', (req, res) => {
  res.json({
    message: 'DocQA Platform Backend API v1',
    specification: 'AI_Project_Documentation_QA_Platform_Proposal.docx (v0.1)',
    modules: [
      '/api/v1/ai',
      '/api/v1/documents',
      '/api/v1/requirements',
      '/api/v1/evidence',
      '/api/v1/testcases',
      '/api/v1/testruns',
      '/api/v1/bugs',
      '/api/v1/traceability',
      '/api/v1/audit'
    ]
  });
});
