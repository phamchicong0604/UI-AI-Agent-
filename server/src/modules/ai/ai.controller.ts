import { Router, Request, Response } from 'express';
import { AiService } from './ai.service.js';
import { aiConnectionManager } from './ai.connection.manager.js';
import { PROVIDER_MODELS } from './model.registry.js';
import { quotaService } from './quota.service.js';
import { modelFetcher } from './model.fetcher.js';
import { accountModelsService, resolveSource, ModelSyncError } from './account-models.service.js';
import { db, dbRepository } from '../../database/db.js';
import { sendSuccess, sendError } from '../../common/response.js';
import { ObservabilityService } from './observabilityService.js';
import { authenticateUser, requireAuth, requireRole, requireSystemAdmin, checkProjectAccess } from '../../common/auth.js';

export const aiRouter = Router();
const aiService = new AiService();

/**
 * GET /api/v1/ai/connection
 * Retrieves centralized AI connection status and masked configuration
 */
aiRouter.get('/connection', authenticateUser, requireAuth, (req: Request, res: Response) => {
  try {
    const config = aiConnectionManager.getActiveConnection();
    sendSuccess(res, config);
  } catch (err: any) {
    sendError(res, `Failed to get AI connection: ${err.message}`, 500);
  }
});

/**
 * POST /api/v1/ai/connection
 * Saves unified AI connection settings (API Key or CLI Subscription) - Restricted to Project Admin (R3-04)
 */
aiRouter.post('/connection', authenticateUser, requireSystemAdmin, (req: Request, res: Response) => {
  try {
    const { provider, authMethod, apiKey, baseUrl, model, effortLevel, maxOutputTokens, cliBinary } = req.body;
    const updated = aiConnectionManager.saveConnection({
      provider,
      authMethod,
      apiKey,
      baseUrl,
      model,
      effortLevel,
      maxOutputTokens,
      cliBinary
    });
    sendSuccess(res, updated, 'AI connection settings saved successfully');
  } catch (err: any) {
    sendError(res, `Failed to save AI connection: ${err.message}`, 500);
  }
});

/**
 * GET /api/v1/ai/observability
 * AI Usage & Observability Report (Epic E10-T1, E10-T2)
 */
aiRouter.get('/observability', authenticateUser, requireAuth, (req: Request, res: Response) => {
  try {
    const report = ObservabilityService.getObservabilityReport(db);
    sendSuccess(res, report);
  } catch (err: any) {
    sendError(res, `Lỗi trích xuất báo cáo quan sát AI: ${err.message}`, 500);
  }
});

/**
 * POST /api/v1/ai/connection/select-model
 * Saves a chosen model separately into SQLite and loads its per-model effort configuration.
 */
aiRouter.post('/connection/select-model', authenticateUser, requireSystemAdmin, (req: Request, res: Response) => {
  try {
    const { provider, modelId, effortLevel } = req.body;
    if (!modelId) {
      return sendError(res, 'Model ID is required', 400);
    }
    const result = aiConnectionManager.selectModel(provider, modelId, effortLevel);
    sendSuccess(res, result, `Đã lưu lựa chọn mô hình "${modelId}" riêng vào SQLite database`);
  } catch (err: any) {
    sendError(res, `Failed to select model: ${err.message}`, 500);
  }
});

/**
 * POST /api/v1/ai/connection/test
 * Tests active or pending AI connection (supports both API Key and CLI Subscription)
 */
