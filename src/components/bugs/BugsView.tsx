import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BugItem, BugStatus, BugSeverity } from '../../types';
import {
  Bug,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Link2,
  FileCheck2,
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react';
import { BugModal } from './BugModal';

export const BugsView: React.FC = () => {
  const { bugs, updateBugStatus } = useApp();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBug, setSelectedBug] = useState<BugItem | null>(null);

  const filteredBugs = bugs.filter(b => {
    if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
    if (severityFilter !== 'ALL' && b.severity !== severityFilter) return false;
    return true;
  });

  const getSeverityBadge = (sev: BugSeverity) => {
    switch (sev) {
      case 'Critical':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">CRITICAL</span>;
      case 'Major':
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">MAJOR</span>;
      default:
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-700 text-slate-300">MINOR</span>;
    }
  };

  const getStatusBadge = (status: BugStatus) => {
    switch (status) {
      case 'Open':
        return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">Open</span>;
      case 'In Progress':
        return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">In Progress</span>;
      case 'Resolved':
        return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Resolved</span>;
      case 'Closed':
        return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-700 text-slate-400">Closed</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Defect & Bug Management</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Traceable defects linked to Requirements, Test Runs, and EVD attachments.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedBug(null);
            setIsModalOpen(true);
          }}
          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Report New Defect</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Status:</span>
            {['ALL', 'Open', 'In Progress', 'Resolved', 'Closed'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
            <span className="text-slate-400 font-medium">Severity:</span>
            {['ALL', 'Critical', 'Major', 'Minor'].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  severityFilter === sev
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <div className="text-slate-400 text-xs">
          Total: <strong className="text-white">{filteredBugs.length}</strong> defect(s)
        </div>
      </div>

      {/* Bugs Grid / List */}
      <div className="space-y-4">
        {filteredBugs.map((bug) => (
          <div
            key={bug.id}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-750 transition-all shadow-sm space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-rose-400 border border-slate-700">
                    {bug.id}
                  </span>
                  <h3
                    onClick={() => {
                      setSelectedBug(bug);
                      setIsModalOpen(true);
                    }}
                    className="font-bold text-white text-base hover:text-rose-400 cursor-pointer transition-colors"
                  >
                    {bug.title}
                  </h3>
                  {getSeverityBadge(bug.severity)}
                  <span className="font-mono text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-750">
                    {bug.environment} • {bug.buildVersion}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{bug.description}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {getStatusBadge(bug.status)}
              </div>
            </div>

            {/* Traceability Lineage Chips */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-wrap items-center justify-between text-xs gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {bug.linkedRequirementId && (
                  <span className="flex items-center gap-1 text-cyan-300 font-mono">
                    <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Req: {bug.linkedRequirementId}</span>
                  </span>
                )}
                {bug.linkedTestCaseId && (
                  <span className="flex items-center gap-1 text-emerald-300 font-mono">
                    <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Test: {bug.linkedTestCaseId}</span>
                  </span>
                )}
                {bug.linkedTestRunId && (
                  <span className="flex items-center gap-1 text-purple-300 font-mono">
                    <Link2 className="w-3.5 h-3.5 text-purple-400" />
                    <span>Run: {bug.linkedTestRunId}</span>
                  </span>
                )}
                {bug.linkedEvidenceIds.length > 0 && (
                  <span className="flex items-center gap-1 text-amber-300 font-mono">
                    <FileCheck2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>{bug.linkedEvidenceIds.length} EVD Proof(s)</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[11px]">Assignee: <strong className="text-slate-200">{bug.assignee}</strong></span>
              </div>
            </div>

            {/* Status Workflow Action */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">Reported: {bug.createdAt}</span>

              <div className="flex items-center gap-2">
                {bug.status === 'Open' && (
                  <button
                    onClick={() => updateBugStatus(bug.id, 'In Progress')}
                    className="px-2.5 py-1 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-medium transition-colors"
                  >
                    Start Investigation
                  </button>
                )}

                {bug.status === 'In Progress' && (
                  <button
                    onClick={() => updateBugStatus(bug.id, 'Resolved')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                  >
                    Mark Resolved
                  </button>
                )}

                {bug.status === 'Resolved' && (
                  <button
                    onClick={() => updateBugStatus(bug.id, 'Closed')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                  >
                    Close Defect
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <BugModal
          bug={selectedBug}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
};
