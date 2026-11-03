import dotenv from 'dotenv';
dotenv.config();

import { app } from './app.js';

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 DocQA Backend Server running on http://localhost:${PORT}`);
  console.log(`🤖 AI Engine: Unified AI Connection Manager`);
  console.log(`📖 API Spec: AI_Project_Documentation_QA_Platform_Proposal.docx`);
  console.log(`🛡️  SHA-256 Checksum & Chained Audit Logging: Enabled`);
  console.log(`====================================================`);
});
