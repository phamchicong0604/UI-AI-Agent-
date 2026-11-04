import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../common/i18n/I18nContext';
import { UserRole } from '../../types';
import {
  Search,
  Bell,
  Sparkles,
  ChevronDown,
  RotateCcw,
  UserCircle2,
  FolderDot,
  Globe,
  LogIn,
  LogOut
} from 'lucide-react';
import { Badge } from '../../common/components/Badge';

export const Header: React.FC = () => {
  const {
    currentRole,
    setCurrentRole,
    currentUser,
    authUser,
    logout,
    switchRole,
    setIsLoginModalOpen,
    activeProject,
    setActiveProject,
    projects,
    questions,
    searchQuery,
    setSearchQuery,
    setIsAiModalOpen,
    isModelSwitcherOpen,
    setIsModelSwitcherOpen,
    aiConfig,
    backendConnected,
    isSyncing,
    syncWithBackend
  } = useApp();

  const { language, setLanguage, t } = useI18n();

  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  const roles: UserRole[] = [
    'QA',
    'Reviewer / Approver',
    'BA',
    'Tech Lead / DEV',
    'PM / Project Lead',
    'Project Admin'
  ];

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case 'Reviewer / Approver':
        return 'purple';
      case 'Project Admin':
        return 'danger';
      case 'BA':
        return 'info';
      case 'QA':
        return 'success';
      case 'Tech Lead / DEV':
        return 'warning';
      case 'PM / Project Lead':
        return 'cyan';
      default:
        return 'neutral';
    }
  };

  const openQuestions = questions.filter(q => q.status === 'Open');

  const formatModelDisplayName = (modelId?: string) => {
    if (!modelId) return 'Gemini 3.8 Flash';
    if (modelId.startsWith('gemini-4-argon')) return 'Gemini 4 Argon';
    if (modelId.startsWith('gemini-3.8-flash')) return 'Gemini 3.8 Flash';
    if (modelId.startsWith('claude-opus-5-5')) return 'Claude Opus 5.5';
    if (modelId.startsWith('claude-sonnet-5-5')) return 'Claude Sonnet 5.5';
    if (modelId.startsWith('gpt-oss-120b')) return 'GPT-OSS 120B';
    return modelId.replace(/-medium|-high|-low/, '');
  };

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between gap-4 z-20 shrink-0">
      {/* Left: Project Selector & Global Search */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Project Dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors text-xs font-semibold whitespace-nowrap"
          >
            <FolderDot className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="max-w-[180px] truncate">{activeProject.name}</span>
            <span className="font-mono text-[10px] text-indigo-300 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-500/30">
              {activeProject.key}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {isProjectDropdownOpen && (
            <div className="absolute left-0 mt-2 w-72 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl p-1.5 z-50">
              <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {t('workspaces')} ({projects.length})
              </div>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActiveProject(p);
                    setIsProjectDropdownOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors ${
                    activeProject.id === p.id
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-300 hover:bg-slate-700/60'
                  }`}
                >
                  <div className="font-semibold flex items-center justify-between">
                    <span className="truncate">{p.name}</span>
                    <span className="font-mono text-[10px] text-indigo-300 bg-slate-900 px-1.5 py-0.5 rounded ml-2 shrink-0">{p.key}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{p.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Global Search */}
        <div className="relative w-56 lg:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2 text-slate-400" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Right: Actions, Language Switcher, Role, Profile */}
      <div className="flex items-center gap-2 shrink-0">
        {/* AI Assistant Quick Trigger */}
        <button
          onClick={() => setIsAiModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all whitespace-nowrap shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span>{t('aiAssistant')}</span>
        </button>

        {/* Active AI Model Pill (Direct /model quick switcher trigger) */}
        <button
          onClick={() => setIsModelSwitcherOpen(true)}
          title={t('headerActiveModelTitle').replace('{model}', aiConfig?.model || 'gemini-3.8-flash-medium')}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-purple-500/40 bg-purple-950/40 hover:bg-purple-900/60 text-purple-200 text-xs font-medium transition-all shadow-sm group whitespace-nowrap shrink-0"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="font-semibold text-white truncate max-w-[120px] lg:max-w-[150px]">
            {formatModelDisplayName(aiConfig?.model || 'gemini-3.8-flash-medium')}
          </span>
          <span className="text-[10px] text-purple-300 font-mono bg-purple-900/60 px-1.5 py-0.5 rounded border border-purple-500/30 uppercase shrink-0">
            {aiConfig?.effortLevel || 'medium'}
          </span>
          <span className="text-[10px] text-purple-400/90 font-mono hidden xl:inline opacity-75 group-hover:opacity-100">
            /model
          </span>
        </button>

        {/* Live Backend API Connection Status & Manual Sync */}
        <button
          onClick={() => syncWithBackend()}
          title={t('headerSyncBackendTitle')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
            backendConnected
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/40'
              : 'bg-amber-950/40 border-amber-500/30 text-amber-300 hover:bg-amber-900/40'
          }`}
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${backendConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          <span className="font-mono text-[11px] hidden xl:inline">
            {backendConnected ? 'API 5001' : 'Offline'}
          </span>
          <RotateCcw className={`w-3.5 h-3.5 text-slate-400 shrink-0 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
        </button>

        {/* Language Switcher (EN / VI) */}
        <div className="relative shrink-0">
          <button
            onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="uppercase">{language}</span>
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>

          {isLangDropdownOpen && (
            <div className="absolute right-0 mt-2 w-36 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl p-1 z-50">
              <button
                onClick={() => {
                  setLanguage('vi');
                  setIsLangDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between ${
                  language === 'vi' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span>🇻🇳 {t('vietnamese')}</span>
                {language === 'vi' && <span className="text-[10px] font-mono">✓</span>}
              </button>
              <button
                onClick={() => {
                  setLanguage('en');
                  setIsLangDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between ${
                  language === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span>🇬🇧 English</span>
                {language === 'en' && <span className="text-[10px] font-mono">✓</span>}
              </button>
            </div>
          )}
        </div>

        {/* Clarification Notifications */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            {openQuestions.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-slate-950 font-bold text-[10px] rounded-full flex items-center justify-center">
                {openQuestions.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl p-3 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-slate-700 text-xs font-semibold text-slate-200">
                <span>{t('clarificationQuestions')}</span>
                <span className="text-[10px] text-amber-400 font-mono">{openQuestions.length} {t('openQuestions')}</span>
              </div>
              <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                {openQuestions.map(q => (
                  <div key={q.id} className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-750 text-xs">
                    <div className="font-medium text-slate-200">{q.question}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{q.context}</div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{q.sourceDoc}</span>
                      <span>By {q.askedBy}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Role & Authenticated User */}
        <div className="relative shrink-0 flex items-center gap-2">
          {authUser ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => authUser.role === 'Project Admin' && setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700 text-xs font-semibold transition-all whitespace-nowrap ${
                    authUser.role === 'Project Admin' ? 'hover:bg-slate-800 cursor-pointer' : 'cursor-default'
                  }`}
                  title={authUser.role === 'Project Admin' ? t('switchRole') : undefined}
                >
                  <UserCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <Badge variant={getRoleBadgeVariant(currentRole)} size="xs">
                    {currentRole}
                  </Badge>
                  {authUser.role === 'Project Admin' && <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />}
                </button>

                {isRoleDropdownOpen && authUser.role === 'Project Admin' && (
                  <div className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl p-1.5 z-50">
                    <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      {t('switchRole')} (Admin)
                    </div>
                    {roles.map((r) => (
                      <button
                        key={r}
                        onClick={async () => {
                          setIsRoleDropdownOpen(false);
                          await switchRole(r);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                          currentRole === r
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-300 hover:bg-slate-750 hover:text-white'
                        }`}
                      >
                        <span>{r}</span>
                        {currentRole === r && <span className="text-[10px] uppercase font-mono">Active</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* User Avatar & Logout */}
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-white leading-tight">{currentUser}</div>
                  <div className="text-[10px] text-slate-400 leading-tight">@{authUser.username || 'user'}</div>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/30 transition-all"
                  title={t('headerLogout')}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">{t('headerLogout')}</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md"
            >
              <LogIn className="w-4 h-4" />
              <span>{t('headerLogin')}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
