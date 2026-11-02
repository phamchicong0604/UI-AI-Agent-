import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../common/i18n/I18nContext';
import {
  Shield,
  History,
  CheckCircle2,
  XCircle,
  FolderDot,
  Hash,
  Link2,
  Cpu,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  RefreshCw,
  Save,
  Check,
  AlertCircle,
  Terminal,
  Play,
  Square,
  Copy,
  Download,
  Bot,
  Zap,
  CornerDownLeft,
  Activity,
  Clock,
  Layers,
  FileCode,
  X
} from 'lucide-react';
import { Card, Badge, Button } from '../../common/components';
import {
  getAiSettings,
  saveAiSettings,
  testAiConnection,
  getAgentConfig,
  saveAgentConfig,
  generateAgentToken,
  executeAgentCommand,
  getBackgroundAgents,
  startBackgroundAgent,
  stopBackgroundAgent,
  triggerBackgroundAgent,
  getBackgroundAgentLogs
} from '../../common/services/api';
import { BackgroundAgentRecord } from '../../types';

export const SettingsView: React.FC = () => {
  const { activeProject, auditEvents, currentRole } = useApp();
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<'agent' | 'ai' | 'audit' | 'rbac' | 'workspace'>('agent');

  // AI Configuration State
  const [provider, setProvider] = useState<'gemini' | 'openai'>('gemini');
  const [geminiModel, setGeminiModel] = useState<string>('gemini-1.5-pro');
  const [openaiModel, setOpenaiModel] = useState<string>('gpt-4o');
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [openaiKey, setOpenaiKey] = useState<string>('');
  const [showGeminiKey, setShowGeminiKey] = useState<boolean>(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState<boolean>(false);
  
  const [maskedGeminiKey, setMaskedGeminiKey] = useState<string>('');
  const [maskedOpenAiKey, setMaskedOpenAiKey] = useState<string>('');
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean>(false);
  const [hasOpenAiKey, setHasOpenAiKey] = useState<boolean>(false);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Terminal Agent State
  const [agentName, setAgentName] = useState<string>('DocQA-Terminal-Copilot');
  const [agentPersona, setAgentPersona] = useState<string>('QA Automation & Grounding Specialist');
  const [autonomyLevel, setAutonomyLevel] = useState<string>('assisted');
  const [cliToken, setCliToken] = useState<string>('');
  const [isRotatingToken, setIsRotatingToken] = useState<boolean>(false);
  const [isSavingAgent, setIsSavingAgent] = useState<boolean>(false);
  const [agentSaveMsg, setAgentSaveMsg] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Background Agents State
  const [backgroundAgents, setBackgroundAgents] = useState<BackgroundAgentRecord[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState<boolean>(false);
  const [operatingAgentId, setOperatingAgentId] = useState<string | null>(null);
  const [selectedAgentForLogs, setSelectedAgentForLogs] = useState<BackgroundAgentRecord | null>(null);
  const [agentLogs, setAgentLogs] = useState<Array<{ timestamp: string; message: string; level: string }>>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);

  // Interactive Terminal Emulator State
  const [terminalInput, setTerminalInput] = useState<string>('daemon status');
  const [isTerminalRunning, setIsTerminalRunning] = useState<boolean>(false);
  const [terminalHistory, setTerminalHistory] = useState<Array<{ command: string; stdout: string; latencyMs?: number; isError?: boolean }>>([
    {
      command: 'daemon status',
      stdout: `DocQA Background Agents Daemon Initialized.\n4 Autonomous workers are configured to execute in the background.\nType "help" to list CLI commands or run daemon controls below.`
    }
  ]);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSettings();
    loadAgentProfile();
    loadBackgroundAgentsList();
  }, []);

  useEffect(() => {
    if (activeTab === 'agent') {
      terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalHistory, activeTab]);

  const loadSettings = async () => {
    try {
      const data = await getAiSettings();
      if (data) {
        setProvider(data.provider || 'gemini');
        setGeminiModel(data.geminiModel || 'gemini-1.5-pro');
        setOpenaiModel(data.openaiModel || 'gpt-4o');
        setHasGeminiKey(data.hasGeminiKey);
        setHasOpenAiKey(data.hasOpenAiKey);
        setMaskedGeminiKey(data.maskedGeminiKey || '');
        setMaskedOpenAiKey(data.maskedOpenAiKey || '');
      }
    } catch (err) {
      console.warn('Failed to fetch settings from backend:', err);
    }
  };

  const loadAgentProfile = async () => {
    try {
      const data = await getAgentConfig();
      if (data) {
        setAgentName(data.agentName || 'DocQA-Terminal-Copilot');
        setAgentPersona(data.persona || 'QA Automation & Grounding Specialist');
        setAutonomyLevel(data.autonomyLevel || 'assisted');
        setCliToken(data.cliToken || '');
      }
    } catch (err) {
      console.warn('Failed to fetch agent profile:', err);
    }
  };

  const loadBackgroundAgentsList = async () => {
    setIsLoadingAgents(true);
    try {
      const list = await getBackgroundAgents();
      if (Array.isArray(list)) {
        setBackgroundAgents(list);
      }
    } catch (err) {
      console.warn('Failed to fetch background agents:', err);
    } finally {
      setIsLoadingAgents(false);
    }
  };

  const handleStartAgent = async (id: string) => {
    setOperatingAgentId(id);
    try {
      await startBackgroundAgent(id);
      await loadBackgroundAgentsList();
    } catch (err: any) {
      alert(`Error starting agent ${id}: ${err.message}`);
    } finally {
      setOperatingAgentId(null);
    }
  };

  const handleStopAgent = async (id: string) => {
    setOperatingAgentId(id);
    try {
      await stopBackgroundAgent(id);
      await loadBackgroundAgentsList();
    } catch (err: any) {
      alert(`Error stopping agent ${id}: ${err.message}`);
    } finally {
      setOperatingAgentId(null);
    }
  };

  const handleTriggerAgent = async (id: string) => {
    setOperatingAgentId(id);
    try {
      const res = await triggerBackgroundAgent(id);
      await loadBackgroundAgentsList();
      alert(`⚡ Đã kích hoạt 1 chu kỳ cho ${id}:\n${res?.log || 'Hoàn thành'}`);
    } catch (err: any) {
      alert(`Error triggering agent ${id}: ${err.message}`);
    } finally {
      setOperatingAgentId(null);
    }
  };

  const handleViewLogs = async (agent: BackgroundAgentRecord) => {
    setSelectedAgentForLogs(agent);
    setIsLoadingLogs(true);
    try {
      const logs = await getBackgroundAgentLogs(agent.id);
      setAgentLogs(Array.isArray(logs) ? logs : []);
    } catch (err: any) {
      alert(`Error fetching logs: ${err.message}`);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);
    try {
      await saveAiSettings({
        provider,
        geminiModel,
        openaiModel,
        geminiKey: geminiKey ? geminiKey.trim() : undefined,
        openaiKey: openaiKey ? openaiKey.trim() : undefined
      });
      setSaveSuccessMsg(t('aiConfigSuccess'));
      setGeminiKey('');
      setOpenaiKey('');
      await loadSettings();
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Error saving AI settings: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testAiConnection();
      setTestResult({
        success: true,
        message: res.message || 'Kết nối thành công',
        latencyMs: res.data?.latencyMs
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Lỗi kết nối'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAgent = async () => {
    setIsSavingAgent(true);
    setAgentSaveMsg(null);
    try {
      await saveAgentConfig({ agentName, persona: agentPersona, autonomyLevel });
      setAgentSaveMsg(t('agentSaveConfigSuccess'));
      setTimeout(() => setAgentSaveMsg(null), 3000);
    } catch (err: any) {
      alert(`Failed to update agent profile: ${err.message}`);
    } finally {
      setIsSavingAgent(false);
    }
  };

  const handleRotateToken = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn cấp lại CLI Access Token mới?')) return;
    setIsRotatingToken(true);
    try {
      const res = await generateAgentToken();
      if (res?.cliToken) {
        setCliToken(res.cliToken);
      }
    } catch (err: any) {
      alert(`Error generating token: ${err.message}`);
    } finally {
      setIsRotatingToken(false);
    }
  };

  const handleCopy = (text: string, isToken: boolean = false) => {
    navigator.clipboard.writeText(text);
    if (isToken) {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else {
      setCopiedCmd(text);
      setTimeout(() => setCopiedCmd(null), 2000);
    }
  };

  const handleDownloadRc = () => {
    const rcContent = `# DocQA Terminal Agent Configuration File\nDOCQA_ENDPOINT=http://localhost:5001/api/v1\nDOCQA_AGENT_NAME=${agentName}\nDOCQA_TOKEN=${cliToken}\nDOCQA_MODEL=${geminiModel}\n`;
    const blob = new Blob([rcContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '.docqarc';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunTerminalCommand = async (cmdToRun?: string) => {
    const cmd = (cmdToRun || terminalInput).trim();
    if (!cmd) return;

    if (cmd === 'clear') {
      setTerminalHistory([]);
      setTerminalInput('');
      return;
    }

    setIsTerminalRunning(true);
    try {
      const res = await executeAgentCommand(cmd);
      setTerminalHistory(prev => [
        ...prev,
        {
          command: cmd,
          stdout: res.stdout,
          latencyMs: res.latencyMs,
          isError: res.exitCode !== 0
        }
      ]);
      setTerminalInput('');
      // If a daemon start/stop/trigger was run in CLI, refresh the UI list
      if (cmd.startsWith('daemon')) {
        await loadBackgroundAgentsList();
      }
    } catch (err: any) {
      setTerminalHistory(prev => [
        ...prev,
        {
          command: cmd,
          stdout: `[CLI ERROR]: ${err.message}`,
          isError: true
        }
      ]);
    } finally {
      setIsTerminalRunning(false);
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
      role: 'QA',
      scope: 'Test cases, test execution, evidence & defects',
      canEditReq: false,
      canApprove: false,
      canExecute: true,
      canUploadEVD: true
    },
    {
      role: 'Reviewer / Approver',
      scope: 'Authority to sign-off and approve baselines',
      canEditReq: false,
      canApprove: true,
      canExecute: true,
      canUploadEVD: true
    }
  ];

  const quickCommands = [
    { label: 'daemon status', cmd: 'daemon status' },
    { label: 'daemon trigger AGENT-DOC-WATCHER', cmd: 'daemon trigger AGENT-DOC-WATCHER' },
    { label: 'daemon trigger AGENT-QA-SYNTH', cmd: 'daemon trigger AGENT-QA-SYNTH' },
    { label: 'daemon trigger AGENT-AUDIT-GUARDIAN', cmd: 'daemon trigger AGENT-AUDIT-GUARDIAN' },
    { label: 'generate REQ-001', cmd: 'generate REQ-001' },
    { label: 'status', cmd: 'status' },
    { label: 'clear', cmd: 'clear' }
  ];

  const runningCount = backgroundAgents.filter(a => a.status === 'running').length;

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
            onClick={() => setActiveTab('agent')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'agent'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
            <span>Agent Chạy Nền (Daemons)</span>
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'ai'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-indigo-900/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            <span>{t('settingsTabAi')}</span>
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

      {/* TAB: BACKGROUND DAEMON AGENTS & TERMINAL RUNNER */}
      {activeTab === 'agent' && (
        <div className="space-y-6">
          {/* Top Banner KPI for Background Daemon Pool */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-slate-900/80 border-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="text-slate-400 text-[11px] font-medium uppercase tracking-wider">Trạng thái Chạy nền</div>
                <div className="text-lg font-bold text-white mt-0.5 flex items-center gap-2">
                  <span>{runningCount} / {backgroundAgents.length} Running</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-slate-900/80 border-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-slate-400 text-[11px] font-medium uppercase tracking-wider">Chu kỳ Polling</div>
                <div className="text-lg font-bold text-white mt-0.5">30s - 60s Interval</div>
              </div>
            </Card>

            <Card className="p-4 bg-slate-900/80 border-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <div className="text-slate-400 text-[11px] font-medium uppercase tracking-wider">Lệnh CLI Terminal</div>
                <div className="text-sm font-bold font-mono text-emerald-400 mt-1 select-all">npm run agent daemon</div>
              </div>
            </Card>

            <Card className="p-4 bg-slate-900/80 border-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="text-slate-400 text-[11px] font-medium uppercase tracking-wider">Chính sách Bảo mật</div>
                <div className="text-sm font-bold text-amber-300 mt-1">Section 8.1 Draft Only</div>
              </div>
            </Card>
          </div>

          {/* Background Agents List Card */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Danh sách các Agent Chạy Nền (Daemon Background Workers)</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadBackgroundAgentsList}
                  disabled={isLoadingAgents}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingAgents ? 'animate-spin' : ''}`} />
                  <span>Làm mới danh sách</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {backgroundAgents.map(agent => {
                const isRunning = agent.status === 'running';
                const isOperating = operatingAgentId === agent.id;

                return (
                  <div
                    key={agent.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      isRunning
                        ? 'bg-slate-950/80 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
                        : 'bg-slate-950/40 border-slate-800 opacity-80'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Top Header of Card */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-emerald-400">{agent.id}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isRunning
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                              <span>{isRunning ? `RUNNING (PID ${agent.pid || 'Worker'})` : 'STOPPED'}</span>
                            </span>
                          </div>
                          <h4 className="font-bold text-sm text-white mt-1">{agent.name}</h4>
                          <p className="text-xs text-indigo-300 font-mono mt-0.5">{agent.role}</p>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {agent.description}
                      </p>

                      {/* Execution Metrics */}
                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-850 text-[11px] font-mono">
                        <div>
                          <div className="text-slate-500">Chu kỳ:</div>
                          <div className="text-slate-200 font-semibold mt-0.5">{agent.intervalSeconds}s loop</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Đã chạy:</div>
                          <div className="text-emerald-400 font-semibold mt-0.5">{agent.runsCount} chu kỳ</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Lần chạy tiếp:</div>
                          <div className="text-slate-300 mt-0.5 truncate">{agent.nextRun ? agent.nextRun.slice(-5) : 'N/A'}</div>
                        </div>
                      </div>

                      {/* Latest Log Console Line */}
                      {agent.lastLog && (
                        <div className="p-2 rounded bg-slate-950 border border-slate-850 text-[11px] font-mono text-slate-400 truncate flex items-center gap-1.5">
                          <Activity className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className="truncate">{agent.lastLog}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between gap-2 pt-4 mt-3 border-t border-slate-850">
                      <div className="flex items-center gap-2">
                        {isRunning ? (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleStopAgent(agent.id)}
                            disabled={isOperating}
                            className="flex items-center gap-1 text-xs px-2.5 py-1"
                          >
                            <Square className="w-3 h-3" />
                            <span>Dừng Worker</span>
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleStartAgent(agent.id)}
                            disabled={isOperating}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 text-xs px-2.5 py-1"
                          >
                            <Play className="w-3 h-3" />
                            <span>Khởi động</span>
                          </Button>
                        )}

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleTriggerAgent(agent.id)}
                          disabled={isOperating}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 text-amber-300 hover:text-amber-200 border-amber-500/30"
                          title="Chạy ngay lập tức 1 chu kỳ mà không cần chờ interval"
                        >
                          <Zap className="w-3 h-3 text-amber-400" />
                          <span>Chạy ngay</span>
                        </Button>
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleViewLogs(agent)}
                        className="flex items-center gap-1 text-xs px-2.5 py-1 text-slate-300"
                      >
                        <FileCode className="w-3 h-3" />
                        <span>Xem Logs</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Terminal CLI Access & Cheat Sheet */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>{t('agentCliAccessTitle')}</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Executable: <code className="text-emerald-400 font-bold">npm run agent</code>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Token & Config File */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-850 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">{t('agentTokenLabel')}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(cliToken, true)}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      {copiedToken ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedToken ? 'Đã sao chép' : 'Sao chép'}</span>
                    </button>
                    <button
                      onClick={handleRotateToken}
                      disabled={isRotatingToken}
                      className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${isRotatingToken ? 'animate-spin' : ''}`} />
                      <span>{t('agentGenerateNewToken')}</span>
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-slate-300 break-all select-all">
                  {cliToken || 'docqa_tok_loading...'}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">File cấu hình môi trường:</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDownloadRc}
                    className="flex items-center gap-1 text-[11px]"
                  >
                    <Download className="w-3 h-3 text-slate-400" />
                    <span>{t('agentDownloadRc')}</span>
                  </Button>
                </div>
              </div>

              {/* Terminal Quickstart Commands */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-850 space-y-2.5 text-xs">
                <span className="font-semibold text-white block mb-1">Các lệnh CLI quản trị Agent chạy nền:</span>
                {[
                  { cmd: 'npm run agent daemon status', desc: 'Xem danh sách và PID các background agent' },
                  { cmd: 'npm run agent daemon start AGENT-QA-SYNTH', desc: 'Bật worker tự động tạo test case' },
                  { cmd: 'npm run agent daemon stop AGENT-DOC-WATCHER', desc: 'Tắt worker theo dõi tài liệu' },
                  { cmd: 'npm run agent daemon trigger AGENT-GAP-SCANNER', desc: 'Kích hoạt quét lỗ hổng ngay' },
                  { cmd: 'npm run agent status', desc: 'Kiểm tra tổng thể platform & database' }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between group p-1.5 rounded hover:bg-slate-900">
                    <div className="font-mono text-emerald-400 text-[11px] select-all font-semibold">
                      {item.cmd}
                    </div>
                    <button
                      onClick={() => handleCopy(item.cmd)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-white"
                      title="Sao chép lệnh"
                    >
                      {copiedCmd === item.cmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Interactive In-Browser Terminal Emulator */}
          <Card className="space-y-3 bg-slate-950 border-slate-800 p-0 overflow-hidden shadow-2xl">
            {/* Terminal Window Header */}
            <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-xs font-mono font-bold text-slate-300 ml-2">
                  docqa-agent-cli (zsh / bash) • localhost:5001
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-mono text-emerald-400 font-semibold">DAEMON CONTROLLER</span>
              </div>
            </div>

            {/* Quick Chips */}
            <div className="px-4 py-2 bg-slate-900/40 border-b border-slate-855 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-slate-400 text-[11px] mr-1">Lệnh mẫu:</span>
              {quickCommands.map(q => (
                <button
                  key={q.cmd}
                  onClick={() => handleRunTerminalCommand(q.cmd)}
                  disabled={isTerminalRunning}
                  className="px-2 py-0.5 rounded-md bg-slate-850 hover:bg-slate-750 text-slate-300 hover:text-emerald-300 font-mono border border-slate-750 transition-colors"
                >
                  {q.label}
                </button>
              ))}
            </div>

            {/* Terminal Output Body */}
            <div className="p-4 font-mono text-xs max-h-96 min-h-64 overflow-y-auto space-y-4 bg-slate-950 text-slate-200 leading-relaxed">
              {terminalHistory.map((entry, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <span>$ docqa-agent</span>
                    <span className="text-white">{entry.command}</span>
                    {entry.latencyMs !== undefined && (
                      <span className="text-[10px] text-slate-500 font-normal">({entry.latencyMs}ms)</span>
                    )}
                  </div>
                  <pre className={`whitespace-pre-wrap font-mono text-xs pl-2 border-l-2 ${
                    entry.isError ? 'border-rose-500 text-rose-300' : 'border-slate-800 text-slate-300'
                  }`}>
                    {entry.stdout}
                  </pre>
                </div>
              ))}
              {isTerminalRunning && (
                <div className="flex items-center gap-2 text-emerald-400 animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Agent executing daemon command via backend SQLite and AI engine...</span>
                </div>
              )}
              <div ref={terminalBottomRef} />
            </div>

            {/* Terminal Command Input Prompt */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRunTerminalCommand();
              }}
              className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center gap-2"
            >
              <div className="font-mono font-bold text-emerald-400 text-xs pl-2 flex items-center gap-1">
                <span>$</span>
                <span className="text-slate-400">docqa-agent</span>
                <span>&gt;</span>
              </div>
              <input
                type="text"
                value={terminalInput}
                onChange={e => setTerminalInput(e.target.value)}
                placeholder="Nhập lệnh (vd: daemon status, daemon start AGENT-QA-SYNTH, status)..."
                disabled={isTerminalRunning}
                className="flex-1 bg-transparent border-0 text-white text-xs font-mono focus:outline-none focus:ring-0 placeholder:text-slate-500"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isTerminalRunning || !terminalInput.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono flex items-center gap-1"
              >
                <span>Chạy lệnh</span>
                <CornerDownLeft className="w-3 h-3" />
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: LIVE LOGS FOR A BACKGROUND AGENT */}
      {selectedAgentForLogs && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-5 py-3.5 bg-slate-850 border-b border-slate-750 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-sm text-white">
                  Logs thời gian thực: {selectedAgentForLogs.name}
                </span>
                <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  {selectedAgentForLogs.id}
                </span>
              </div>
              <button
                onClick={() => setSelectedAgentForLogs(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-750"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto font-mono text-xs space-y-2 bg-slate-950 flex-1">
              {isLoadingLogs ? (
                <div className="text-center py-6 text-slate-400">Đang tải nhật ký...</div>
              ) : agentLogs.length === 0 ? (
                <div className="text-center py-6 text-slate-500">Chưa có nhật ký hoạt động nào.</div>
              ) : (
                agentLogs.map((log, idx) => (
                  <div key={idx} className="p-2 rounded bg-slate-900 border border-slate-850 flex items-start gap-2">
                    <span className="text-slate-500 text-[10px] shrink-0">{log.timestamp}</span>
                    <span className={`text-[10px] font-bold px-1 rounded uppercase shrink-0 ${
                      log.level === 'error' ? 'bg-rose-500/20 text-rose-400' :
                      log.level === 'warn' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {log.level}
                    </span>
                    <span className="text-slate-200 break-all">{log.message}</span>
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-3 bg-slate-850 border-t border-slate-750 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Lưu trữ 50 bản ghi gần nhất trong bộ nhớ đệm
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedAgentForLogs(null)}
              >
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: AI & LLM CONFIGURATION */}
      {activeTab === 'ai' && (
        <div className="space-y-5">
          <Card className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Cpu className="w-4 h-4 text-purple-400" />
                <span>{t('aiProviderTitle')}</span>
              </div>
              <Badge variant="info">
                Persisted in SQLite • /api/v1/settings/ai
              </Badge>
            </div>

            {/* Provider Switcher */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                onClick={() => setProvider('gemini')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  provider === 'gemini'
                    ? 'bg-purple-950/30 border-purple-500 shadow-md shadow-purple-950/40 ring-1 ring-purple-500/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
                    {t('aiProviderGemini')}
                  </div>
                  {hasGeminiKey && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Key Configured
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Gemini 1.5 Pro / Flash với 1M+ token context window, phân tích sâu các tài liệu BRD/SRS nhiều bảng biểu.
                </p>
              </div>

              <div
                onClick={() => setProvider('openai')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  provider === 'openai'
                    ? 'bg-indigo-950/30 border-indigo-500 shadow-md shadow-indigo-950/40 ring-1 ring-indigo-500/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                    {t('aiProviderOpenAi')}
                  </div>
                  {hasOpenAiKey && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Key Configured
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  GPT-4o và GPT-4o-mini tối ưu khả năng suy luận logic và phân tích các ca kiểm thử biên (Boundary & Negative).
                </p>
              </div>
            </div>

            {/* Model & API Key Inputs */}
            {provider === 'gemini' ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      {t('aiModelSelect')}
                    </label>
                    <select
                      value={geminiModel}
                      onChange={e => setGeminiModel(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-750 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                    >
                      <option value="gemini-1.5-pro">gemini-1.5-pro (Mạnh nhất - Khuyên dùng)</option>
                      <option value="gemini-1.5-flash">gemini-1.5-flash (Phản hồi siêu tốc)</option>
                      <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp (Thử nghiệm)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                        <span>Google Gemini API Key</span>
                      </label>
                      {maskedGeminiKey && (
                        <span className="text-[10px] font-mono text-slate-400">
                          Đã lưu: {maskedGeminiKey}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showGeminiKey ? 'text' : 'password'}
                        value={geminiKey}
                        onChange={e => setGeminiKey(e.target.value)}
                        placeholder={maskedGeminiKey ? 'Nhập key mới nếu muốn thay đổi...' : 'AIzaSy...'}
                        className="w-full bg-slate-900 border border-slate-750 text-slate-200 text-xs rounded-xl px-3 py-2.5 pr-10 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      {t('aiModelSelect')}
                    </label>
                    <select
                      value={openaiModel}
                      onChange={e => setOpenaiModel(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-750 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    >
                      <option value="gpt-4o">gpt-4o (Đa phương thức & suy luận logic cao)</option>
                      <option value="gpt-4o-mini">gpt-4o-mini (Tiết kiệm chi phí & tốc độ cao)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                        <span>OpenAI API Key</span>
                      </label>
                      {maskedOpenAiKey && (
                        <span className="text-[10px] font-mono text-slate-400">
                          Đã lưu: {maskedOpenAiKey}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showOpenaiKey ? 'text' : 'password'}
                        value={openaiKey}
                        onChange={e => setOpenaiKey(e.target.value)}
                        placeholder={maskedOpenAiKey ? 'Nhập key mới nếu muốn thay đổi...' : 'sk-proj-...'}
                        className="w-full bg-slate-900 border border-slate-750 text-slate-200 text-xs rounded-xl px-3 py-2.5 pr-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showOpenaiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? t('aiTesting') : t('aiTestConnectionBtn')}</span>
                </Button>

                {testResult && (
                  <div
                    className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium ${
                      testResult.success
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {testResult.success ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    <span>{testResult.message}</span>
                    {testResult.latencyMs && (
                      <span className="font-mono text-[10px] text-slate-400">({testResult.latencyMs}ms)</span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {saveSuccessMsg && (
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    {saveSuccessMsg}
                  </span>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveConfig}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? t('aiSaving') : t('aiSaveConfigBtn')}</span>
                </Button>
              </div>
            </div>

            {/* Zero-Key Policy Notice */}
            <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40 text-xs text-purple-200/90 leading-relaxed flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block mb-0.5">Mục 8 & 8.1 Proposal Tuân Thủ:</span>
                {t('aiZeroKeyNotice')}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <History className="w-4 h-4 text-emerald-400" />
              <span>{t('settingsAuditTrail')}</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
              SHA-256 Chained Integrity Verified
            </span>
          </div>

          <div className="space-y-2.5 max-h-96 overflow-y-auto">
            {auditEvents.map(evt => (
              <div key={evt.id} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-cyan-400 font-bold">{evt.id}</span>
                    <Badge variant="info">
                      {evt.entityType}: {evt.entityId}
                    </Badge>
                    <span className="font-semibold text-white">{evt.action}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    {evt.user} ({evt.role}) • {evt.timestamp}
                  </div>
                </div>

                <div className="text-slate-300 text-[11px]">{evt.details}</div>

                {/* Cryptographic Hash Verification Line */}
                <div className="pt-1 border-t border-slate-850 flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-500 gap-2">
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    Hash: {evt.eventHash}
                  </span>
                  {evt.previousEventHash && (
                    <span className="text-slate-500 flex items-center gap-1">
                      <Link2 className="w-3 h-3" />
                      Prev: {evt.previousEventHash.slice(0, 18)}...
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 3: RBAC MATRIX */}
      {activeTab === 'rbac' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span>{t('settingsRbacMatrix')}</span>
            </div>
            <span className="text-xs text-indigo-300 font-mono">Current Role: {currentRole}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3 pl-4">{t('settingsColRole')}</th>
                  <th className="p-3">{t('settingsColScope')}</th>
                  <th className="p-3 text-center">{t('settingsColReq')}</th>
                  <th className="p-3 text-center">{t('settingsColApprove')}</th>
                  <th className="p-3 text-center">{t('settingsColExec')}</th>
                  <th className="p-3 pr-4 text-center">{t('settingsColEvd')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {roleMatrix.map(m => (
                  <tr key={m.role} className={`hover:bg-slate-850/50 ${currentRole === m.role ? 'bg-indigo-950/20' : ''}`}>
                    <td className="p-3 pl-4 font-bold text-white flex items-center gap-2">
                      <span>{m.role}</span>
                      {currentRole === m.role && (
                        <Badge variant="info">ACTIVE</Badge>
                      )}
                    </td>
                    <td className="p-3 text-slate-300">{m.scope}</td>
                    <td className="p-3 text-center">
                      {m.canEditReq ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <XCircle className="w-4 h-4 text-slate-600 mx-auto" />}
                    </td>
                    <td className="p-3 text-center">
                      {m.canApprove ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <XCircle className="w-4 h-4 text-slate-600 mx-auto" />}
                    </td>
                    <td className="p-3 text-center">
                      {m.canExecute ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <XCircle className="w-4 h-4 text-slate-600 mx-auto" />}
                    </td>
                    <td className="p-3 pr-4 text-center">
                      {m.canUploadEVD ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" /> : <XCircle className="w-4 h-4 text-slate-600 mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 4: WORKSPACE DETAILS */}
      {activeTab === 'workspace' && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-sm font-bold text-white">
            <FolderDot className="w-4 h-4 text-indigo-400" />
            <span>{t('settingsWorkspaceDetails')}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-850">
              <div className="text-slate-400 text-[11px]">Project Name:</div>
              <div className="font-bold text-white mt-0.5">{activeProject.name}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-850">
              <div className="text-slate-400 text-[11px]">Project Key:</div>
              <div className="font-mono font-bold text-indigo-400 mt-0.5">{activeProject.key}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-850">
              <div className="text-slate-400 text-[11px]">Baseline Version:</div>
              <div className="font-mono text-emerald-400 font-semibold mt-0.5">{activeProject.version}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-850">
              <div className="text-slate-400 text-[11px]">Members Assigned:</div>
              <div className="font-semibold text-slate-200 mt-0.5">{activeProject.membersCount} collaborators</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
