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
  Globe
} from 'lucide-react';
import { Badge } from '../../common/components/Badge';

export const Header: React.FC = () => {
  const {
    currentRole,
    setCurrentRole,
    currentUser,
    activeProject,
    setActiveProject,
    projects,
    questions,
    searchQuery,
    setSearchQuery,
    setIsAiModalOpen,
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

        {/* Live Backend API Connection Status & Manual Sync */}
        <button
          onClick={() => syncWithBackend()}
          title="Nhấp để đồng bộ lại với SQLite Backend API (port 5001)"
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
                <span>🇻🇳 Tiếng Việt</span>
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

        {/* Role Switcher (Single-line compact pill) */}
        <div className="relative shrink-0">
          <button
            onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-xs font-semibold transition-all whitespace-nowrap"
          >
            <UserCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <Badge variant={getRoleBadgeVariant(currentRole)} size="xs">
              {currentRole}
            </Badge>
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>

          {isRoleDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl p-1.5 z-50">
              <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {t('switchRole')}
              </div>
              {roles.map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setCurrentRole(r);
                    setIsRoleDropdownOpen(false);
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
              <div className="p-2 mt-1 border-t border-slate-700 text-[10px] text-slate-400">
                {t('switchRoleHelp')}
              </div>
            </div>
          )}
        </div>

        {/* Current User Avatar */}
        <div className="flex items-center pl-1 border-l border-slate-800 shrink-0">
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center justify-center font-bold text-xs">
            {currentUser.split(' ').map(n => n[0]).join('')}
          </div>
        </div>
      </div>
    </header>
  );
};
