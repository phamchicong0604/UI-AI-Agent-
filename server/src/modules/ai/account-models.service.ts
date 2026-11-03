import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  AiProviderId,
  AiAuthMethod,
  ModelOption,
  AccountModelSnapshot
} from '../../common/types.js';
import { PROVIDER_MODELS } from './model.registry.js';
import { dbRepository } from '../../database/db.js';

const execFileAsync = promisify(execFile);

const cliEnv = () => ({
  ...process.env,
  PATH: `${process.env.HOME || ''}/.local/bin:/usr/local/bin:/opt/homebrew/bin:${process.env.PATH || ''}`
});

export type ModelSyncErrorCode = 'auth_required' | 'unsupported' | 'not_installed' | 'failed';

export class ModelSyncError extends Error {
  constructor(
    public code: ModelSyncErrorCode,
    message: string,
    public loginCommand?: string
  ) {
    super(message);
  }
}

export interface AccountRef {
  provider: AiProviderId;
  authMethod: AiAuthMethod;
  cliBinary?: string;
  apiKey?: string;
  baseUrl?: string;
}

/** Stable key identifying which account a model list belongs to. */
export function resolveSource(ref: AccountRef): string {
  return ref.authMethod === 'cli_subscription'
    ? `cli:${ref.cliBinary || 'claude'}`
    : `api:${ref.provider}`;
}

/**
 * Builds a ModelOption from a raw id/name returned by the provider account.
 * Known catalog metadata (context window, limits) is reused when the id matches;
 * otherwise conservative defaults are used. The id/name always come from the account.
 */
function enrich(id: string, name: string, extra?: Partial<ModelOption>): ModelOption {
  const known = Object.values(PROVIDER_MODELS).flat().find(m => m.id === id);
  const lower = id.toLowerCase();
  const isFast = /flash|mini|haiku|low|nano/.test(lower);
  const isReasoning = /argon|opus|pro|high|o1|o3|reason|think/.test(lower);
  return {
    id,
    name: name || known?.name || id,
    description: extra?.description || known?.description || `Model "${id}" khả dụng trong tài khoản của bạn`,
    recommended: known?.recommended ?? false,
    contextWindow: extra?.contextWindow || known?.contextWindow || '—',
    maxOutput: extra?.maxOutput || known?.maxOutput || '—',
    category: known?.category || (isReasoning ? 'reasoning' : isFast ? 'fast' : 'flagship'),
    rateLimits: known?.rateLimits || { rpm: 0, tpm: 0 },
    pricingType: extra?.pricingType || known?.pricingType || 'token_billed',
    bestFor: known?.bestFor || '',
    isLive: true
  };
}

export class AccountModelsService {
  /** Reads the last synced model list for the account from SQLite. */
  getSaved(ref: AccountRef): AccountModelSnapshot | null {
    return dbRepository.aiModels.getForAccount(ref.provider, ref.authMethod, resolveSource(ref));
  }

  /**
   * Queries the provider account for its available models and persists them.
   * On failure nothing is written, so the previously saved list is preserved.
   */
  async syncAndSave(ref: AccountRef): Promise<AccountModelSnapshot> {
    const { models, account } = ref.authMethod === 'cli_subscription'
      ? await this.fromCli(ref.cliBinary || 'claude')
      : await this.fromApi(ref);

    if (models.length === 0) {
      throw new ModelSyncError('failed', 'Tài khoản không trả về model nào.');
    }

    return dbRepository.aiModels.replaceForAccount({
      provider: ref.provider,
      authMethod: ref.authMethod,
      source: resolveSource(ref),
      account,
      models
    });
  }

  /* ------------------------------ CLI subscription ------------------------------ */

  private async fromCli(cli: string): Promise<{ models: ModelOption[]; account?: string }> {
    try {
      await execFileAsync('which', [cli], { env: cliEnv(), timeout: 3000 });
    } catch {
      throw new ModelSyncError('not_installed', `CLI "${cli}" chưa được cài đặt trên máy.`);
    }

    if (cli === 'agy') {
      let stdout = '';
      try {
        ({ stdout } = await execFileAsync('agy', ['models'], { env: cliEnv(), timeout: 15000 }));
      } catch (err: any) {
        const text = `${err.stdout || ''} ${err.stderr || ''} ${err.message}`;
        if (/auth|login|unauthor/i.test(text)) {
          throw new ModelSyncError('auth_required', 'Antigravity CLI chưa đăng nhập.', 'agy auth');
        }
        throw new ModelSyncError('failed', `Không chạy được "agy models": ${err.message}`);
      }
      // Output format: "<model-id>\t<Display Name>" or space-separated per line (first line is a progress message)
      const models = stdout
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.toLowerCase().includes('fetching'))
        .map(l => {
          if (l.includes('\t')) {
            const [id, name] = l.split('\t').map(s => s.trim());
            return enrich(id, name, { pricingType: 'subscription_included' });
          }
          const parts = l.split(/\s{2,}/);
          if (parts.length >= 2) {
            return enrich(parts[0].trim(), parts[1].trim(), { pricingType: 'subscription_included' });
          }
          return null;
        })
        .filter(Boolean) as ModelOption[];
      return { models, account: 'Antigravity subscription' };
    }

