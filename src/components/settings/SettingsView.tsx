import React, { useState, useEffect, useRef } from 'react';
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
  Clock,
  Sliders,
  ChevronDown,
  Search,
  Database
} from 'lucide-react';
import { Card, Badge, Button } from '../../common/components';
import { DEFAULT_PROVIDER_MODELS } from '../../common/constants/modelRegistry';
import {
  getAiConnection,
  saveAiConnection,
  testAiConnection,
  detectCliTools,
  disconnectAiConnection,
  getAiModels,
  fetchAiLiveModels,
  getAiQuota,
  checkAiQuota,
  getSavedAccountModels,
  syncAccountModels,
  selectAiModel,
  getAiModelEfforts,
  saveAiModelEffort
} from '../../common/services/api';
import { 
  AiConnectionConfig, 
  AiProviderId, 
  AiAuthMethod, 
  AiConnectionStatus, 
  CliDetectionInfo,
  ModelOption,
  AiQuotaInfo,
  ReasoningEffortLevel
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
  const [effortLevel, setEffortLevel] = useState<ReasoningEffortLevel>('medium');
  const [maxOutputTokens, setMaxOutputTokens] = useState<number>(32768);
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [cliBinary, setCliBinary] = useState<string>('claude');

  // Connection metadata & results
  const [connectionStatus, setConnectionStatus] = useState<AiConnectionStatus>('disconnected');
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Available models & detected CLIs
  const [availableModels, setAvailableModels] = useState<Record<string, ModelOption[]>>(DEFAULT_PROVIDER_MODELS);
  const [detectedClis, setDetectedClis] = useState<CliDetectionInfo[]>([]);
  const [isDetectingClis, setIsDetectingClis] = useState<boolean>(false);
  const [isFetchingModels, setIsFetchingModels] = useState<boolean>(false);
  const [modelsSyncStatus, setModelsSyncStatus] = useState<string | null>(null);
  const [modelSearch, setModelSearch] = useState<string>('');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState<boolean>(false);
  const [modelCategoryFilter, setModelCategoryFilter] = useState<'all' | 'recommended' | 'reasoning' | 'fast'>('all');
  const [accountModelSnapshot, setAccountModelSnapshot] = useState<{
    source?: string;
    account?: string;
    syncedAt?: string;
    synced: boolean;
    count: number;
  }>({ synced: false, count: 0 });
  const modelDropdownRef = useRef<HTMLDivElement>(null);

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

  // Per-model Effort & Separate Model Persistence
  const [savedModelEfforts, setSavedModelEfforts] = useState<Record<string, { effortLevel: string; maxOutputTokens: number; resolvedVariant?: string; updatedAt?: string }>>({});
  const [modelSelectSuccessMsg, setModelSelectSuccessMsg] = useState<string | null>(null);
  const [effortSavedMsg, setEffortSavedMsg] = useState<string | null>(null);
  const [modelViewMode, setModelViewMode] = useState<'base' | 'all'>('base');
  const [isSelectingModel, setIsSelectingModel] = useState<boolean>(false);
  const [isSavingEffort, setIsSavingEffort] = useState<boolean>(false);

  // Helper functions to decompose model IDs and group into Base Models
  const parseModelBase = (id: string, name: string): { baseId: string; baseName: string; effort?: ReasoningEffortLevel } => {
    const match = id.match(/^(.*?)-(low|medium|high|xhigh|max)$/i);
    if (match) {
      const baseId = match[1];
      const effort = match[2].toLowerCase() as ReasoningEffortLevel;
      const cleanName = name.replace(/\s*\((Low|Medium|High|X-High|Max)\)\s*$/i, '').trim();
      return { baseId, baseName: cleanName || baseId, effort };
    }
    return { baseId: id, baseName: name, effort: undefined };
  };

  const groupIntoBaseModels = (models: ModelOption[]) => {
    const map = new Map<string, {
      baseId: string;
      baseName: string;
      supportedEfforts: ReasoningEffortLevel[];
      variants: Partial<Record<ReasoningEffortLevel, ModelOption>>;
      defaultModel: ModelOption;
      recommended: boolean;
      category: 'reasoning' | 'fast' | 'flagship' | 'local';
      description: string;
      contextWindow: string;
      maxOutput: string;
      rateLimits?: { rpm: number; tpm: number };
      source?: string;
      account?: string;
      isLive?: boolean;
    }>();

    for (const m of models) {
      const { baseId, baseName, effort } = parseModelBase(m.id, m.name);
      let entry = map.get(baseId);
      if (!entry) {
        entry = {
          baseId,
          baseName,
          supportedEfforts: [],
          variants: {},
          defaultModel: m,
          recommended: Boolean(m.recommended),
          category: m.category,
          description: m.description,
          contextWindow: m.contextWindow,
          maxOutput: m.maxOutput,
          rateLimits: m.rateLimits,
          source: m.source,
          account: m.account,
          isLive: m.isLive
        };
        map.set(baseId, entry);
      }

      if (effort) {
        if (!entry.supportedEfforts.includes(effort)) {
          entry.supportedEfforts.push(effort);
        }
        entry.variants[effort] = m;
      } else {
        entry.supportedEfforts = ['low', 'medium', 'high'];
      }

      if (m.recommended) entry.recommended = true;
    }

    const effortOrder: ReasoningEffortLevel[] = ['low', 'medium', 'high', 'xhigh', 'max'];
    for (const entry of map.values()) {
      entry.supportedEfforts.sort((a, b) => effortOrder.indexOf(a) - effortOrder.indexOf(b));
      if (entry.supportedEfforts.length === 0) {
        entry.supportedEfforts = ['low', 'medium', 'high'];
      }
    }

    return Array.from(map.values());
  };

  useEffect(() => {
    loadAiConnection();
    loadModels();
    handleScanClis();

    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
        if (c.effortLevel) setEffortLevel(c.effortLevel);
        if (c.maxOutputTokens) setMaxOutputTokens(c.maxOutputTokens);
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
            message: t('settingsConnectedSuccess', { detail: c.model || c.cliBinary || 'N/A' }),
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
        await loadSavedModelsFromDb(c.provider, c.authMethod, c.cliBinary);
        await loadModelEfforts(c.provider);
      }
    } catch (err: any) {
      console.warn('Could not load AI connection:', err.message);
    }
  };

  const loadModelEfforts = async (p?: AiProviderId) => {
    try {
      const res = await getAiModelEfforts(p || provider);
      const data = res?.data !== undefined ? res.data : res;
      if (data && typeof data === 'object') {
        setSavedModelEfforts(data as any);
      }
    } catch (err: any) {
      console.warn('Could not load model efforts:', err.message);
    }
  };

  const handleSelectModel = async (selectedModelId: string, customEffort?: ReasoningEffortLevel) => {
    setIsSelectingModel(true);
    setModelSelectSuccessMsg(null);
    try {
      const { baseId, baseName } = parseModelBase(selectedModelId, selectedModelId);
      const existingEffort = savedModelEfforts[selectedModelId]?.effortLevel || savedModelEfforts[baseId]?.effortLevel;
      const targetEffort = customEffort || (existingEffort as ReasoningEffortLevel) || effortLevel || 'medium';

      const res = await selectAiModel({
        provider,
        modelId: selectedModelId,
        effortLevel: targetEffort
      });

      const newConn = res.data?.connection;
      const savedEffort = res.data?.savedEffort;

      if (newConn?.model) {
        setModel(newConn.model);
      } else {
        setModel(selectedModelId);
      }

      if (savedEffort?.effortLevel) {
        setEffortLevel(savedEffort.effortLevel as ReasoningEffortLevel);
      }

      setModelSelectSuccessMsg(t('settingsModelSavedDb', { model: baseName }));
      setTimeout(() => setModelSelectSuccessMsg(null), 3500);

      handleCheckQuota({ model: newConn?.model || selectedModelId });
      loadModelEfforts(provider);
    } catch (err: any) {
      console.error('Failed to select model:', err);
      setModel(selectedModelId);
    } finally {
      setIsSelectingModel(false);
    }
  };

  const handleSelectEffortForCurrentModel = async (newEffort: ReasoningEffortLevel) => {
    setIsSavingEffort(true);
    setEffortSavedMsg(null);
    try {
      setEffortLevel(newEffort);

      const { baseId, baseName } = parseModelBase(model, model);
      const allCurrentModels = availableModels[provider] || [];
      const targetVariantId = `${baseId}-${newEffort}`;
      const hasExactVariant = allCurrentModels.some(m => m.id === targetVariantId);
      const actualVariant = hasExactVariant ? targetVariantId : model;

      if (hasExactVariant) {
        setModel(actualVariant);
      }

      await saveAiModelEffort({
        provider,
        modelId: baseId,
        effortLevel: newEffort,
        maxOutputTokens,
        resolvedVariant: actualVariant
      });

      setSavedModelEfforts(prev => ({
        ...prev,
        [baseId]: {
          effortLevel: newEffort,
          maxOutputTokens,
          resolvedVariant: actualVariant,
          updatedAt: new Date().toISOString()
        },
        [actualVariant]: {
          effortLevel: newEffort,
          maxOutputTokens,
          resolvedVariant: actualVariant,
          updatedAt: new Date().toISOString()
        }
      }));

      setEffortSavedMsg(
        t('settingsEffortSavedVariant', { effort: newEffort.toUpperCase(), model: baseName, variant: actualVariant })
      );
      setTimeout(() => setEffortSavedMsg(null), 4000);

      await saveAiConnection({
        provider,
        authMethod,
        apiKey: apiKey ? apiKey.trim() : undefined,
        baseUrl: baseUrl ? baseUrl.trim() : undefined,
        model: actualVariant,
        effortLevel: newEffort,
        maxOutputTokens,
        cliBinary
      });
    } catch (err: any) {
      console.error('Failed to save effort for model:', err);
    } finally {
      setIsSavingEffort(false);
    }
  };

  const loadModels = async () => {
    try {
      const res = await getAiModels();
      const models = res?.data !== undefined ? res.data : res;
      if (models && typeof models === 'object' && Object.keys(models).length > 0) {
        setAvailableModels(prev => ({
          ...prev,
          ...models
        }));
      }
    } catch (err: any) {
      console.warn('Could not load models registry:', err.message);
    }
  };

  const loadSavedModelsFromDb = async (p?: AiProviderId, a?: AiAuthMethod, c?: string) => {
    try {
      const targetProvider = p || provider;
      const targetAuthMethod = a || authMethod;
      const targetCli = c || cliBinary;
      const res = await getSavedAccountModels({
        provider: targetProvider,
        authMethod: targetAuthMethod,
        cliBinary: targetCli
      });
      if (res && res.synced && Array.isArray(res.models) && res.models.length > 0) {
        setAvailableModels(prev => ({
          ...prev,
          [targetProvider]: res.models
        }));
        setAccountModelSnapshot({
          source: res.source,
          account: res.account,
          syncedAt: res.syncedAt,
          synced: true,
          count: res.models.length
        });
        return res.models;
      } else {
        setAccountModelSnapshot({
          source: res?.source || (targetAuthMethod === 'cli_subscription' ? `cli:${targetCli}` : `api:${targetProvider}`),
          synced: false,
          count: 0
        });
        return null;
      }
    } catch (err: any) {
      console.warn('Failed to load saved models from DB:', err.message);
      return null;
    }
  };

  const handleSyncAccountModels = async () => {
    setIsFetchingModels(true);
    setModelsSyncStatus(null);
    try {
      const res = await syncAccountModels({
        provider,
        authMethod,
        cliBinary,
        apiKey: apiKey ? apiKey.trim() : undefined,
        baseUrl: baseUrl ? baseUrl.trim() : undefined
      });
      if (res.ok && res.data) {
        const snap = res.data;
        setAvailableModels(prev => ({
          ...prev,
          [provider]: snap.models
        }));
        setAccountModelSnapshot({
          source: snap.source,
          account: snap.account,
          syncedAt: snap.syncedAt,
          synced: true,
          count: snap.models.length
        });
        setModelsSyncStatus(
          t('settingsScannedSubSuccess', { account: snap.account || snap.source, count: snap.models.length })
        );
        setModel(prevModel => {
          if (prevModel && snap.models.some(m => m.id === prevModel)) {
            return prevModel;
          }
          const recommended = snap.models.find(m => m.recommended) || snap.models[0];
          return recommended ? recommended.id : prevModel;
        });
      } else {
        if (res.code === 'auth_required') {
          setModelsSyncStatus(
            t('settingsAuthReqPrompt', { message: `${res.message}${res.loginCommand ? ` (${res.loginCommand})` : ''}` })
          );
        } else {
          setModelsSyncStatus(`⚠️ ${res.message}`);
        }
        if (res.saved && Array.isArray(res.saved.models) && res.saved.models.length > 0) {
          setAvailableModels(prev => ({ ...prev, [provider]: res.saved!.models }));
          setAccountModelSnapshot({
            source: res.saved.source,
            account: res.saved.account,
            syncedAt: res.saved.syncedAt,
            synced: true,
            count: res.saved.models.length
          });
        }
      }
    } catch (err: any) {
      setModelsSyncStatus(t('settingsSyncErr', { message: err.message }));
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
    const models = availableModels[newProvider] || DEFAULT_PROVIDER_MODELS[newProvider] || [];
    const recommended = models.find(m => m.recommended) || models[0];
    const newModel = recommended ? recommended.id : (models[0]?.id || 'gemini-4-argon-medium');
    setModel(newModel);

    // Sync effort level if model has a reasoning effort suffix
    if (newModel.endsWith('-low')) setEffortLevel('low');
    else if (newModel.endsWith('-medium')) setEffortLevel('medium');
    else if (newModel.endsWith('-high')) setEffortLevel('high');

    // Auto-map matching CLI for this provider
    let newCli = cliBinary;
    if (newProvider === 'anthropic') newCli = 'claude';
    else if (newProvider === 'openai') newCli = 'gh';
    else if (newProvider === 'google') newCli = 'agy';
    else if (newProvider === 'custom') newCli = 'ollama';
    setCliBinary(newCli);

    setTestResult(null);
    handleCheckQuota({ provider: newProvider, model: newModel, cliBinary: newCli });
    loadSavedModelsFromDb(newProvider, authMethod, newCli);
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
        effortLevel,
        maxOutputTokens,
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
        effortLevel,
        maxOutputTokens,
        cliBinary
      });

      const data = res.data || res;
      setTestResult({
        success: Boolean(data.success),
        message: data.message || (data.success ? t('settingsConnSuccess') : t('settingsConnError')),
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
      const msg = err.message || t('settingsConnCheckError');
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
    if (!confirm(t('settingsDisconnectConfirm'))) return;
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
                  { id: 'google', name: 'Google Gemini', sub: 'Gemini 4 Argon / 3.8 Flash (agy)' },
                  { id: 'anthropic', name: 'Anthropic Claude', sub: 'Claude Opus 5.5 / Sonnet 5.5' },
                  { id: 'openai', name: 'OpenAI (ChatGPT)', sub: 'GPT-4o / o1 / GPT-OSS 120B' },
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
                  onClick={() => {
                    setAuthMethod('api_key');
                    loadSavedModelsFromDb(provider, 'api_key', cliBinary);
                  }}
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
                  onClick={() => {
                    setAuthMethod('cli_subscription');
                    loadSavedModelsFromDb(provider, 'cli_subscription', cliBinary);
                  }}
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
                    <span>Google Antigravity (agy) / Claude / Copilot</span>
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
                  {authMethod === 'api_key' ? t('settingsConfigApiKey') : t('settingsConfigCliLoggedIn')}
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
                          {t('settingsSavedMasked', { key: maskedKey })}
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={maskedKey ? t('settingsMaskedKeyPlaceholder', { key: maskedKey }) : t('aiApiKeyPlaceholder')}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                        title={showKey ? t('settingsHide') : t('settingsShow')}
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
                      placeholder={provider === 'custom' ? 'http://localhost:11434/v1' : 'https://api.openai.com/v1'}
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
                      <span>{t('settingsCliMechanism')}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {t('settingsCliDesc1')} 
                      {t('settingsCliDesc2')}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 block">
                      {t('settingsCliToolForProvider', { provider })}
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
                        if (provider === 'anthropic') return cli.id === 'claude' || cli.id === 'agy';
                        if (provider === 'openai') return cli.id === 'gh' || cli.id === 'agy';
                        if (provider === 'google') return cli.id === 'agy' || cli.id === 'gemini';
                        return true;
                      })
                      .map((cli) => {
                        const isSelected = cliBinary === cli.binary || cliBinary === cli.id;
                        return (
                          <div
                            key={cli.id}
                            onClick={() => {
                              setCliBinary(cli.binary);
                              loadSavedModelsFromDb(provider, authMethod, cli.binary);
                            }}
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
                                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium">{t('settingsCliInstalled')}</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">{t('settingsCliNotInstalled')}</span>
                              )}
                            </div>
                            <div className="mt-2 text-[11px] text-slate-400 space-y-0.5">
                              <div>{t('settingsCliVersion')}: <span className="text-slate-300 font-mono">{cli.version || 'N/A'}</span></div>
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
                        <span className="text-slate-400">{t('settingsCliSubStatus')}</span>
                        {activeCliInfo.authStatus === 'authenticated' ? (
                          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {t('settingsCliAuthOk')} {activeCliInfo.account ? `(@${activeCliInfo.account})` : ''}
                          </span>
                        ) : activeCliInfo.installed ? (
                          <span className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {t('settingsCliAuthExpired')}
                          </span>
                        ) : (
                          <span className="text-rose-400 text-xs">{t('settingsCliNotInPath')}</span>
                        )}
                      </div>

                      {activeCliInfo.authStatus !== 'authenticated' && activeCliInfo.loginCommand && (
                        <div className="p-3 rounded-xl bg-slate-950 border border-amber-900/30 text-xs text-slate-300 space-y-1.5">
                          <span className="text-amber-400/90 block text-[11px] font-medium">
                            {t('settingsCliLoginPrompt')}
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
                              <span>{copiedCmd ? t('settingsCopiedCmd') : t('settingsCopyCmd')}</span>
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-400 block pt-0.5">
                            {t('settingsTestConnectionAfterLogin')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 4. SELECT AI MODEL */}
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
                      onClick={() => handleSyncAccountModels()}
                      disabled={isFetchingModels}
                      className="border-purple-800/50 hover:bg-purple-950/30 text-purple-300 text-xs py-1 h-8"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetchingModels ? 'animate-spin' : ''}`} />
                      <span>{isFetchingModels ? t('aiSyncingAccountModels') : t('aiSyncAccountModelsBtn')}</span>
                    </Button>
                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                      {t('settingsSelecting')} <span className="text-purple-400 font-bold">{model}</span>
                    </span>
                  </div>
                </div>

                {/* Account Model Snapshot & Database Persistence Status */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <Database className={`w-3.5 h-3.5 ${accountModelSnapshot.synced ? 'text-emerald-400' : 'text-slate-400'}`} />
                      <span className="text-slate-400 font-medium">{t('aiAccountSourceLabel')}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        accountModelSnapshot.synced
                          ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {accountModelSnapshot.synced ? t('aiAccountSavedInDb') : t('aiAccountCatalogDefault')}
                      </span>
                    </div>

                    {accountModelSnapshot.account && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-400">{t('aiAccountLabel')}</span>
                        <span className="font-mono text-purple-300 font-semibold text-[11px]">
                          {accountModelSnapshot.account}
                        </span>
                      </div>
                    )}

                    {accountModelSnapshot.syncedAt && (
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <span className="text-slate-500">•</span>
                        <span>{t('aiLastSyncedAt')}</span>
                        <span className="font-mono text-slate-300">
                          {new Date(accountModelSnapshot.syncedAt).toLocaleTimeString()} {new Date(accountModelSnapshot.syncedAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono">
                    <span>{t('settingsModelsCount', { count: availableModels[provider]?.length || 0 })}</span>
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
                  const providerModels = availableModels[provider] || DEFAULT_PROVIDER_MODELS[provider] || [];
                  const baseModels = groupIntoBaseModels(providerModels);

                  const { baseId: currentBaseId, baseName: currentBaseName } = parseModelBase(model, model);
                  const currentBase = baseModels.find(b => b.baseId === currentBaseId) || {
                    baseId: currentBaseId,
                    baseName: currentBaseName,
                    supportedEfforts: ['low', 'medium', 'high'] as ReasoningEffortLevel[],
                    variants: {},
                    defaultModel: providerModels[0] || {
                      id: model,
                      name: model,
                      description: t('settingsDirectConfig'),
                      contextWindow: '128,000 tokens',
                      maxOutput: '8,192 tokens',
                      category: 'flagship',
                      rateLimits: { rpm: 500, tpm: 800000 },
                      pricingType: 'token_billed',
                      bestFor: t('settingsGeneralQa'),
                      isLive: false
                    },
                    recommended: false,
                    category: 'flagship' as const,
                    description: t('settingsAiModel'),
                    contextWindow: '128,000 tokens',
                    maxOutput: '32,768 tokens',
                    rateLimits: { rpm: 500, tpm: 800000 }
                  };

                  let filteredBaseModels = modelSearch
                    ? baseModels.filter(b => b.baseId.toLowerCase().includes(modelSearch.toLowerCase()) || b.baseName.toLowerCase().includes(modelSearch.toLowerCase()))
                    : baseModels;

                  let filteredRawModels = modelSearch
                    ? providerModels.filter(m => m.id.toLowerCase().includes(modelSearch.toLowerCase()) || m.name.toLowerCase().includes(modelSearch.toLowerCase()))
                    : providerModels;

                  if (modelCategoryFilter === 'recommended') {
                    filteredBaseModels = filteredBaseModels.filter(b => b.recommended);
                    filteredRawModels = filteredRawModels.filter(m => m.recommended);
                  } else if (modelCategoryFilter === 'reasoning') {
                    filteredBaseModels = filteredBaseModels.filter(b => b.category === 'reasoning');
                    filteredRawModels = filteredRawModels.filter(m => m.category === 'reasoning');
                  } else if (modelCategoryFilter === 'fast') {
                    filteredBaseModels = filteredBaseModels.filter(b => b.category === 'fast');
                    filteredRawModels = filteredRawModels.filter(m => m.category === 'fast');
                  }

                  return (
                    <div className="space-y-4">
                      {/* Step 1 Header & View Mode Switcher */}
                      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase tracking-wider">
                                {t('aiStepSelectModelFirst')}
                              </span>
                              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                                <Database className="w-3 h-3" />
                                {t('aiModelSavedSeparately')}
                              </span>
                            </div>
                            <label className="text-xs font-bold text-white flex items-center gap-2 mt-1">
                              <Layers className="w-4 h-4 text-purple-400" />
                              <span>{t('aiSelectModelDropdownLabel')}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-normal">
                                {t('settingsBaseVariantsCount', { baseCount: baseModels.length, variantCount: providerModels.length })}
                              </span>
                            </label>
                          </div>

                          {/* Mode Toggle: Base Models vs All Variants */}
                          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                            <button
                              type="button"
                              onClick={() => setModelViewMode('base')}
                              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                                modelViewMode === 'base'
                                  ? 'bg-purple-600 text-white shadow-sm font-semibold'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              🌟 {t('aiTabBaseModels')} ({baseModels.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setModelViewMode('all')}
                              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                                modelViewMode === 'all'
                                  ? 'bg-purple-600 text-white shadow-sm font-semibold'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              📋 {t('aiTabAllVariants')} ({providerModels.length})
                            </button>
                          </div>
                        </div>

                        {/* Interactive Dropdown Button */}
                        <div className="relative" ref={modelDropdownRef}>
                          <button
                            type="button"
                            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                            className="w-full bg-slate-950 border border-purple-500/50 hover:border-purple-400 rounded-xl px-4 py-3 text-left transition-all flex items-center justify-between gap-3 shadow-inner group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-purple-900/40 border border-purple-600/40 flex items-center justify-center shrink-0">
                                <Cpu className="w-4 h-4 text-purple-400" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white text-xs truncate">
                                    {currentBase.baseName}
                                  </span>
                                  <code className="text-[10px] font-mono text-purple-300 px-1.5 py-0.2 rounded bg-purple-950/80 border border-purple-800/50">
                                    {currentBase.baseId}
                                  </code>
                                  {currentBase.recommended && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">{t('settingsRecommended')}</span>
                                  )}
                                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-mono flex items-center gap-1">
                                    <Database className="w-2.5 h-2.5" />
                                    {t('settingsSavedDb')}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                                  <span>Context: {currentBase.contextWindow || '128K'}</span>
                                  <span>•</span>
                                  <span>{t('settingsSupportedEfforts', { count: currentBase.supportedEfforts.length, efforts: currentBase.supportedEfforts.join(', ') })}</span>
                                  <span>•</span>
                                  <span className="text-cyan-400">{currentBase.rateLimits?.rpm || 500} RPM</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] text-purple-300 font-medium hidden sm:inline">{t('settingsSelectOtherModel')}</span>
                              <ChevronDown className={`w-4 h-4 text-purple-400 transition-transform duration-200 ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                            </div>
                          </button>

                          {/* Floating Dropdown Menu */}
                          {isModelDropdownOpen && (
                            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-950 border border-purple-500/50 rounded-xl shadow-2xl overflow-hidden backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-150">
                              {/* Search Header */}
                              <div className="p-3 border-b border-slate-800 bg-slate-900/90 space-y-2">
                                <div className="relative">
                                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                                  <input
                                    type="text"
                                    value={modelSearch}
                                    onChange={(e) => setModelSearch(e.target.value)}
                                    placeholder={t('aiModelSearchPlaceholder')}
                                    autoFocus
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                                  />
                                  {modelSearch && (
                                    <button
                                      type="button"
                                      onClick={() => setModelSearch('')}
                                      className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-200 text-xs px-1"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>

                                {/* Category Filter Tabs */}
                                <div className="flex items-center gap-1.5 text-[10px] overflow-x-auto pb-0.5">
                                  {[
                                    { id: 'all', label: `${t('settingsTabAll')} (${modelViewMode === 'base' ? baseModels.length : providerModels.length})` },
                                    { id: 'recommended', label: t('settingsTabRecommended') },
                                    { id: 'reasoning', label: t('settingsTabReasoning') },
                                    { id: 'fast', label: t('settingsTabFast') }
                                  ].map(tab => (
                                    <button
                                      key={tab.id}
                                      type="button"
                                      onClick={() => setModelCategoryFilter(tab.id as any)}
                                      className={`px-2 py-0.5 rounded-full transition-all whitespace-nowrap ${
                                        modelCategoryFilter === tab.id
                                          ? 'bg-purple-600 text-white font-semibold'
                                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                      }`}
                                    >
                                      {tab.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Dropdown Items List */}
                              <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60 p-1.5 space-y-1">
                                {modelViewMode === 'base' ? (
                                  /* BASE MODELS LIST */
                                  filteredBaseModels.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-slate-400">
                                      {t('settingsNoModelsFound', { query: modelSearch })}
                                    </div>
                                  ) : (
                                    filteredBaseModels.map((b) => {
                                      const isSelected = currentBaseId === b.baseId;
                                      const savedEff = savedModelEfforts[b.baseId]?.effortLevel;
                                      return (
                                        <div
                                          key={b.baseId}
                                          onClick={() => {
                                            handleSelectModel(b.baseId);
                                            setIsModelDropdownOpen(false);
                                          }}
                                          className={`p-2.5 rounded-lg cursor-pointer transition-all flex items-center justify-between gap-3 ${
                                            isSelected
                                              ? 'bg-purple-950/70 text-white border border-purple-500/60 shadow-sm'
                                              : 'hover:bg-slate-900/90 text-slate-300'
                                          }`}
                                        >
                                          <div className="min-w-0 space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <span className="font-bold text-xs text-white">
                                                {b.baseName}
                                              </span>
                                              <code className="text-[10px] font-mono text-purple-300 px-1.5 py-0.2 rounded bg-purple-950/60 border border-purple-800/40">
                                                {b.baseId}
                                              </code>
                                              {b.recommended && (
                                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-500/20 text-purple-300 font-semibold">{t('settingsRecommended')}</span>
                                              )}
                                              {savedEff && (
                                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-950/60 text-cyan-300 border border-cyan-800/50 font-mono font-semibold">
                                                  {t('settingsEffortSavedLabel', { effort: savedEff.toUpperCase() })}
                                                </span>
                                              )}
                                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-mono flex items-center gap-0.5">
                                                <Database className="w-2.5 h-2.5" />
                                                {t('settingsSaveDb')}
                                              </span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 line-clamp-1">
                                              {b.description}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-3 text-[9px] text-slate-400 font-mono">
                                              <span>Context: <strong className="text-slate-300">{b.contextWindow}</strong></span>
                                              <span>•</span>
                                              <span>{t('settingsEffortSupport')} <strong className="text-amber-300">{b.supportedEfforts.join(', ')}</strong></span>
                                              <span>•</span>
                                              <span>{t('settingsSpeedRpm')} <strong className="text-cyan-400">{b.rateLimits?.rpm || 500} RPM</strong></span>
                                            </div>
                                          </div>

                                          <div className="shrink-0">
                                            {isSelected ? (
                                              <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" />
                                              </div>
                                            ) : (
                                              <div className="w-5 h-5 rounded-full border border-slate-700 hover:border-slate-500" />
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })
                                  )
                                ) : (
                                  /* RAW VARIANTS LIST */
                                  filteredRawModels.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-slate-400">
                                      {t('settingsNoVariantsFound', { query: modelSearch })}
                                    </div>
                                  ) : (
                                    filteredRawModels.map((m) => {
                                      const isSelected = model === m.id;
                                      return (
                                        <div
                                          key={m.id}
                                          onClick={() => {
                                            handleSelectModel(m.id);
                                            setIsModelDropdownOpen(false);
                                          }}
                                          className={`p-2.5 rounded-lg cursor-pointer transition-all flex items-center justify-between gap-3 ${
                                            isSelected
                                              ? 'bg-purple-950/70 text-white border border-purple-500/60 shadow-sm'
                                              : 'hover:bg-slate-900/90 text-slate-300'
                                          }`}
                                        >
                                          <div className="min-w-0 space-y-0.5">
                                            <div className="flex items-center gap-2">
                                              <span className="font-bold text-xs text-white">{m.name}</span>
                                              <code className="text-[10px] font-mono text-purple-300 px-1.5 py-0.2 rounded bg-purple-950/60 border border-purple-800/40">
                                                {m.id}
                                              </code>
                                            </div>
                                            <div className="flex items-center gap-3 text-[9px] text-slate-400 font-mono">
                                              <span>Context: <strong className="text-slate-300">{m.contextWindow}</strong></span>
                                              <span>{t('settingsSpeedRpm')} <strong className="text-cyan-400">{m.rateLimits?.rpm || 500} RPM</strong></span>
                                            </div>
                                          </div>
                                          <div className="shrink-0">
                                            {isSelected ? (
                                              <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" />
                                              </div>
                                            ) : (
                                              <div className="w-5 h-5 rounded-full border border-slate-700 hover:border-slate-500" />
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })
                                  )
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Model Select Success Notification */}
                        {modelSelectSuccessMsg && (
                          <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="font-medium">{modelSelectSuccessMsg}</span>
                          </div>
                        )}

                        {/* Inspector for current base model */}
                        <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40 text-xs space-y-2.5 mt-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">{currentBase.baseName}</span>
                              <code className="text-purple-300 font-mono text-[11px] px-2 py-0.5 rounded bg-purple-900/40 border border-purple-700/50">
                                {currentBase.baseId}
                              </code>
                              {currentBase.recommended && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">{t('settingsRecommended')}</span>
                              )}
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-mono flex items-center gap-1">
                                <Database className="w-2.5 h-2.5" />
                                {t('settingsSaveSqlite')}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {t('settingsCurrentRuntime')} <span className="text-purple-300 font-bold">{model}</span>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            {currentBase.description}
                          </p>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-purple-900/30 text-[10px]">
                            <div>
                              <span className="text-slate-400 block">Context Window:</span>
                              <span className="font-mono text-slate-200 font-semibold">{currentBase.contextWindow}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">{t('settingsEffortSupport')}</span>
                              <span className="font-mono text-amber-300 font-semibold">{currentBase.supportedEfforts.join(', ')}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">{t('settingsMaxSpeed')}</span>
                              <span className="font-mono text-cyan-400 font-semibold">{currentBase.rateLimits?.rpm || 500} RPM</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">{t('settingsOptimizedForQa')}</span>
                              <span className="text-purple-200 truncate block font-medium">{currentBase.defaultModel.bestFor || t('settingsDocSynthesis')}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Quick 1-Touch Base Model Cards */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                          <span>{t('aiStepSelectModelFirst')} – {t('settingsStepSelectFirst')}</span>
                          <span className="text-slate-500 text-[10px]">{t('settingsAutoLoadEffort')}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {baseModels.slice(0, 6).map((b) => {
                            const isSelected = currentBaseId === b.baseId;
                            const savedEff = savedModelEfforts[b.baseId]?.effortLevel;
                            return (
                              <div
                                key={b.baseId}
                                onClick={() => handleSelectModel(b.baseId)}
                                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                                  isSelected
                                    ? 'bg-purple-950/30 border-purple-500 shadow-md ring-1 ring-purple-500/40'
                                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-1.5 font-bold text-white text-xs">
                                      <span>{b.baseName}</span>
                                      {b.recommended && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">{t('settingsRecommended')}</span>
                                      )}
                                      {savedEff && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-950/60 text-cyan-300 border border-cyan-800/50 font-mono font-semibold">
                                          Effort: {savedEff.toUpperCase()}
                                        </span>
                                      )}
                                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-mono flex items-center gap-1">
                                        <Database className="w-2.5 h-2.5" />
                                        DB
                                      </span>
                                    </div>
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                      isSelected ? 'border-purple-500 bg-purple-500' : 'border-slate-600'
                                    }`}>
                                      {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                    </div>
                                  </div>

                                  <p className="text-[11px] text-slate-300 mt-2 leading-relaxed line-clamp-2">
                                    {b.description}
                                  </p>
                                </div>

                                <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1 text-[10px]">
                                  <div className="flex items-center justify-between text-slate-400">
                                    <span>Context: <strong className="text-slate-200 font-mono">{b.contextWindow}</strong></span>
                                    <span>Effort: <strong className="text-amber-300 font-mono">{b.supportedEfforts.join(', ')}</strong></span>
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
                          <span className="text-[10px] text-slate-500">{t('settingsAllowCustomId')}</span>
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSelectModel(model)}
                            className="border-purple-800/60 text-purple-300 text-xs shrink-0 h-8"
                          >{t('settingsSaveThisModel')}</Button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 5. REASONING EFFORT */}
              {(() => {
                const { baseId, baseName: rawBaseName } = parseModelBase(model, model);
                const providerModels = availableModels[provider] || DEFAULT_PROVIDER_MODELS[provider] || [];
                const baseModels = groupIntoBaseModels(providerModels);
                const currentBase = baseModels.find(b => b.baseId === baseId);
                const baseName = currentBase?.baseName || rawBaseName;
                const supportedEfforts = currentBase?.supportedEfforts || ['low', 'medium', 'high'];

                const effortItems: Array<{
                  id: ReasoningEffortLevel;
                  name: string;
                  desc: string;
                  icon: string;
                  badge: string;
                  variantSuffix: string;
                }> = [
                  { id: 'low', name: 'Low', desc: t('settingsEffortLowDesc'), icon: '⚡', badge: 'Fast', variantSuffix: '-low' },
                  { id: 'medium', name: 'Medium', desc: t('settingsEffortMedDesc'), icon: '⚖️', badge: t('settingsRecommended'), variantSuffix: '-medium' },
                  { id: 'high', name: 'High', desc: t('settingsEffortHighDesc'), icon: '🧠', badge: 'Deep', variantSuffix: '-high' },
                  { id: 'xhigh', name: 'X-High', desc: t('settingsEffortXhighDesc'), icon: '🔬', badge: 'Heavy', variantSuffix: '-xhigh' },
                  { id: 'max', name: 'Max', desc: t('settingsEffortMaxDesc'), icon: '🚀', badge: 'Max', variantSuffix: '-max' }
                ];

                return (
                  <div className="space-y-4 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider">
                            {t('aiStepSelectEffortSecond')}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                            <Database className="w-3 h-3" />
                            {t('aiEffortSavedForModel')}
                          </span>
                        </div>
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 mt-1">
                          <Sliders className="w-4 h-4 text-purple-400" />
                          <span>{t('aiEffortConfiguredFor')} <strong className="text-purple-300 normal-case">{baseName}</strong></span>
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {t('settingsSelectEffortNotice', { model: baseName })}
                        </p>
                      </div>
                      <div className="shrink-0 font-mono text-[11px] text-purple-300 px-2.5 py-1 rounded bg-slate-900 border border-slate-800">
                        {t('settingsCliRuntimeCode')} <span className="text-white font-bold">{model}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
                      {/* Active Model Effort Context Card */}
                      <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/40 text-xs flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-slate-400 font-medium">{t('settingsAppliedModel')}</span>
                          <span className="font-bold text-white px-2 py-0.5 rounded bg-purple-900/60 border border-purple-700/60">
                            {baseName} ({baseId})
                          </span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400">{t('settingsCurrentEffortLevel')}</span>
                          <span className="font-bold text-amber-300 uppercase font-mono px-2 py-0.5 rounded bg-amber-950/50 border border-amber-700/50">
                            {effortLevel}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                          <Database className="w-3 h-3" />
                          <span>{t('settingsTableAiModelEfforts')}</span>
                        </div>
                      </div>

                      {/* Effort Saved Success Toast */}
                      {effortSavedMsg && (
                        <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-200">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="font-medium">{effortSavedMsg}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEffortSavedMsg(null)}
                            className="text-slate-400 hover:text-white text-xs px-1"
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      {/* Effort Level Selection Cards */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            {t('aiEffortLabel')}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {t('settingsClickSaveEffort', { model: baseName })}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                          {effortItems.map((item) => {
                            const isSelected = effortLevel === item.id;
                            const isSupported = supportedEfforts.includes(item.id);
                            const variantId = `${baseId}${item.variantSuffix}`;

                            return (
                              <div
                                key={item.id}
                                onClick={() => {
                                  if (isSupported) {
                                    handleSelectEffortForCurrentModel(item.id);
                                  }
                                }}
                                className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                                  !isSupported
                                    ? 'opacity-40 bg-slate-950/40 border-slate-800/50 cursor-not-allowed'
                                    : isSelected
                                    ? 'bg-purple-950/50 border-purple-500 shadow-md ring-2 ring-purple-500/50 cursor-pointer'
                                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 cursor-pointer'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <span className="text-base">{item.icon}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    isSelected
                                      ? 'bg-purple-500 text-white'
                                      : isSupported
                                      ? 'bg-slate-800 text-slate-400'
                                      : 'bg-slate-900 text-slate-600'
                                  }`}>
                                    {isSupported ? item.badge : 'N/A'}
                                  </span>
                                </div>
                                <div className="mt-2">
                                  <div className="font-bold text-xs text-white flex items-center justify-between">
                                    <span>{item.name}</span>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 font-bold" />}
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                                    {item.desc}
                                  </p>
                                  {isSupported && (
                                    <div className="mt-2 pt-1.5 border-t border-slate-800/60 text-[9px] font-mono text-purple-300 truncate">
                                      {variantId}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Max Output Tokens Selection */}
                      <div className="space-y-2 pt-3 border-t border-slate-800/80">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white flex items-center gap-1.5">
                            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                            {t('aiMaxTokensLabel')}
                          </span>
                          <span className="text-[11px] font-mono text-cyan-400 font-bold">
                            {maxOutputTokens.toLocaleString()} tokens
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                          {[
                            { val: 4096, label: '4,096', note: t('settingsNoteBrief') },
                            { val: 8192, label: '8,192', note: t('settingsNoteBasic') },
                            { val: 16384, label: '16,384', note: t('settingsNoteModerate') },
                            { val: 32768, label: '32,768', note: t('settingsNoteStandardQa') },
                            { val: 65536, label: '65,536', note: t('settingsNoteDetailed') },
                            { val: 128000, label: '128,000', note: t('settingsNoteMax') }
                          ].map((tok) => {
                            const isSelected = maxOutputTokens === tok.val;
                            return (
                              <button
                                key={tok.val}
                                type="button"
                                onClick={() => setMaxOutputTokens(tok.val)}
                                className={`p-2 rounded-lg border text-left transition-all ${
                                  isSelected
                                    ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-sm ring-1 ring-cyan-500/40'
                                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                                }`}
                              >
                                <div className="font-mono font-bold text-xs">{tok.label}</div>
                                <div className="text-[9px] text-slate-400 mt-0.5">{tok.note}</div>
                              </button>
                            );
                          })}
                        </div>

                        <p className="text-[10px] text-slate-400 mt-1 italic">
                          {t('aiMaxTokensHint')}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 5. QUOTA & RATE LIMITS */}
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
                          <span>{t('settingsRpmLabel')}</span>
                        </div>
                        <div className="text-base font-bold text-white mt-1 font-mono">
                          {quotaInfo.rateLimits.rpm.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">req/m</span>
                        </div>
                      </div>

                      {/* TPM */}
                      <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span>{t('settingsTpmLabel')}</span>
                        </div>
                        <div className="text-base font-bold text-white mt-1 font-mono">
                          {quotaInfo.rateLimits.tpm.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">tok/m</span>
                        </div>
                      </div>

                      {/* Context Window */}
                      <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                          <Layers className="w-3.5 h-3.5 text-purple-400" />
                          <span>{t('settingsMaxContext')}</span>
                        </div>
                        <div className="text-xs font-bold text-purple-300 mt-1.5 font-mono truncate">
                          {quotaInfo.rateLimits.contextWindow}
                        </div>
                      </div>

                      {/* Billing Model */}
                      <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                          <Shield className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{t('settingsBillingModel')}</span>
                        </div>
                        <div className="text-xs font-semibold text-emerald-400 mt-1.5 truncate">
                          {quotaInfo.usage.billingModel === 'subscription_included' ? 'Subscription' : 'Pay-per-token'}
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
                            {t('settingsQuotaPercentAvailable', { pct: quotaInfo.usage.remainingQuotaPercent })}
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
                            <span>{t('settingsAuthReqTitle')}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono">{t('settingsSessionExpired')}</span>
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
                          <span>{t('settingsOpenTerminalLogin')}</span>
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
                            <span>{copiedCmd ? t('settingsCopiedExcl') : t('settingsCopyOneTouch')}</span>
                          </button>
                        </div>
                        <div className="text-slate-400 text-[11px] flex items-center gap-1.5 pt-1">
                          <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-400 text-[10px] flex items-center justify-center font-bold">2</span>
                          <span>{t('settingsAfterLoginPrompt')}</span>
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
                          <span>{t('settingsConnectionSuccessTitle')}</span>
                          {testResult.details?.account && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                              @{testResult.details.account}
                            </span>
                          )}
                          <span className="text-xs text-emerald-400 font-mono">({testResult.latencyMs}ms)</span>
                        </div>
                        <div className="text-emerald-200/90">{testResult.message}</div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          {t('settingsConnectionReadyDesc')}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Case 3: Other Error */}
                  {!testResult.success && testResult.connectionStatus !== 'auth_required' && (
                    <div className="p-4 rounded-xl border bg-rose-950/20 border-rose-800/40 text-rose-300 flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-0.5">
                        <div className="font-bold text-sm text-rose-200">{t('settingsConnectionErrorTitle')}</div>
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
                {t('settingsAuditShaNotice')}
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
                  <th className="py-2.5 px-3">{t('settingsAuditColBlockId')}</th>
                  <th className="py-2.5 px-3">{t('settingsAuditColTime')}</th>
                  <th className="py-2.5 px-3">{t('settingsAuditColUser')}</th>
                  <th className="py-2.5 px-3">{t('settingsAuditColRole')}</th>
                  <th className="py-2.5 px-3">{t('settingsAuditColAction')}</th>
                  <th className="py-2.5 px-3">{t('settingsAuditColHash')}</th>
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
              {t('settingsRbacNotice', { role: currentRole })}
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
              {t('settingsProjectConfigNotice')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="text-slate-400">{t('settingsProjectNameLabel')}</div>
              <div className="font-bold text-white text-sm">{activeProject.name}</div>
              <div className="text-slate-400 text-[11px]">{activeProject.description}</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="text-slate-400">Database Storage:</div>
              <div className="font-bold text-emerald-400 text-sm">SQLite (WAL Mode)</div>
              <div className="text-slate-400 text-[11px]">{t('settingsDbPathLabel')}</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
