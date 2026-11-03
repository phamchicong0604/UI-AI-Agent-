import { dbRepository } from '../../database/db.js';
import { 
  AiConnectionConfig, 
  AiProviderId, 
  AiAuthMethod, 
  AiConnectionStatus, 
  CliDetectionInfo,
  ReasoningEffortLevel
} from '../../common/types.js';
import { APIKeyAuthenticator } from './authenticators/api-key.authenticator.js';
import { CLIAuthenticator } from './authenticators/cli.authenticator.js';
import { PROVIDER_MODELS } from './model.registry.js';

export class AIConnectionManager {
  private apiKeyAuth = new APIKeyAuthenticator();
  private cliAuth = new CLIAuthenticator();

  private maskKey(key?: string): string {
    if (!key) return '';
    if (key.length <= 8) return '********';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }

  /**
   * Retrieves active AI connection configuration with masked credentials.
   */
  getActiveConnection(): AiConnectionConfig {
    let conn = dbRepository.aiConnections.get();
    if (!conn) {
      conn = dbRepository.aiConnections.save({
        provider: 'google',
        authMethod: 'api_key',
        model: 'gemini-4-argon-medium',
        connectionStatus: 'disconnected'
      });
    }

    return {
      ...conn,
      apiKey: undefined, // Do not expose raw key
      maskedApiKey: this.maskKey(conn.apiKey)
    };
  }

  /**
   * Saves or updates the centralized AI connection configuration.
   */
  saveConnection(payload: {
    provider?: AiProviderId;
    authMethod?: AiAuthMethod;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    effortLevel?: any;
    maxOutputTokens?: number;
    cliBinary?: string;
  }): AiConnectionConfig {
    const existing = dbRepository.aiConnections.get();
    
    // Only update API key if provided and not a masked placeholder
    let newApiKey = existing?.apiKey;
    if (payload.apiKey !== undefined && !payload.apiKey.includes('...')) {
      newApiKey = payload.apiKey.trim();
    }

    // Default model if provider changed
    const targetProvider = payload.provider || existing?.provider || 'google';
    let targetModel = payload.model || existing?.model;
    const availableModels = PROVIDER_MODELS[targetProvider] || [];
    if (!targetModel || !availableModels.some(m => m.id === targetModel)) {
      targetModel = availableModels[0]?.id || 'gemini-4-argon-medium';
    }

    const updated = dbRepository.aiConnections.save({
      provider: targetProvider,
      authMethod: payload.authMethod || existing?.authMethod || 'api_key',
      apiKey: newApiKey,
      baseUrl: payload.baseUrl !== undefined ? payload.baseUrl.trim() : existing?.baseUrl,
      model: targetModel,
      effortLevel: payload.effortLevel || existing?.effortLevel || 'medium',
      maxOutputTokens: payload.maxOutputTokens || existing?.maxOutputTokens || 32768,
      cliBinary: payload.cliBinary || existing?.cliBinary || 'claude'
    });

    // Also sync to legacy settings for backwards compatibility
    if (updated.provider) dbRepository.settings.set('AI_PROVIDER', updated.provider === 'google' ? 'gemini' : updated.provider);
    if (updated.model) {
      if (updated.provider === 'google') dbRepository.settings.set('GEMINI_MODEL', updated.model);
      if (updated.provider === 'openai') dbRepository.settings.set('OPENAI_MODEL', updated.model);
    }
    if (updated.apiKey) {
      if (updated.provider === 'google') dbRepository.settings.set('GEMINI_API_KEY', updated.apiKey);
      if (updated.provider === 'openai') dbRepository.settings.set('OPENAI_API_KEY', updated.apiKey);
    }

    return {
      ...updated,
      apiKey: undefined,
      maskedApiKey: this.maskKey(updated.apiKey)
    };
  }

  /**
   * Tests connection with active credentials or newly passed test parameters.
   */
  async testConnection(override?: {
    provider?: AiProviderId;
    authMethod?: AiAuthMethod;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    effortLevel?: ReasoningEffortLevel;
    maxOutputTokens?: number;
    cliBinary?: string;
  }): Promise<{
    success: boolean;
    message: string;
    latencyMs: number;
    connectionStatus: AiConnectionStatus;
    details?: any;
  }> {
    const active = dbRepository.aiConnections.get();
    const provider = override?.provider || active?.provider || 'google';
    const authMethod = override?.authMethod || active?.authMethod || 'api_key';
    const model = override?.model || active?.model || 'gemini-4-argon-medium';
    const baseUrl = override?.baseUrl !== undefined ? override.baseUrl : active?.baseUrl;
    const effortLevel = override?.effortLevel || active?.effortLevel || 'medium';
    const maxOutputTokens = override?.maxOutputTokens || active?.maxOutputTokens || 32768;
    const cliBinary = override?.cliBinary || active?.cliBinary || 'claude';

    // Retrieve API key
    let apiKey = override?.apiKey;
    if (!apiKey || apiKey.includes('...')) {
      apiKey = active?.apiKey || '';
    }

    if (authMethod === 'api_key') {
      const res = await this.apiKeyAuth.testConnection(provider, apiKey, model, baseUrl);
      const newStatus: AiConnectionStatus = res.success ? 'connected' : 'error';
      dbRepository.aiConnections.updateStatus(newStatus, res.latencyMs, res.success ? undefined : res.message);
      return {
        success: res.success,
        message: res.message,
        latencyMs: res.latencyMs,
        connectionStatus: newStatus,
        details: res.details
      };
    } else {
      // CLI Subscription test with model and reasoning effort
      const res = await this.cliAuth.testConnection(cliBinary, { model, effortLevel });
      const newStatus: AiConnectionStatus = res.success ? 'connected' : (res.authStatus === 'unauthenticated' ? 'auth_required' : 'error');
      dbRepository.aiConnections.updateStatus(newStatus, res.latencyMs, res.success ? undefined : res.message);
      return {
        success: res.success,
        message: res.message,
        latencyMs: res.latencyMs,
        connectionStatus: newStatus,
        details: res.details
      };
    }
  }

  /**
   * Scans system for installed CLI tools and verifies authentication status.
   */
  async detectInstalledClis(): Promise<CliDetectionInfo[]> {
    return this.cliAuth.detectInstalledClis();
  }

  /**
   * Disconnects the active AI connection.
   */
  disconnect(): void {
    dbRepository.aiConnections.updateStatus('disconnected', 0, undefined);
  }

  /**
   * Unified completion execution: automatically dispatches to API Key or CLI Subscription.
   */
  async generateCompletion(systemPrompt: string, userPrompt: string): Promise<string> {
    const active = dbRepository.aiConnections.get();
    if (!active) {
      throw new Error('No AI connection configured.');
    }

    if (active.authMethod === 'cli_subscription') {
      const cliBinary = active.cliBinary || 'claude';
      return await this.cliAuth.executePrompt(cliBinary, systemPrompt, userPrompt, {
        model: active.model,
        effortLevel: active.effortLevel,
        maxOutputTokens: active.maxOutputTokens
      });
    } else {
      const apiKey = active.apiKey || '';
      if (!apiKey) {
        throw new Error(`API Key for ${active.provider} is not configured.`);
      }
      return await this.apiKeyAuth.generateCompletion(
        active.provider,
        apiKey,
        active.model,
        systemPrompt,
        userPrompt,
        active.baseUrl,
        {
          maxTokens: active.maxOutputTokens,
          effortLevel: active.effortLevel
        }
      );
    }
  }
}

export const aiConnectionManager = new AIConnectionManager();
