import { Router, Request, Response } from 'express';
import { AiService } from './ai.service.js';
import { aiConnectionManager } from './ai.connection.manager.js';
import { PROVIDER_MODELS } from './model.registry.js';
import { sendSuccess, sendError } from '../../common/response.js';

export const aiRouter = Router();
const aiService = new AiService();

/**
 * GET /api/v1/ai/connection
 * Retrieves centralized AI connection status and masked configuration
 */
aiRouter.get('/connection', (req: Request, res: Response) => {
  try {
    const config = aiConnectionManager.getActiveConnection();
    sendSuccess(res, config);
  } catch (err: any) {
    sendError(res, `Failed to get AI connection: ${err.message}`, 500);
  }
});

/**
 * POST /api/v1/ai/connection
 * Saves unified AI connection settings (API Key or CLI Subscription)
 */
aiRouter.post('/connection', (req: Request, res: Response) => {
  try {
    const { provider, authMethod, apiKey, baseUrl, model, cliBinary } = req.body;
    const updated = aiConnectionManager.saveConnection({
      provider,
      authMethod,
      apiKey,
      baseUrl,
      model,
      cliBinary
    });
    sendSuccess(res, updated, 'AI connection settings saved successfully');
  } catch (err: any) {
    sendError(res, `Failed to save AI connection: ${err.message}`, 500);
  }
});

/**
 * POST /api/v1/ai/connection/test
 * Tests active or pending AI connection (supports both API Key and CLI Subscription)
 */
aiRouter.post('/connection/test', async (req: Request, res: Response) => {
  try {
    const { provider, authMethod, apiKey, baseUrl, model, cliBinary } = req.body;
    const result = await aiConnectionManager.testConnection({
      provider,
      authMethod,
      apiKey,
      baseUrl,
      model,
      cliBinary
    });

    sendSuccess(res, result, result.message);
  } catch (err: any) {
    sendError(res, `Connection test failed: ${err.message}`, 500);
  }
});

/**
 * GET /api/v1/ai/connection/cli-detect
 * Probes the local system for supported CLI tools (claude, gh, agy, gemini)
 */
aiRouter.get('/connection/cli-detect', async (req: Request, res: Response) => {
  try {
    const detected = await aiConnectionManager.detectInstalledClis();
    sendSuccess(res, detected, 'CLI tools detected successfully');
  } catch (err: any) {
    sendError(res, `Failed to detect CLI tools: ${err.message}`, 500);
  }
});

/**
 * POST /api/v1/ai/connection/disconnect
 * Disconnects the active AI provider
 */
aiRouter.post('/connection/disconnect', (req: Request, res: Response) => {
  try {
    aiConnectionManager.disconnect();
    sendSuccess(res, { connectionStatus: 'disconnected' }, 'AI connection disconnected');
  } catch (err: any) {
    sendError(res, `Failed to disconnect AI: ${err.message}`, 500);
  }
});

/**
 * GET /api/v1/ai/models
 * Returns the model registry options for all supported AI providers
 */
aiRouter.get('/models', (req: Request, res: Response) => {
  sendSuccess(res, PROVIDER_MODELS);
});

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