    if (cli === 'claude') {
      let status: any = {};
      try {
        const { stdout } = await execFileAsync('claude', ['auth', 'status'], { env: cliEnv(), timeout: 8000 });
        status = JSON.parse(stdout);
      } catch (err: any) {
        try { status = JSON.parse(err.stdout || '{}'); } catch { status = {}; }
      }
      if (!status.loggedIn) {
        throw new ModelSyncError('auth_required', 'Claude Code CLI chưa đăng nhập tài khoản Subscription.', 'claude login');
      }
      // Claude Code has no command to enumerate models; it accepts these documented aliases
      // which always resolve to the latest model of each family for the logged-in plan.
      const aliases: Array<[string, string]> = [
        ['sonnet', 'Claude Sonnet (latest – alias)'],
        ['opus', 'Claude Opus (latest – alias)'],
        ['haiku', 'Claude Haiku (latest – alias)']
      ];
      return {
        models: aliases.map(([id, name]) =>
          enrich(id, name, {
            pricingType: 'subscription_included',
            description: `Alias "${id}" của Claude Code – tự trỏ tới model mới nhất mà gói của bạn được dùng`
          })
        ),
        account: status.email || status.account?.email || status.authMethod
      };
    }

    throw new ModelSyncError(
      'unsupported',
      `CLI "${cli}" không cung cấp lệnh liệt kê model theo tài khoản. Hãy dùng Antigravity CLI (agy), Claude Code hoặc API Key.`
    );
  }

  /* ---------------------------------- API key ---------------------------------- */

  private async fromApi(ref: AccountRef): Promise<{ models: ModelOption[]; account?: string }> {
    const active = dbRepository.aiConnections.get();
    let apiKey = ref.apiKey;
    if (!apiKey || apiKey.includes('...')) apiKey = active?.apiKey || '';
    const baseUrl = ref.baseUrl ?? active?.baseUrl;

    if (!apiKey && ref.provider !== 'custom') {
      throw new ModelSyncError('auth_required', 'Chưa có API Key để truy vấn danh sách model.');
    }

    const get = async (url: string, headers: Record<string, string>) => {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
      if (res.status === 401 || res.status === 403) {
        throw new ModelSyncError('auth_required', `API Key không hợp lệ hoặc không có quyền (${res.status}).`);
      }
      if (!res.ok) throw new ModelSyncError('failed', `Provider trả về lỗi ${res.status}: ${await res.text()}`);
      return res.json() as Promise<any>;
    };

    if (ref.provider === 'google') {
      const models: ModelOption[] = [];
      let pageToken = '';
      do {
        const json = await get(
          `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`,
          { 'x-goog-api-key': apiKey }
        );
        for (const m of json.models || []) {
          if (!m.supportedGenerationMethods?.includes('generateContent')) continue;
          const id = String(m.name).replace('models/', '');
          models.push(enrich(id, m.displayName, {
            description: m.description,
            contextWindow: m.inputTokenLimit ? `${m.inputTokenLimit.toLocaleString('en-US')} tokens` : undefined,
            maxOutput: m.outputTokenLimit ? `${m.outputTokenLimit.toLocaleString('en-US')} tokens` : undefined
          }));
        }
        pageToken = json.nextPageToken || '';
      } while (pageToken);
      return { models, account: 'Google AI Studio API key' };
    }

    if (ref.provider === 'anthropic') {
      const json = await get('https://api.anthropic.com/v1/models?limit=1000', {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      });
      return {
        models: (json.data || []).map((m: any) => enrich(m.id, m.display_name)),
        account: 'Anthropic API key'
      };
    }

    // OpenAI or any OpenAI-compatible endpoint (custom)
    const root = (baseUrl || (ref.provider === 'openai' ? 'https://api.openai.com/v1' : 'http://localhost:11434/v1')).replace(/\/+$/, '');
    try {
      const json = await get(`${root}/models`, apiKey ? { Authorization: `Bearer ${apiKey}` } : {});
      const list = (json.data || [])
        .map((m: any) => String(m.id))
        .filter((id: string) => !/embedding|whisper|tts|dall-e|moderation|transcribe|image/i.test(id))
        .sort();
      return {
        models: list.map((id: string) => enrich(id, id)),
        account: ref.provider === 'openai' ? 'OpenAI API key' : root
      };
    } catch (err) {
      // Ollama native fallback for custom endpoints
      if (ref.provider === 'custom') {
        const ollamaRoot = root.replace(/\/v1$/, '');
        const json = await get(`${ollamaRoot}/api/tags`, {});
        return {
          models: (json.models || []).map((m: any) => enrich(m.name, m.name)),
          account: ollamaRoot
        };
      }
      throw err;
    }
  }
}

export const accountModelsService = new AccountModelsService();