aiRouter.post('/connection/test', authenticateUser, requireSystemAdmin, async (req: Request, res: Response) => {
  try {
    const { provider, authMethod, apiKey, baseUrl, model, effortLevel, maxOutputTokens, cliBinary } = req.body;
    const result = await aiConnectionManager.testConnection({
      provider,
      authMethod,
      apiKey,
      baseUrl,
      model,
      effortLevel,
      maxOutputTokens,
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
aiRouter.get('/connection/cli-detect', authenticateUser, requireAuth, async (req: Request, res: Response) => {
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
aiRouter.post('/connection/disconnect', authenticateUser, requireSystemAdmin, (req: Request, res: Response) => {
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
aiRouter.get('/models', authenticateUser, requireAuth, async (req: Request, res: Response) => {
  const providerQuery = req.query.provider as string | undefined;
  if (providerQuery) {
    try {
      const live = await modelFetcher.fetchLiveModels({ provider: providerQuery as any });
      return sendSuccess(res, live);
    } catch {
      // fallback
    }
  }
  sendSuccess(res, PROVIDER_MODELS);
});

/**
 * POST /api/v1/ai/models/fetch
 * Queries live models directly from provider API or local server using current credentials
 */
aiRouter.post('/models/fetch', authenticateUser, requireSystemAdmin, async (req: Request, res: Response) => {
  try {
    const { provider, authMethod, apiKey, baseUrl, cliBinary } = req.body;
    const result = await modelFetcher.fetchLiveModels({
      provider,
      authMethod,
      apiKey,
      baseUrl,
      cliBinary
    });
    sendSuccess(res, result, result.message);
  } catch (err: any) {
    sendError(res, `Failed to fetch live models: ${err.message}`, 500);
  }
});

/**
 * GET /api/v1/ai/models/account?provider=&authMethod=&cliBinary=
 * Reads the model list previously synced for this account from SQLite (no provider call).
 */
aiRouter.get('/models/account', authenticateUser, requireAuth, (req: Request, res: Response) => {
  try {
    const active = aiConnectionManager.getActiveConnection();
    const ref = {
      provider: (req.query.provider as any) || active?.provider || 'google',
      authMethod: (req.query.authMethod as any) || active?.authMethod || 'api_key',
      cliBinary: (req.query.cliBinary as string) || active?.cliBinary
    };
    const saved = accountModelsService.getSaved(ref);
    sendSuccess(res, {
      synced: Boolean(saved),
      ...(saved || { provider: ref.provider, authMethod: ref.authMethod, models: [] }),
      source: resolveSource(ref)
    });
  } catch (err: any) {
    sendError(res, `Failed to read saved models: ${err.message}`, 500);
  }
});

/**
 * POST /api/v1/ai/models/account/sync
 * Queries the connected account (CLI subscription or API key) for its models and saves them to SQLite.
 */
aiRouter.post('/models/account/sync', authenticateUser, requireSystemAdmin, async (req: Request, res: Response) => {
  const active = aiConnectionManager.getActiveConnection();
  const ref = {
    provider: req.body.provider || active?.provider || 'google',
    authMethod: req.body.authMethod || active?.authMethod || 'api_key',
    cliBinary: req.body.cliBinary || active?.cliBinary,
    apiKey: req.body.apiKey,
    baseUrl: req.body.baseUrl
  };
  try {
    const snapshot = await accountModelsService.syncAndSave(ref);
    sendSuccess(
      res,
      { synced: true, ...snapshot },
      `Đã đồng bộ và lưu ${snapshot.models.length} model từ tài khoản (${resolveSource(ref)}).`
    );
  } catch (err: any) {
    const code = err instanceof ModelSyncError ? err.code : 'failed';
    const status = code === 'auth_required' ? 401 : code === 'unsupported' ? 422 : code === 'not_installed' ? 404 : 502;
    res.status(status).json({
      success: false,
      error: err.message,
      data: {
        code,
        loginCommand: err instanceof ModelSyncError ? err.loginCommand : undefined,
        // Still return what is stored so the UI keeps showing the last good list
        saved: accountModelsService.getSaved(ref)
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/v1/ai/models/efforts?provider=
 * Retrieves all saved per-model effort configurations for a provider from SQLite.
 */
aiRouter.get('/models/efforts', authenticateUser, requireAuth, (req: Request, res: Response) => {
  try {
    const active = aiConnectionManager.getActiveConnection();
    const provider = (req.query.provider as any) || active?.provider || 'google';
    const efforts = dbRepository.modelEfforts.getAll(provider);
    sendSuccess(res, efforts, 'Per-model efforts retrieved successfully');
  } catch (err: any) {
    sendError(res, `Failed to load model efforts: ${err.message}`, 500);
  }
});

/**
 * POST /api/v1/ai/models/effort
 * Saves effort level specifically for a selected model into SQLite.
 */
aiRouter.post('/models/effort', authenticateUser, requireSystemAdmin, (req: Request, res: Response) => {
  try {
    const { provider, modelId, effortLevel, maxOutputTokens, resolvedVariant } = req.body;
    if (!modelId || !effortLevel) {
      return sendError(res, 'Both modelId and effortLevel are required', 400);
    }
    const active = aiConnectionManager.getActiveConnection();
    const targetProvider = provider || active?.provider || 'google';
    const saved = aiConnectionManager.saveModelEffort(
      targetProvider,
      modelId,
      effortLevel,
      maxOutputTokens,
      resolvedVariant
    );
    sendSuccess(res, saved, `Đã lưu mức độ out "${effortLevel}" cho mô hình "${modelId}" vào SQLite`);
  } catch (err: any) {
    sendError(res, `Failed to save model effort: ${err.message}`, 500);
  }
});

/**
 * GET /api/v1/ai/connection/quota
 * Retrieves quota, rate limit, and subscription usage for the active connection
 */
aiRouter.get('/connection/quota', authenticateUser, requireAuth, async (req: Request, res: Response) => {
  try {
    const quota = await quotaService.getQuotaInfo();
    sendSuccess(res, quota, 'Quota information retrieved successfully');
  } catch (err: any) {
    sendError(res, `Failed to retrieve quota: ${err.message}`, 500);
  }
});

/**
 * POST /api/v1/ai/connection/check-quota
 * Probes quota and limits on the fly for given provider, auth method, model, or credentials
 */
aiRouter.post('/connection/check-quota', authenticateUser, requireAuth, async (req: Request, res: Response) => {
  try {
    const { provider, authMethod, model, apiKey, baseUrl, cliBinary } = req.body;
    const quota = await quotaService.getQuotaInfo({
      provider,
      authMethod,
      model,
      apiKey,
      baseUrl,
      cliBinary
    });
    sendSuccess(res, quota, 'Live quota evaluated successfully');
  } catch (err: any) {
    sendError(res, `Quota check failed: ${err.message}`, 500);
  }
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
aiRouter.post('/generate-testcases', authenticateUser, requireAuth, async (req: Request, res: Response) => {
  try {
    const { requirement, sourceDoc, userPrompt } = req.body;
    if (!requirement || !requirement.id) {
      return sendError(res, 'Missing required field: requirement', 400);
    }

    // Resolve true projectId strictly from DB entity to prevent spoofing (BUG-001, R2-03)
    let actualProjectId: string | undefined;
    const dbReq = dbRepository.requirements.getById(requirement.id);
    if (!dbReq) {
      return sendError(res, `Requirement "${requirement.id}" không tồn tại trong cơ sở dữ liệu.`, 404);
    }
    actualProjectId = (dbReq as any).projectId;

    if (!actualProjectId && (requirement.sourceReferences?.[0]?.documentId || sourceDoc?.id)) {
      const docId = requirement.sourceReferences?.[0]?.documentId || sourceDoc?.id;
      const dbDoc = dbRepository.documents.getById(docId);
      if (dbDoc && dbDoc.projectId) {
        actualProjectId = dbDoc.projectId;
      }
    }

    // Fail-closed: Never fall back to unverified client headers or request body when requirement exists
    const projectId = actualProjectId;
    if (!projectId) {
      return sendError(res, 'Không thể xác thực dự án nguồn cho requirement này.', 403);
    }

    if (req.user && !checkProjectAccess(req.user, projectId)) {
      return sendError(res, `Bạn không có quyền sinh test case cho yêu cầu thuộc dự án "${projectId}" (BUG-001).`, 403);
    }

    // Construct prompt strictly from trusted DB requirement to prevent client data poisoning/leakage (BUG-001)
    const result = await aiService.generateGroundedDrafts({
      requirement: dbReq,
      sourceDoc,
      userPrompt,
      projectId
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
aiRouter.post('/impact-analysis', authenticateUser, requireAuth, async (req: Request, res: Response) => {
  try {
    const { documentId, requirements, testCases } = req.body;
    if (!documentId) {
      return sendError(res, 'Missing required field: documentId', 400);
    }

    const dbDoc = dbRepository.documents.getById(documentId);
    if (!dbDoc) {
      return sendError(res, `Tài liệu "${documentId}" không tồn tại trong cơ sở dữ liệu.`, 404);
    }
    if (req.user && !checkProjectAccess(req.user, dbDoc.projectId)) {
      return sendError(res, `Bạn không có quyền phân tích tác động tài liệu thuộc dự án "${dbDoc.projectId}" (BUG-001).`, 403);
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
