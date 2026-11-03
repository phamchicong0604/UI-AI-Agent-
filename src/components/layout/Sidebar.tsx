import React from 'react';
import { useApp, NavigationTab } from '../../context/AppContext';
import { useI18n } from '../../common/i18n/I18nContext';
import {
  LayoutDashboard,
  FolderGit2,
  FileText,
  FileCheck2,
  TestTube2,
  PlaySquare,
  Bug,
  GitFork,
  Settings,
  Sparkles,
  ShieldCheck,
  Zap
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, setIsAiModalOpen, setIsImpactModalOpen, requirements, testCases, bugs } = useApp();
  const { t } = useI18n();

  const navItems: { id: NavigationTab; labelKey: any; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', labelKey: 'navDashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'documents', labelKey: 'navDocuments', icon: <FolderGit2 className="w-4 h-4" /> },
    { id: 'requirements', labelKey: 'navRequirements', icon: <FileText className="w-4 h-4" />, badge: requirements.filter(r => r.status === 'In Review').length },
    { id: 'evidence', labelKey: 'navEvidence', icon: <FileCheck2 className="w-4 h-4" /> },
    { id: 'testcases', labelKey: 'navTestCases', icon: <TestTube2 className="w-4 h-4" />, badge: testCases.filter(t => t.status === 'In Review').length },
    { id: 'testruns', labelKey: 'navTestRuns', icon: <PlaySquare className="w-4 h-4" /> },
    { id: 'bugs', labelKey: 'navBugs', icon: <Bug className="w-4 h-4" />, badge: bugs.filter(b => b.status === 'Open').length },
    { id: 'traceability', labelKey: 'navTraceability', icon: <GitFork className="w-4 h-4" /> },
    { id: 'settings', labelKey: 'navSettings', icon: <Settings className="w-4 h-4" /> }
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Brand Logo */}
        <div className="h-16 flex items-center px-5 border-b border-slate-800 gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white tracking-tight text-base">{t('brandName')}</span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                AI-Ready
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">{t('brandSubtitle')}</p>
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="p-3 space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {t('workspaces')}
          </div>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-indigo-400' : 'text-slate-400'}>
                    {item.icon}
                  </span>
                  <span>{t(item.labelKey)}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* AI Readiness Tools Card */}
      <div className="p-3 border-t border-slate-800 space-y-2">
        <div className="p-3 rounded-2xl bg-gradient-to-b from-indigo-950/60 to-slate-900 border border-indigo-500/30">
          <div className="flex items-center justify-between gap-1 mb-2">
            <div className="flex items-center gap-1.5 text-indigo-300 text-xs font-semibold truncate">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate">{t('aiCopilotEngine')}</span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap shrink-0">
              {t('groundedOutput')}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed mb-2.5 line-clamp-2">
            {t('aiCardDescription')}
          </p>
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => setIsAiModalOpen(true)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>{t('draftTc')}</span>
            </button>
            <button
              onClick={() => setIsImpactModalOpen(true)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{t('impactAnalysis')}</span>
            </button>
          </div>
        </div>

        {/* Project Baseline Info */}
        <div className="px-2 py-1 text-[11px] text-slate-400 flex items-center justify-between font-mono whitespace-nowrap">
          <span>Schema v0.1</span>
          <span className="text-emerald-400">● {t('synced')}</span>
        </div>
      </div>
    </aside>
  );
};
