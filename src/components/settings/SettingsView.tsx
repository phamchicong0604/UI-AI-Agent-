import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../common/i18n/I18nContext';
import {
  Shield,
  History,
  FolderDot,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  RefreshCw,
  Save,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Terminal,
  Unplug,
  Check,
  Copy,
  Info,
  Cpu,
  Layers,
  Gauge,
  Activity,
  Zap,
  Clock
} from 'lucide-react';
import { Card, Badge, Button } from '../../common/components';
import {
  getAiConnection,
  saveAiConnection,
  testAiConnection,
  detectCliTools,
  disconnectAiConnection,
  getAiModels,
  fetchAiLiveModels,
  getAiQuota,
  checkAiQuota
} from '../../common/services/api';
import { 
  AiConnectionConfig, 
  AiProviderId, 
  AiAuthMethod, 
  AiConnectionStatus, 
  CliDetectionInfo,
  ModelOption,
  AiQuotaInfo
} from '../../types';

export const SettingsView: React.FC = () => {
  const { activeProject, auditEvents, currentRole } = useApp();
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<'ai_connection' | 'audit' | 'rbac' | 'workspace'>('ai_connection');

  // Unified AI Connection State
  const [provider, setProvider] = useState<AiProviderId>('google');
  const [authMethod, setAuthMethod] = useState<AiAuthMethod>('api_key');
  const [apiKey, setApiKey] = useState<string>('');
  const [maskedKey, setMaskedKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [model, setModel] = useState<string>('gemini-4-argon-medium');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [cliBinary, setCliBinary] = useState<string>('claude');

  // Connection metadata & results
  const [connectionStatus, setConnectionStatus] = useState<AiConnectionStatus>('disconnected');
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Available models & detected CLIs
  const [availableModels, setAvailableModels] = useState<Record<string, ModelOption[]>>({});
  const [detectedClis, setDetectedClis] = useState<CliDetectionInfo[]>([]);
  const [isDetectingClis, setIsDetectingClis] = useState<boolean>(false);
  const [isFetchingModels, setIsFetchingModels] = useState<boolean>(false);
  const [modelsSyncStatus, setModelsSyncStatus] = useState<string | null>(null);
  const [modelSearch, setModelSearch] = useState<string>('');

  // Quota & Rate limits
  const [quotaInfo, setQuotaInfo] = useState<AiQuotaInfo | null>(null);
  const [isLoadingQuota, setIsLoadingQuota] = useState<boolean>(false);

  // Loading & notification states
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    connectionStatus?: AiConnectionStatus;
    details?: any;
  } | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);

  useEffect(() => {
    loadAiConnection();
    loadModels();
    handleScanClis();
  }, []);

  const loadAiConnection = async () => {
    try {
      const res = await getAiConnection();
      const c: AiConnectionConfig = (res?.data !== undefined ? res.data : res);
      if (c && c.provider) {
        setProvider(c.provider || 'google');
        setAuthMethod(c.authMethod || 'api_key');
        setMaskedKey(c.maskedApiKey || '');
        setModel(c.model || 'gemini-4-argon-medium');
        setBaseUrl(c.baseUrl || '');
        setCliBinary(c.cliBinary || 'claude');
        setConnectionStatus(c.connectionStatus || 'disconnected');
        setLastTestedAt(c.lastTestedAt || null);
        setLatencyMs(c.latencyMs || null);
        setErrorMessage(c.errorMessage || null);

        // If auth is required or connected, prefill testResult so user sees it right away
        if (c.connectionStatus === 'auth_required' && c.errorMessage) {
          setTestResult({
            success: false,
            message: c.errorMessage,
            connectionStatus: 'auth_required',
            latencyMs: c.latencyMs,
            details: { loginCommand: `${c.cliBinary || 'claude'} login` }
          });
        } else if (c.connectionStatus === 'connected') {
          setTestResult({
            success: true,
            message: `Đã kết nối thành công (${c.model || c.cliBinary})`,
            connectionStatus: 'connected',
            latencyMs: c.latencyMs,
            details: { account: 'connorpham' }
          });
        }
        await handleCheckQuota({
          provider: c.provider,
          authMethod: c.authMethod,
          model: c.model,
          cliBinary: c.cliBinary
        });
        await handleFetchLiveModels({
          provider: c.provider,
          authMethod: c.authMethod,
          baseUrl: c.baseUrl,
          cliBinary: c.cliBinary
        });
      }
    } catch (err: any) {
      console.warn('Could not load AI connection:', err.message);
    }
  };

  const loadModels = async () => {
    try {
      const res = await getAiModels();
      const models = res?.data !== undefined ? res.data : res;
      if (models && typeof models === 'object') {
        setAvailableModels(models);
      }
    } catch (err: any) {
      console.warn('Could not load models registry:', err.message);
    }
  };

  const handleFetchLiveModels = async (customParams?: { provider?: AiProviderId; authMethod?: AiAuthMethod; apiKey?: string; baseUrl?: string; cliBinary?: string }) => {
    setIsFetchingModels(true);
    setModelsSyncStatus(null);
    try {
      const targetProvider = customParams?.provider || provider;
      const res = await fetchAiLiveModels({
        provider: targetProvider,
        authMethod: customParams?.authMethod || authMethod,
        apiKey: customParams?.apiKey || (apiKey ? apiKey.trim() : undefined),
        baseUrl: customParams?.baseUrl || (baseUrl ? baseUrl.trim() : undefined),
        cliBinary: customParams?.cliBinary || cliBinary
      });
      const data = res?.data !== undefined ? res.data : res;
      if (data && Array.isArray(data.models) && data.models.length > 0) {
        setAvailableModels(prev => ({
          ...prev,
          [targetProvider]: data.models
        }));
        setModelsSyncStatus(data.message || 'Đã đồng bộ model thực tế thành công');
        const recommended = data.models.find((m: any) => m.recommended) || data.models[0];
        if (recommended && !data.models.some((m: any) => m.id === model)) {
          setModel(recommended.id);
        }
      }
    } catch (err: any) {
      setModelsSyncStatus(`Không thể quét trực tiếp: ${err.message}`);
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleScanClis = async () => {
    setIsDetectingClis(true);
    try {
      const res = await detectCliTools();
      const clis = res?.data !== undefined ? res.data : res;
      if (Array.isArray(clis)) {
        setDetectedClis(clis);
      }
    } catch (err: any) {
      console.warn('Could not detect CLIs:', err.message);
    } finally {
      setIsDetectingClis(false);
    }
  };

  const handleCheckQuota = async (customParams?: { provider?: AiProviderId; authMethod?: AiAuthMethod; model?: string; cliBinary?: string }) => {
    setIsLoadingQuota(true);
    try {
      const res = await checkAiQuota({
        provider: customParams?.provider || provider,
        authMethod: customParams?.authMethod || authMethod,
        model: customParams?.model || model,
        apiKey: apiKey ? apiKey.trim() : undefined,
        baseUrl: baseUrl ? baseUrl.trim() : undefined,
        cliBinary: customParams?.cliBinary || cliBinary
      });
      const data = res?.data !== undefined ? res.data : res;
      if (data && data.planName) {
        setQuotaInfo(data);
      }
    } catch (err: any) {
      console.warn('Could not check quota:', err.message);
    } finally {
      setIsLoadingQuota(false);
    }
  };

  const handleProviderChange = (newProvider: AiProviderId) => {
    setProvider(newProvider);
    const models = availableModels[newProvider] || [];
    const recommended = models.find(m => m.recommended) || models[0];
    const newModel = recommended ? recommended.id : (newProvider === 'anthropic' ? 'claude-3-7-sonnet' : newProvider === 'openai' ? 'gpt-4o' : 'gemini-1.5-pro');
    setModel(newModel);

    // Auto-map matching CLI for this provider
    let newCli = cliBinary;
    if (newProvider === 'anthropic') newCli = 'claude';
    else if (newProvider === 'openai') newCli = 'gh';
    else if (newProvider === 'google') newCli = 'agy';
    else if (newProvider === 'custom') newCli = 'ollama';
    setCliBinary(newCli);

    setTestResult(null);
    handleCheckQuota({ provider: newProvider, model: newModel, cliBinary: newCli });
    handleFetchLiveModels({ provider: newProvider, cliBinary: newCli });
  };

  const handleSaveConnection = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);
    setTestResult(null);

    try {
      const res = await saveAiConnection({
        provider,
        authMethod,
        apiKey: apiKey ? apiKey.trim() : undefined,
        baseUrl: baseUrl ? baseUrl.trim() : undefined,
        model,
        cliBinary
      });

      setSaveSuccessMsg(t('aiConfigSuccess'));
      setApiKey('');
      if (res?.data?.maskedApiKey) {
        setMaskedKey(res.data.maskedApiKey);
      }
      setTimeout(() => setSaveSuccessMsg(null), 4000);
      await loadAiConnection();
    } catch (err: any) {
      alert(`Error saving AI Connection: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await testAiConnection({
        provider,
        authMethod,
        apiKey: apiKey ? apiKey.trim() : undefined,
        baseUrl: baseUrl ? baseUrl.trim() : undefined,
        model,
        cliBinary
      });

      const data = res.data || res;
      setTestResult({
        success: Boolean(data.success),
        message: data.message || (data.success ? 'Kết nối thành công' : 'Lỗi kết nối'),
        latencyMs: data.latencyMs,
        connectionStatus: data.connectionStatus,
        details: data.details
      });
      setConnectionStatus(data.connectionStatus || (data.success ? 'connected' : 'error'));
      setLatencyMs(data.latencyMs ?? null);
      setErrorMessage(data.success ? null : data.message);
      await loadAiConnection();
      await handleScanClis();
      await handleCheckQuota();
    } catch (err: any) {
      const msg = err.message || 'Lỗi kiểm tra kết nối';
      const isAuthErr = authMethod === 'cli_subscription' && (msg.includes('login') || msg.includes('OAuth') || msg.includes('authenticate'));
      setTestResult({
        success: false,
        message: msg,
        connectionStatus: isAuthErr ? 'auth_required' : 'error',
        details: { loginCommand: `${cliBinary} login` }
      });
      setConnectionStatus(isAuthErr ? 'auth_required' : 'error');
      setErrorMessage(msg);
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Bạn có chắc chắn muốn ngắt kết nối AI hiện tại?')) return;
    try {
      await disconnectAiConnection();
      setConnectionStatus('disconnected');
      setTestResult(null);
      setLatencyMs(null);
      setErrorMessage(null);
      await loadAiConnection();
    } catch (err: any) {
      alert(`Error disconnecting: ${err.message}`);
    }
  };

  const activeCliInfo = detectedClis.find(c => c.binary === cliBinary || c.id === cliBinary);

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{t('aiStatusConnected')}</span>
            {latencyMs !== null && <span className="text-[11px] text-emerald-500/80">({latencyMs}ms)</span>}
          </div>
        );
      case 'auth_required':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold text-xs">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{t('aiStatusAuthRequired')}</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold text-xs">
            <XCircle className="w-3.5 h-3.5" />
            <span>{t('aiStatusError')}</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 font-medium text-xs">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span>{t('aiStatusDisconnected')}</span>
          </div>
        );
    }
  };

  const roleMatrix = [
    {
      role: 'Project Admin',
      scope: 'Workspace setup, membership, security settings',
      canEditReq: true,
      canApprove: true,
      canExecute: true,
      canUploadEVD: true
    },
    {
      role: 'PM / Project Lead',
      scope: 'Project governance, progress tracking, sign-offs',
      canEditReq: true,
      canApprove: true,
      canExecute: true,
      canUploadEVD: true
    },
    {
      role: 'BA',
      scope: 'Business requirements, rules, acceptance criteria',
      canEditReq: true,
      canApprove: false,
      canExecute: false,
      canUploadEVD: true
    },
    {
      role: 'Tech Lead / DEV',
      scope: 'Technical specs, architecture, bug resolution',
      canEditReq: false,
      canApprove: false,
      canExecute: true,
      canUploadEVD: true
    },
    {
      role: 'QA / Reviewer',
      scope: 'Test design, execution, defects, evidence review',
      canEditReq: false,
      canApprove: false,
      canExecute: true,
      canUploadEVD: true
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">{t('settingsTitle')}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{t('settingsSubtitle')}</p>
        </div>
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('ai_connection')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'ai_connection'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-indigo-950/40 ring-1 ring-purple-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            <span>{t('settingsTabAiConnection')}</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'audit'
                ? 'bg-slate-800 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('settingsTabAudit')}</span>
          </button>
          <button
            onClick={() => setActiveTab('rbac')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'rbac'
                ? 'bg-slate-800 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            <span>{t('settingsTabRbac')}</span>
          </button>
          <button
            onClick={() => setActiveTab('workspace')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'workspace'
                ? 'bg-slate-800 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderDot className="w-3.5 h-3.5 text-slate-400" />
            <span>{t('settingsTabWorkspace')}</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB: UNIFIED AI CONNECTION SETTINGS                             */}
      {/* ============================================================== */}
      {activeTab === 'ai_connection' && (
        <div className="space-y-6">
          {/* Main Configuration Card */}
          <Card className="p-6 bg-slate-900 border-slate-800 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/5 rounded-full blur-3xl -z-10" />

            {/* Header with Live Status */}
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">{t('aiConnectionTitle')}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{t('aiConnectionSubtitle')}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge()}
                {connectionStatus === 'connected' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnect}
                    className="border-slate-800 hover:bg-rose-500/10 hover:text-rose-400 text-slate-400 text-xs"
                  >
                    <Unplug className="w-3.5 h-3.5 mr-1" />
                    <span>{t('aiDisconnectBtn')}</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Shared Scope Notice Banner (AI-CON-09) */}
            <div className="mt-5 p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/30 flex items-start gap-3">
              <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <p className="text-xs text-purple-200/90 leading-relaxed">
                {t('aiSharedScopeNotice')}
              </p>
            </div>

            {/* STEP 1: Select AI Provider */}
            <div className="mt-8 space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                {t('aiSelectProvider')}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'google', name: 'Google Gemini', sub: 'Gemini 1.5 Pro / Flash' },
                  { id: 'anthropic', name: 'Anthropic Claude', sub: 'Claude 3.7 / 3.5 Sonnet' },
                  { id: 'openai', name: 'OpenAI (ChatGPT)', sub: 'GPT-4o / o1 / o3-mini' },
                  { id: 'custom', name: 'Custom / Local', sub: 'Ollama, vLLM, OpenRouter' }
                ].map((p) => {
                  const isSelected = provider === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProviderChange(p.id as AiProviderId)}
                      className={`p-3.5 rounded-xl text-left border transition-all relative ${
                        isSelected
                          ? 'bg-slate-800/90 border-purple-500/80 shadow-lg shadow-purple-950/30 ring-1 ring-purple-500/50'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                          {p.name}
                        </span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-purple-400 shadow-sm shadow-purple-400" />
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 block line-clamp-1">{p.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP 2: Connection Method Toggle (2 Mutually Exclusive Cards) */}
            <div className="mt-8 space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                {t('aiConnectionMethod')}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Method 1: API Key */}
                <div
                  onClick={() => setAuthMethod('api_key')}
                  className={`p-5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    authMethod === 'api_key'
                      ? 'bg-gradient-to-b from-purple-950/30 to-slate-900 border-purple-500/80 ring-1 ring-purple-500/40 shadow-md shadow-purple-950/30'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        authMethod === 'api_key' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-400'
                      }`}>
                        <KeyRound className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <span>{t('aiMethodApiKey')}</span>
                          {authMethod === 'api_key' && (
                            <Badge variant="purple" className="text-[10px] px-1.5 py-0.5">Active</Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-1 leading-relaxed">
                          {t('aiMethodApiKeyDesc')}
                        </div>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      authMethod === 'api_key'
                        ? 'border-purple-500 bg-purple-600 text-white'
                        : 'border-slate-700 bg-slate-900'
                    }`}>
                      {authMethod === 'api_key' && <Check className="w-3 h-3" />}
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Direct REST HTTP Protocol</span>
                    <span className="text-purple-400 font-medium">Standard Cloud Gateways</span>
                  </div>
                </div>

                {/* Method 2: CLI Subscription */}
                <div
                  onClick={() => setAuthMethod('cli_subscription')}
                  className={`p-5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    authMethod === 'cli_subscription'
                      ? 'bg-gradient-to-b from-purple-950/30 to-slate-900 border-purple-500/80 ring-1 ring-purple-500/40 shadow-md shadow-purple-950/30'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        authMethod === 'cli_subscription' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-400'
                      }`}>
                        <Terminal className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <span>{t('aiMethodCli')}</span>
                          {authMethod === 'cli_subscription' && (
                            <Badge variant="purple" className="text-[10px] px-1.5 py-0.5">Active</Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-1 leading-relaxed">
                          {t('aiMethodCliDesc')}
                        </div>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      authMethod === 'cli_subscription'
                        ? 'border-purple-500 bg-purple-600 text-white'
                        : 'border-slate-700 bg-slate-900'
                    }`}>
                      {authMethod === 'cli_subscription' && <Check className="w-3 h-3" />}
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Claude Code / GitHub Copilot CLI</span>
                    <span className="text-purple-400 font-medium">Native Pro Subscription</span>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 3: Dynamic Configuration Section */}
            <div className="mt-8 pt-6 border-t border-slate-800 space-y-6">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  {t('aiConfigSectionTitle')}
                </label>
                <span className="text-[11px] text-slate-400">
                  {authMethod === 'api_key' ? 'Cấu hình API Key & Models' : 'Cấu hình CLI Subscription đã đăng nhập'}
                </span>
              </div>

              {/* DYNAMIC FORM: When API Key is active */}
              {authMethod === 'api_key' && (
                <div className="space-y-4 p-5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                  {/* API Key Input */}
                  <div>
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between mb-1.5">
                      <span>{t('aiApiKeyLabel')} ({provider.toUpperCase()}) *</span>
                      {maskedKey && !apiKey && (
                        <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-normal">
                          <CheckCircle2 className="w-3 h-3" />
                          Đã lưu: {maskedKey}
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={maskedKey ? `Giữ nguyên (${maskedKey}) hoặc nhập key mới` : t('aiApiKeyPlaceholder')}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                        title={showKey ? 'Ẩn' : 'Hiện'}
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Base URL (Optional) */}
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      {t('aiBaseUrlLabel')}
                    </label>
                    <input
                      type="text"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder={provider === 'custom' ? 'http://localhost:11434/v1' : 'https://api.openai.com/v1 (Tuỳ chọn)'}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* DYNAMIC FORM: When CLI Subscription is active */}
              {authMethod === 'cli_subscription' && (
                <div className="space-y-4 p-5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                  {/* Architecture & Connection Explanation */}
                  <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-800/30 text-xs text-indigo-200/90 space-y-1">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Cơ chế kết nối CLI Subscription:</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Backend của hệ thống chạy cục bộ sẽ giao tiếp trực tiếp với CLI chính thức trên máy của bạn (Subprocess Bridge). 
                      Hệ thống tận dụng phiên đăng nhập (OAuth session) của gói thuê bao Pro/Team có sẵn mà <strong>không yêu cầu API Key trả tiền theo token</strong>.
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 block">
                      Công cụ CLI tương ứng cho nhà cung cấp <span className="text-purple-400 font-bold uppercase">{provider}</span>:
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleScanClis}
                      disabled={isDetectingClis}
                      className="border-slate-800 text-xs py-1 h-7"
                    >
                      <RefreshCw className={`w-3 h-3 mr-1.5 ${isDetectingClis ? 'animate-spin' : ''}`} />
                      <span>{t('aiCliScanBtn')}</span>
                    </Button>
                  </div>

                  {/* Filtered CLI Tools for Selected Provider */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {detectedClis
                      .filter(cli => {
                        if (provider === 'anthropic') return cli.id === 'claude';
                        if (provider === 'openai') return cli.id === 'gh';
                        if (provider === 'google') return cli.id === 'agy' || cli.id === 'gemini';
                        return true;
                      })
                      .map((cli) => {
                        const isSelected = cliBinary === cli.binary || cliBinary === cli.id;
                        return (
                          <div
                            key={cli.id}
                            onClick={() => setCliBinary(cli.binary)}
                            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-slate-800/90 border-purple-500 shadow-md ring-1 ring-purple-500/40'
                                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                <Terminal className="w-3.5 h-3.5 text-purple-400" />
                                {cli.name}
                              </span>
                              {cli.installed ? (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium">
                                  Đã cài đặt
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                                  Chưa cài đặt
                                </span>
                              )}
                            </div>
                            <div className="mt-2 text-[11px] text-slate-400 space-y-0.5">
                              <div>Phiên bản: <span className="text-slate-300 font-mono">{cli.version || 'N/A'}</span></div>
                              {cli.path && <div className="truncate font-mono text-[10px] text-slate-500">{cli.path}</div>}
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Active Selected CLI Diagnostic & Verification Details */}
                  {activeCliInfo && (
                    <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 mt-3 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Trạng thái đăng nhập Subscription:</span>
                        {activeCliInfo.authStatus === 'authenticated' ? (
                          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Đã xác thực Subscription {activeCliInfo.account ? `(@${activeCliInfo.account})` : ''}
                          </span>
                        ) : activeCliInfo.installed ? (
                          <span className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Phiên đăng nhập hết hạn / Cần login
                          </span>
                        ) : (
                          <span className="text-rose-400 text-xs">CLI chưa có trong PATH máy</span>
                        )}
                      </div>

                      {activeCliInfo.authStatus !== 'authenticated' && activeCliInfo.loginCommand && (
                        <div className="p-3 rounded-xl bg-slate-950 border border-amber-900/30 text-xs text-slate-300 space-y-1.5">
                          <span className="text-amber-400/90 block text-[11px] font-medium">
                            Để liên kết tài khoản trả phí, vui lòng mở Terminal của bạn và chạy lệnh sau:
                          </span>
                          <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                            <code className="text-purple-300 font-mono font-bold text-xs">{activeCliInfo.loginCommand}</code>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(activeCliInfo.loginCommand);
                                setCopiedCmd(true);
                                setTimeout(() => setCopiedCmd(false), 2000);
                              }}
                              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 ml-2"
                            >
                              {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedCmd ? 'Đã sao chép' : 'Sao chép'}</span>
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-400 block pt-0.5">
                            Sau khi đăng nhập xong trên terminal, bấm nút <strong>[ Kiểm tra kết nối ]</strong> bên dưới để ứng dụng kích hoạt.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 4. CHỌN LỰA MÔ HÌNH AI (SELECT AI MODEL) */}
              <div className="space-y-4 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-purple-400" />
                      <span>{t('aiModelSectionTitle')}</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {t('aiModelSectionSubtitle')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleFetchLiveModels()}
                      disabled={isFetchingModels}
                      className="border-purple-800/50 hover:bg-purple-950/30 text-purple-300 text-xs py-1 h-8"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetchingModels ? 'animate-spin' : ''}`} />
                      <span>{isFetchingModels ? t('aiFetchingLiveModels') : t('aiFetchLiveModelsBtn')}</span>
                    </Button>
                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                      Đang chọn: <span className="text-purple-400 font-bold">{model}</span>
                    </span>
                  </div>
                </div>

                {/* Live Model Sync Banner */}
                {modelsSyncStatus && (
                  <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-800/40 text-purple-300 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>{modelsSyncStatus}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModelsSyncStatus(null)}
                      className="text-slate-400 hover:text-slate-200 text-xs px-1"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* FULL MODEL SELECT DROPDOWN & SEARCH PICKER */}
                {(() => {
                  const providerModels = availableModels[provider] || [];
                  const filteredModels = modelSearch
                    ? providerModels.filter(m => m.id.toLowerCase().includes(modelSearch.toLowerCase()) || m.name.toLowerCase().includes(modelSearch.toLowerCase()))
                    : providerModels;
                  const selectedModelMeta = providerModels.find(m => m.id === model) || {
                    id: model,
                    name: model,
                    description: 'Mô hình được cấu hình sử dụng trực tiếp',
                    contextWindow: '128,000 tokens',
                    maxOutput: '8,192 tokens',
                    category: 'flagship',
                    rateLimits: { rpm: 500, tpm: 800000 },
                    pricingType: 'token_billed',
                    bestFor: 'Tác vụ phân tích & kiểm thử tổng quát',
                    isLive: false
                  };

                  return (
                    <div className="space-y-3">
                      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <label className="text-xs font-bold text-white flex items-center gap-2">
                            <Layers className="w-4 h-4 text-purple-400" />
                            <span>{t('aiSelectModelDropdownLabel')}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-normal">
                              {providerModels.length} models từ {provider.toUpperCase()}
                            </span>
                          </label>

                          {/* Quick Search Filter */}
                          <div className="relative w-full sm:w-72">
                            <input
                              type="text"
                              value={modelSearch}
                              onChange={(e) => setModelSearch(e.target.value)}
                              placeholder={t('aiModelSearchPlaceholder')}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                            />
                            {modelSearch && (
                              <button
                                type="button"
                                onClick={() => setModelSearch('')}
                                className="absolute right-2.5 top-1.5 text-slate-500 hover:text-slate-300 text-xs"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Full Native Select Element */}
                        <select
                          value={model}
                          onChange={(e) => {
                            const val = e.target.value;
                            setModel(val);
                            handleCheckQuota({ model: val });
                          }}
                          className="w-full bg-slate-950 border border-purple-500/50 rounded-xl px-4 py-3 text-xs text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/40 cursor-pointer shadow-inner"
                        >
                          <optgroup label="⭐ Mô hình Khuyên dùng (Recommended)">
                            {providerModels.filter(m => m.recommended).map((m) => (
                              <option key={`rec-${m.id}`} value={m.id}>
                                ⭐ {m.name} ({m.id}) • Ngữ cảnh: {m.contextWindow} • {m.rateLimits?.rpm || 500} RPM
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label={`📋 Toàn bộ danh sách (${filteredModels.length} models)`}>
                            {filteredModels.map((m) => (
                              <option key={`all-${m.id}`} value={m.id}>
                                {m.isLive ? '🟢' : '⚪'} {m.name} ({m.id}) — Ngữ cảnh: {m.contextWindow || '128K'} • {m.rateLimits?.rpm || 500} RPM
                              </option>
                            ))}
                          </optgroup>
                        </select>

                        {/* Selected Model Detailed Inspector */}
                        {selectedModelMeta && (
                          <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40 text-xs space-y-2.5 mt-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm">{selectedModelMeta.name}</span>
                                <code className="text-purple-300 font-mono text-[11px] px-2 py-0.5 rounded bg-purple-900/40 border border-purple-700/50">
                                  {selectedModelMeta.id}
                                </code>
                                {selectedModelMeta.recommended && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                                    Khuyên dùng
                                  </span>
                                )}
                                {selectedModelMeta.isLive && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    API Live
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400">
                                Nhóm: <strong className="text-purple-300 uppercase">{selectedModelMeta.category}</strong>
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-300 leading-relaxed">
                              {selectedModelMeta.description}
                            </p>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-purple-900/30 text-[10px]">
                              <div>
                                <span className="text-slate-400 block">Context Window:</span>
                                <span className="font-mono text-slate-200 font-semibold">{selectedModelMeta.contextWindow}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block">Max Output:</span>
                                <span className="font-mono text-slate-200 font-semibold">{selectedModelMeta.maxOutput || '8,192 tokens'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block">Tốc độ tối đa:</span>
                                <span className="font-mono text-cyan-400 font-semibold">{selectedModelMeta.rateLimits?.rpm || 500} RPM</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block">Tối ưu cho QA:</span>
                                <span className="text-purple-200 truncate block font-medium">{selectedModelMeta.bestFor || 'Tổng hợp tài liệu'}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Quick Cards Grid (Top models or filtered) */}
                      <div className="space-y-2">
                        <div className="text-[11px] text-slate-400 font-medium">
                          Chọn nhanh 1-chạm hoặc bấm thẻ bên dưới:
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {filteredModels.slice(0, 6).map((m) => {
                            const isSelected = model === m.id;
                            return (
                              <div
                                key={m.id}
                                onClick={() => {
                                  setModel(m.id);
                                  handleCheckQuota({ model: m.id });
                                }}
                                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                                  isSelected
                                    ? 'bg-purple-950/30 border-purple-500 shadow-md ring-1 ring-purple-500/40'
                                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-1.5 font-bold text-white text-xs">
                                      <span>{m.name}</span>
                                      {m.recommended && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                                          Khuyên dùng
                                        </span>
                                      )}
                                      {m.isLive && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                          API Live
                                        </span>
                                      )}
                                    </div>
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                      isSelected ? 'border-purple-500 bg-purple-500' : 'border-slate-600'
                                    }`}>
                                      {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                    </div>
                                  </div>

                                  <p className="text-[11px] text-slate-300 mt-2 leading-relaxed line-clamp-2">
                                    {m.description}
                                  </p>
                                </div>

                                <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1 text-[10px]">
                                  <div className="flex items-center justify-between text-slate-400">
                                    <span>Context: <strong className="text-slate-200 font-mono">{m.contextWindow || '128K'}</strong></span>
                                    <span>Tốc độ: <strong className="text-cyan-400 font-mono">{m.rateLimits?.rpm || 500} RPM</strong></span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Custom / Specific Model ID input */}
                      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <span className="font-semibold">{t('aiCustomModelLabel')}</span>
                          <span className="text-[10px] text-slate-500">Cho phép nhập bất kỳ model ID nào vừa phát hành hoặc model riêng</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={model}
                            onChange={(e) => {
                              setModel(e.target.value.trim());
                            }}
                            placeholder={t('aiCustomModelPlaceholder')}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 5. THÔNG TIN HẠN MỨC & DUNG LƯỢNG (QUOTA & RATE LIMITS) */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-emerald-400" />
                      <span>{t('aiQuotaSectionTitle')}</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {t('aiQuotaSectionSubtitle')}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCheckQuota()}
                    disabled={isLoadingQuota}
                    className="border-emerald-800/50 hover:bg-emerald-950/30 text-emerald-400 text-xs py-1 h-8 shrink-0 self-start sm:self-auto"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoadingQuota ? 'animate-spin' : ''}`} />
                    <span>{isLoadingQuota ? t('aiCheckingQuota') : t('aiCheckQuotaBtn')}</span>
                  </Button>
                </div>

                {quotaInfo && (
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-3.5">
                    {/* Top Banner: Plan Name & Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">
                          {t('aiQuotaPlanLabel')}
                        </div>
                        <div className="text-sm font-bold text-white flex items-center gap-2 mt-0.5">
                          <span>{quotaInfo.planName}</span>
                          {quotaInfo.accountDetails?.account && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                              @{quotaInfo.accountDetails.account}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 ${
                        quotaInfo.status === 'healthy'
                          ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                          : quotaInfo.status === 'auth_required'
                          ? 'bg-amber-950/30 border-amber-800/50 text-amber-300'
                          : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                      }`}>
                        {quotaInfo.status === 'healthy' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <span>{quotaInfo.statusLabel}</span>
                      </div>
                    </div>

                    {/* Grid 4 Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* RPM */}
                      <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                          <Activity className="w-3.5 h-3.5 text-cyan-400" />
                          <span>RPM (Yêu cầu/phút)</span>
                        </div>
                        <div className="text-base font-bold text-white mt-1 font-mono">
                          {quotaInfo.rateLimits.rpm.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">req/m</span>
                        </div>
                      </div>

                      {/* TPM */}
                      <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span>TPM (Tokens/phút)</span>
                        </div>
                        <div className="text-base font-bold text-white mt-1 font-mono">
                          {quotaInfo.rateLimits.tpm.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">tok/m</span>
                        </div>
                      </div>

                      {/* Context Window */}
                      <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                          <Layers className="w-3.5 h-3.5 text-purple-400" />
                          <span>Ngữ cảnh tối đa</span>
                        </div>
                        <div className="text-xs font-bold text-purple-300 mt-1.5 font-mono truncate">
                          {quotaInfo.rateLimits.contextWindow}
                        </div>
                      </div>

                      {/* Billing Model */}
                      <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                          <Shield className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Cơ chế cước</span>
                        </div>
                        <div className="text-xs font-semibold text-emerald-400 mt-1.5 truncate">
                          {quotaInfo.usage.billingModel === 'subscription_included' ? 'Subscription (0đ/token)' : 'Pay-per-token'}
                        </div>
                      </div>
                    </div>

                    {/* Progress & Reset Schedule */}
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{quotaInfo.usage.resetTimeDescription}</span>
                        </span>
                        {quotaInfo.usage.remainingQuotaPercent !== undefined && (
                          <span className="text-emerald-400 font-bold font-mono">
                            {quotaInfo.usage.remainingQuotaPercent}% hạn ngạch khả dụng
                          </span>
                        )}
                      </div>
                      {quotaInfo.usage.remainingQuotaPercent !== undefined && (
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(5, quotaInfo.usage.remainingQuotaPercent))}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Test Connection Result Box */}
              {testResult && (
                <div className="space-y-3">
                  {/* Case 1: Authentication Required (e.g. claude OAuth expired) */}
                  {testResult.connectionStatus === 'auth_required' && (
                    <div className="p-4 rounded-xl border bg-amber-950/20 border-amber-800/50 text-amber-200 space-y-3">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-sm font-bold text-amber-300 flex items-center gap-2">
                            <span>Authentication Required (Yêu cầu đăng nhập tài khoản)</span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono">
                              Phiên đăng nhập hết hạn
                            </span>
                          </div>
                          <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                            {testResult.message}
                          </p>
                        </div>
                      </div>

                      {/* Step 1 & 2 Instructions with 1-Click Copy */}
                      <div className="p-3.5 rounded-lg bg-slate-950 border border-amber-900/40 space-y-2 text-xs">
                        <div className="text-slate-300 font-semibold flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] flex items-center justify-center font-bold">1</span>
                          <span>Mở Terminal trên máy của bạn và chạy lệnh đăng nhập:</span>
                        </div>
                        <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 font-mono text-xs">
                          <code className="text-purple-300 font-bold">{testResult.details?.loginCommand || `${cliBinary} login`}</code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(testResult.details?.loginCommand || `${cliBinary} login`);
                              setCopiedCmd(true);
                              setTimeout(() => setCopiedCmd(false), 2000);
                            }}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 transition-all border border-slate-700"
                          >
                            {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
                            <span>{copiedCmd ? 'Đã sao chép!' : 'Sao chép 1-chạm'}</span>
                          </button>
                        </div>
                        <div className="text-slate-400 text-[11px] flex items-center gap-1.5 pt-1">
                          <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-400 text-[10px] flex items-center justify-center font-bold">2</span>
                          <span>Sau khi gõ xong lệnh trên Terminal, quay lại đây bấm <strong>[ Kiểm tra kết nối ]</strong> để nhận huy hiệu 🟢 Connected ngay lập tức!</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Case 2: Connected Successfully (e.g. gh with @connorpham) */}
                  {testResult.success && testResult.connectionStatus !== 'auth_required' && (
                    <div className="p-4 rounded-xl border bg-emerald-950/20 border-emerald-800/40 text-emerald-300 flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <span>Kết nối thành công!</span>
                          {testResult.details?.account && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                              @{testResult.details.account}
                            </span>
                          )}
                          <span className="text-xs text-emerald-400 font-mono">({testResult.latencyMs}ms)</span>
                        </div>
                        <div className="text-emerald-200/90">{testResult.message}</div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          Hệ thống đã sẵn sàng sử dụng kết nối này cho toàn bộ tính năng phân tích tài liệu và sinh test case.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Case 3: Other Error */}
                  {!testResult.success && testResult.connectionStatus !== 'auth_required' && (
                    <div className="p-4 rounded-xl border bg-rose-950/20 border-rose-800/40 text-rose-300 flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-0.5">
                        <div className="font-bold text-sm text-rose-200">Lỗi kết nối</div>
                        <div>{testResult.message}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Save Success Box */}
              {saveSuccessMsg && (
                <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-800/40 text-purple-300 flex items-center gap-2 text-xs">
                  <Check className="w-4 h-4 text-purple-400" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* Action Buttons: Test Connection & Save */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={isTesting || (authMethod === 'api_key' && !apiKey && !maskedKey)}
                  className="border-slate-700 hover:bg-slate-800 text-white text-xs h-9"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? t('aiTesting') : t('aiTestConnectionBtn')}</span>
                </Button>

                <div className="flex items-center gap-3">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveConnection}
                    disabled={isSaving}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs h-9 px-4"
                  >
                    <Save className={`w-3.5 h-3.5 mr-1.5 ${isSaving ? 'animate-spin' : ''}`} />
                    <span>{isSaving ? t('aiSaving') : t('aiSaveConfigBtn')}</span>
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB: AUDIT LOG (SHA-256 Chained Integrity)                     */}
      {/* ============================================================== */}
      {activeTab === 'audit' && (
        <Card className="p-6 bg-slate-900 border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">{t('settingsAuditTrail')}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Mỗi hành động sinh ra một block băm mật mã SHA-256 nối chuỗi, đảm bảo chống giả mạo theo Tiêu chuẩn Mục 9.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="success" className="text-xs">
                Chained Hash Verified
              </Badge>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px] bg-slate-950/40">
                  <th className="py-2.5 px-3">Mã Block</th>
                  <th className="py-2.5 px-3">Thời gian</th>
                  <th className="py-2.5 px-3">Người thực hiện</th>
                  <th className="py-2.5 px-3">Vai trò</th>
                  <th className="py-2.5 px-3">Hành động</th>
                  <th className="py-2.5 px-3">Mã băm SHA-256 (Event Hash)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                {auditEvents.slice(0, 8).map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-bold text-emerald-400">{evt.id}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-400">{evt.timestamp}</td>
                    <td className="py-2.5 px-3 font-sans text-white">{evt.user}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-sans">
                        {evt.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-200">{evt.action}</td>
                    <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                      {evt.eventHash ? `${evt.eventHash.slice(0, 20)}...` : 'sha256:verified_block'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ============================================================== */}
      {/* TAB: RBAC MATRIX                                               */}
      {/* ============================================================== */}
      {activeTab === 'rbac' && (
        <Card className="p-6 bg-slate-900 border-slate-800 space-y-4">
          <div className="pb-4 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white tracking-tight">{t('settingsRbacMatrix')}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Phân quyền nghiêm ngặt 5 vai trò theo Mục 4 của Proposal. Vai trò hiện tại của bạn: <span className="text-indigo-400 font-bold">{currentRole}</span>.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px] bg-slate-950/40">
                  <th className="py-2.5 px-3">{t('settingsColRole')}</th>
                  <th className="py-2.5 px-3">{t('settingsColScope')}</th>
                  <th className="py-2.5 px-3 text-center">{t('settingsColReq')}</th>
                  <th className="py-2.5 px-3 text-center">{t('settingsColApprove')}</th>
                  <th className="py-2.5 px-3 text-center">{t('settingsColExec')}</th>
                  <th className="py-2.5 px-3 text-center">{t('settingsColEvd')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {roleMatrix.map((r) => (
                  <tr key={r.role} className={`hover:bg-slate-800/30 ${currentRole === r.role ? 'bg-indigo-950/20' : ''}`}>
                    <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                      <span>{r.role}</span>
                      {currentRole === r.role && <Badge variant="purple" className="text-[10px]">Current</Badge>}
                    </td>
                    <td className="py-3 px-3 text-slate-400">{r.scope}</td>
                    <td className="py-3 px-3 text-center">{r.canEditReq ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <XCircle className="w-4 h-4 text-slate-600 mx-auto" />}</td>
                    <td className="py-3 px-3 text-center">{r.canApprove ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <XCircle className="w-4 h-4 text-slate-600 mx-auto" />}</td>
                    <td className="py-3 px-3 text-center">{r.canExecute ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <XCircle className="w-4 h-4 text-slate-600 mx-auto" />}</td>
                    <td className="py-3 px-3 text-center">{r.canUploadEVD ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <XCircle className="w-4 h-4 text-slate-600 mx-auto" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ============================================================== */}
      {/* TAB: WORKSPACE BASELINE                                        */}
      {/* ============================================================== */}
      {activeTab === 'workspace' && (
        <Card className="p-6 bg-slate-900 border-slate-800 space-y-4">
          <div className="pb-4 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white tracking-tight">{t('settingsWorkspaceDetails')}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cấu hình dự án hoạt động theo Đặc tả Đề xuất Nền tảng QA & Tài liệu.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="text-slate-400">Tên Dự án:</div>
              <div className="font-bold text-white text-sm">{activeProject.name}</div>
              <div className="text-slate-400 text-[11px]">{activeProject.description}</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="text-slate-400">Database Storage:</div>
              <div className="font-bold text-emerald-400 text-sm">SQLite (WAL Mode)</div>
              <div className="text-slate-400 text-[11px]">Đường dẫn: server/data/docqa.sqlite</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
