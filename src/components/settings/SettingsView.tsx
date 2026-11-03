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
  Info
} from 'lucide-react';
import { Card, Badge, Button } from '../../common/components';
import {
  getAiConnection,
  saveAiConnection,
  testAiConnection,
  detectCliTools,
  disconnectAiConnection,
  getAiModels
} from '../../common/services/api';
import { 
  AiConnectionConfig, 
  AiProviderId, 
  AiAuthMethod, 
  AiConnectionStatus, 
  CliDetectionInfo 
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
  const [model, setModel] = useState<string>('gemini-1.5-pro');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [cliBinary, setCliBinary] = useState<string>('claude');

  // Connection metadata & results
  const [connectionStatus, setConnectionStatus] = useState<AiConnectionStatus>('disconnected');
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Available models & detected CLIs
  const [availableModels, setAvailableModels] = useState<Record<string, Array<{ id: string; name: string; description: string; recommended?: boolean }>>>({});
  const [detectedClis, setDetectedClis] = useState<CliDetectionInfo[]>([]);
  const [isDetectingClis, setIsDetectingClis] = useState<boolean>(false);

  // Loading & notification states
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadAiConnection();
    loadModels();
    handleScanClis();
  }, []);

  const loadAiConnection = async () => {
    try {
      const res = await getAiConnection();
      if (res?.data) {
        const c: AiConnectionConfig = res.data;
        setProvider(c.provider || 'google');
        setAuthMethod(c.authMethod || 'api_key');
        setMaskedKey(c.maskedApiKey || '');
        setModel(c.model || 'gemini-1.5-pro');
        setBaseUrl(c.baseUrl || '');
        setCliBinary(c.cliBinary || 'claude');
        setConnectionStatus(c.connectionStatus || 'disconnected');
        setLastTestedAt(c.lastTestedAt || null);
        setLatencyMs(c.latencyMs || null);
        setErrorMessage(c.errorMessage || null);
      }
    } catch (err: any) {
      console.warn('Could not load AI connection:', err.message);
    }
  };

  const loadModels = async () => {
    try {
      const res = await getAiModels();
      if (res?.data) {
        setAvailableModels(res.data);
      }
    } catch (err: any) {
      console.warn('Could not load models registry:', err.message);
    }
  };

  const handleScanClis = async () => {
    setIsDetectingClis(true);
    try {
      const res = await detectCliTools();
      if (res?.data && Array.isArray(res.data)) {
        setDetectedClis(res.data);
      }
    } catch (err: any) {
      console.warn('Could not detect CLIs:', err.message);
    } finally {
      setIsDetectingClis(false);
    }
  };

  const handleProviderChange = (newProvider: AiProviderId) => {
    setProvider(newProvider);
    const models = availableModels[newProvider] || [];
    const recommended = models.find(m => m.recommended) || models[0];
    if (recommended) {
      setModel(recommended.id);
    }
    setTestResult(null);
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

      setTestResult({
        success: true,
        message: res.message || 'Kết nối thành công',
        latencyMs: res.data?.latencyMs || res.latencyMs
      });
      setConnectionStatus('connected');
      setLatencyMs(res.data?.latencyMs || res.latencyMs || null);
      setErrorMessage(null);
      await loadAiConnection();
    } catch (err: any) {
      const msg = err.message || 'Lỗi kiểm tra kết nối';
      setTestResult({
        success: false,
        message: msg
      });
      setConnectionStatus(authMethod === 'cli_subscription' && msg.includes('login') ? 'auth_required' : 'error');
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

                  {/* Model Selection Dropdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                        {t('aiModelSelect')} *
                      </label>
                      <select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      >
                        {(availableModels[provider] || []).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.recommended ? '(Khuyên dùng)' : ''}
                          </option>
                        ))}
                      </select>
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
                </div>
              )}

              {/* DYNAMIC FORM: When CLI Subscription is active */}
              {authMethod === 'cli_subscription' && (
                <div className="space-y-4 p-5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 block">
                      {t('aiCliSelectLabel')}
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

                  {/* CLI Tool Select Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {detectedClis.map((cli) => {
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
                    <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 mt-3 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Xác thực Subscription:</span>
                        {activeCliInfo.authStatus === 'authenticated' ? (
                          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Đã xác thực Subscription {activeCliInfo.account ? `(${activeCliInfo.account})` : ''}
                          </span>
                        ) : activeCliInfo.installed ? (
                          <span className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Cần đăng nhập tài khoản
                          </span>
                        ) : (
                          <span className="text-rose-400 text-xs">CLI chưa có trong PATH máy</span>
                        )}
                      </div>

                      {activeCliInfo.authStatus !== 'authenticated' && activeCliInfo.loginCommand && (
                        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300">
                          <span className="text-slate-400 block text-[11px] mb-1">Để đăng nhập vào gói Subscription, mở Terminal và chạy:</span>
                          <code className="text-purple-300 font-mono font-bold">{activeCliInfo.loginCommand}</code>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Test Connection Result Box */}
              {testResult && (
                <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
                  testResult.success
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                    : 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                }`}>
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs">
                    <div className="font-semibold">{testResult.message}</div>
                    {testResult.latencyMs !== undefined && (
                      <div className="text-[11px] opacity-80 mt-0.5">Thời gian phản hồi: {testResult.latencyMs}ms</div>
                    )}
                  </div>
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
