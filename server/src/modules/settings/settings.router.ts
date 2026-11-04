import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response.js';
import { dbRepository } from '../../database/db.js';
import { authenticateUser, requireAuth, requireRole, requireSystemAdmin } from '../../common/auth.js';

export const settingsRouter = Router();

/**
 * GET /api/v1/settings/ai
 * Retrieves current AI configuration (with API keys masked for security)
 */
settingsRouter.get('/ai', authenticateUser, requireAuth, (req: Request, res: Response) => {
  const provider = dbRepository.settings.get('AI_PROVIDER') || process.env.AI_PROVIDER || 'gemini';
  const geminiModel = dbRepository.settings.get('GEMINI_MODEL') || process.env.GEMINI_MODEL || 'gemini-1.5-pro';
  const openaiModel = dbRepository.settings.get('OPENAI_MODEL') || process.env.OPENAI_MODEL || 'gpt-4o';
  
  const rawGeminiKey = dbRepository.settings.get('GEMINI_API_KEY') || process.env.GEMINI_API_KEY || '';
  const rawOpenAiKey = dbRepository.settings.get('OPENAI_API_KEY') || process.env.OPENAI_API_KEY || '';

  const maskKey = (key: string) => {
    if (!key) return '';
    if (key.length <= 8) return '********';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  };

  sendSuccess(res, {
    provider,
    geminiModel,
    openaiModel,
    hasGeminiKey: !!rawGeminiKey,
    hasOpenAiKey: !!rawOpenAiKey,
    maskedGeminiKey: maskKey(rawGeminiKey),
    maskedOpenAiKey: maskKey(rawOpenAiKey),
    fallbackEngineAvailable: true
  });
});

/**
 * POST /api/v1/settings/ai
 * Updates AI provider, model, and API keys into persistent SQLite storage
 */
settingsRouter.post('/ai', authenticateUser, requireSystemAdmin, (req: Request, res: Response) => {
  const { provider, geminiKey, openaiKey, geminiModel, openaiModel } = req.body;

  if (provider && ['gemini', 'openai'].includes(provider)) {
    dbRepository.settings.set('AI_PROVIDER', provider);
  }

  if (geminiModel) {
    dbRepository.settings.set('GEMINI_MODEL', geminiModel);
  }

  if (openaiModel) {
    dbRepository.settings.set('OPENAI_MODEL', openaiModel);
  }

  // Only update keys if provided and not masked placeholder
  if (geminiKey && !geminiKey.includes('...')) {
    dbRepository.settings.set('GEMINI_API_KEY', geminiKey.trim());
  }

  if (openaiKey && !openaiKey.includes('...')) {
    dbRepository.settings.set('OPENAI_API_KEY', openaiKey.trim());
  }

  sendSuccess(res, { success: true }, 'AI configuration saved successfully to SQLite database');
});

/**
 * POST /api/v1/settings/ai/test-connection
 * Tests connection to active AI provider (Gemini or OpenAI) with a simple prompt
 */
settingsRouter.post('/ai/test-connection', authenticateUser, requireSystemAdmin, async (req: Request, res: Response) => {
  const provider = dbRepository.settings.get('AI_PROVIDER') || process.env.AI_PROVIDER || 'gemini';
  const startTime = Date.now();

  try {
    if (provider === 'gemini') {
      const apiKey = dbRepository.settings.get('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return sendError(res, 'Chưa cấu hình GEMINI_API_KEY. Vui lòng nhập API Key trước khi kiểm tra.', 400);
      }
      const model = dbRepository.settings.get('GEMINI_MODEL') || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Hello, reply with "PONG" only.' }] }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        return sendError(res, `Gemini API Error (${response.status}): ${errText}`, 400);
      }

      const latencyMs = Date.now() - startTime;
      return sendSuccess(res, {
        provider: 'Gemini',
        model,
        latencyMs,
        status: 'Connected successfully'
      }, `Kết nối thành công đến Google Gemini (${latencyMs}ms)`);
    } else {
      const apiKey = dbRepository.settings.get('OPENAI_API_KEY') || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return sendError(res, 'Chưa cấu hình OPENAI_API_KEY. Vui lòng nhập API Key trước khi kiểm tra.', 400);
      }
      const model = dbRepository.settings.get('OPENAI_MODEL') || 'gpt-4o-mini';
      const url = 'https://api.openai.com/v1/chat/completions';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Hello, reply with "PONG" only.' }],
          max_tokens: 10
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        return sendError(res, `OpenAI API Error (${response.status}): ${errText}`, 400);
      }

      const latencyMs = Date.now() - startTime;
      return sendSuccess(res, {
        provider: 'OpenAI',
        model,
        latencyMs,
        status: 'Connected successfully'
      }, `Kết nối thành công đến OpenAI (${latencyMs}ms)`);
    }
  } catch (err: any) {
    return sendError(res, `Lỗi kiểm tra kết nối: ${err.message}`, 500);
  }
});
