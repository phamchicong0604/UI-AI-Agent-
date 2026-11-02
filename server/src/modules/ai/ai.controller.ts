import { Router, Request, Response } from 'express';
import { AiService } from './ai.service.js';
import { sendSuccess, sendError } from '../../common/response.js';

export const aiRouter = Router();
const aiService = new AiService();

/**
 * GET /api/v1/ai/status
 * Returns active AI engine readiness, model provider, and governance policies
 */
aiRouter.get('/status', (req: Request, res: Response) => {
  const provider = process.env.AI_PROVIDER || 'gemini';
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
  const hasOpenaiKey = Boolean(process.env.OPENAI_API_KEY);

  sendSuccess(res, {
    provider,
    isCloudReady: (provider === 'gemini' && hasGeminiKey) || (provider === 'openai' && hasOpenaiKey),
    fallbackEngine: 'Grounded Deterministic Engine (Offline & Test ready)',
    governancePolicies: {
      groundedOutput: true,
      noSilentAssumptions: true,
      humanInTheLoopDraftOnly: true,
      sha256Verification: true
    }
  });
});

/**
 * POST /api/v1/ai/generate-testcases
 * Synthesizes grounded test cases from an approved requirement
 */
aiRouter.post('/generate-testcases', async (req: Request, res: Response) => {
  try {
    const { requirement, sourceDoc, userPrompt } = req.body;
    if (!requirement || !requirement.id) {
      return sendError(res, 'Missing required field: requirement', 400);
    }

    const result = await aiService.generateGroundedDrafts({
      requirement,
      sourceDoc,
      userPrompt
    });

    sendSuccess(res, result, 'Successfully generated grounded test cases');
  } catch (err: any) {
    sendError(res, err.message || 'Failed to generate test cases', 500);
  }
});

/**
 * POST /api/v1/ai/impact-analysis
 * Analyzes blast radius of changes to documents and requirements
 */
aiRouter.post('/impact-analysis', async (req: Request, res: Response) => {
  try {
    const { documentId, requirements, testCases } = req.body;
    if (!documentId) {
      return sendError(res, 'Missing required field: documentId', 400);
    }

    const result = await aiService.analyzeChangeImpact({
      documentId,
      requirements: requirements || [],
      testCases: testCases || []
    });

    sendSuccess(res, result, 'Change impact analysis completed');
  } catch (err: any) {
    sendError(res, err.message || 'Failed to analyze change impact', 500);
  }
});
