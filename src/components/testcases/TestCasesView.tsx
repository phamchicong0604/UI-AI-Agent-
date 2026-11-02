import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TestCaseItem, StatusLifecycle } from '../../types';
import {
  TestTube2,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  Link2,
  Download,
  LayoutGrid,
  ListFilter,
  Eye,
  ExternalLink
} from 'lucide-react';
import { TestCaseWorkspace } from './TestCaseWorkspace';
import { TestCaseModal } from './TestCaseModal';

export const TestCasesView: React.FC = () => {
  const {
    testCases,
    requirements,
    selectedTestCaseId,
    setSelectedTestCaseId,
    setIsAiModalOpen,
    updateTestCaseStatus,
    canApprove
  } = useApp();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // If a test case is selected for Workspace View, render the 3-column workspace!
  if (selectedTestCaseId) {
    return (
      <TestCaseWorkspace
        testCaseId={selectedTestCaseId}
        onBack={() => setSelectedTestCaseId(null)}
      />
    );
  }

  const filteredCases = testCases.filter(tc => {
    if (statusFilter !== 'ALL' && tc.status !== statusFilter) return false;
    if (priorityFilter !== 'ALL' && tc.priority !== priorityFilter) return false;
    if (typeFilter !== 'ALL' && tc.type !== typeFilter) return false;
    return true;
  });

  const getStatusBadge = (status: any) => {
    switch (status) {
      case 'Approved':
      case 'Ready for Execution':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            {status}
          </span>
        );
      case 'In Review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            In Review
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Test Case Authoring & Management</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Structured test procedures linked directly to Requirements & ACs with 3-column workspace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI Drafting</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Test Case</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Status:</span>
            {['ALL', 'Ready for Execution', 'Approved', 'In Review', 'Draft'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
            <span className="text-slate-400 font-medium">Type:</span>
            {['ALL', 'Positive', 'Security', 'Boundary'].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  typeFilter === t
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="text-slate-400 text-xs">
          Total: <strong className="text-white">{filteredCases.length}</strong> test cases
        </div>
      </div>

      {/* Test Cases Table / Cards */}
      <div className="space-y-3">
        {filteredCases.map((tc) => (
          <div
            key={tc.id}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700/80 transition-all shadow-sm space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                    {tc.id}
                  </span>
                  <h3
                    onClick={() => setSelectedTestCaseId(tc.id)}
                    className="font-bold text-white text-base hover:text-indigo-400 cursor-pointer transition-colors"
                  >
                    {tc.title}
                  </h3>
                  <span className="font-mono text-xs text-slate-400">v{tc.version}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {tc.type}
                  </span>
                  {tc.isAiDrafted && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-400" />
                      AI Drafted
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{tc.scenario}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {getStatusBadge(tc.status)}
              </div>
            </div>

            {/* Linkage and Steps summary */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1 text-cyan-300">
                  <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Mapped to: <strong>{tc.requirementId}</strong> ({tc.requirementTitle.slice(0, 35)}...)</span>
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-300"><strong>{tc.steps.length}</strong> Steps</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-400">Created: {tc.createdAt}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedTestCaseId(tc.id)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600/90 hover:bg-indigo-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Open 3-Column Workspace</span>
                </button>

                {canApprove() && tc.status !== 'Approved' && (
                  <button
                    onClick={() => updateTestCaseStatus(tc.id, 'Approved')}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-medium transition-colors"
                  >
                    Approve
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <TestCaseModal onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
};
