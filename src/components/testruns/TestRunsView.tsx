import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TestRunItem, TestResultStatus, Environment } from '../../types';
import {
  PlaySquare,
  Plus,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Clock,
  Bug,
  FileCheck2,
  Server,
  Play
} from 'lucide-react';
import { TestRunExecutionModal } from './TestRunExecutionModal';

export const TestRunsView: React.FC = () => {
  const { testRuns, createTestRun, testCases, currentUser, canExecuteTest } = useApp();
  const [activeRun, setActiveRun] = useState<TestRunItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New run form state
  const [title, setTitle] = useState('');
  const [environment, setEnvironment] = useState<Environment>('QA');
  const [buildVersion, setBuildVersion] = useState('build-1048');
  const [scope, setScope] = useState('Regression test cycle for release candidate');

  const handleCreateRun = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Default: populate with all approved or ready test cases
    const eligibleCases = testCases.filter(tc => tc.status === 'Ready for Execution' || tc.status === 'Approved');

    const newRun: TestRunItem = {
      id: `RUN-${new Date().toISOString().slice(0, 10)}-${testRuns.length + 1}`,
      title,
      environment,
      buildVersion,
      scope,
      status: 'In Progress',
      createdBy: currentUser,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      records: eligibleCases.map(tc => ({
        testCaseId: tc.id,
        testCaseTitle: tc.title,
        status: 'Not Run',
        actualResult: '',
        evidenceIds: []
      }))
    };

    createTestRun(newRun);
    setIsCreateModalOpen(false);
    setTitle('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Test Runs & Execution Console</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Execute test cycles per Build/Environment, attach evidence, and log defects upon failure.
          </p>
        </div>

        {canExecuteTest() && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Test Run</span>
          </button>
        )}
      </div>

      {/* Test Runs List */}
      <div className="space-y-4">
        {testRuns.map((run) => {
          const total = run.records.length;
          const pass = run.records.filter(r => r.status === 'Pass').length;
          const fail = run.records.filter(r => r.status === 'Fail').length;
          const blocked = run.records.filter(r => r.status === 'Blocked').length;
          const notRun = run.records.filter(r => r.status === 'Not Run').length;

          const passPercent = total > 0 ? Math.round((pass / total) * 100) : 0;
          const failPercent = total > 0 ? Math.round((fail / total) * 100) : 0;
          const blockedPercent = total > 0 ? Math.round((blocked / total) * 100) : 0;

          return (
            <div
              key={run.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-750 transition-all shadow-sm space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-purple-400 border border-slate-700">
                      {run.id}
                    </span>
                    <h3 className="font-bold text-white text-base">{run.title}</h3>
                    <span className="font-mono text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-750">
                      {run.environment} • {run.buildVersion}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      run.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {run.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{run.scope}</p>
                </div>

                <button
                  onClick={() => setActiveRun(run)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow transition-all shrink-0"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute Console</span>
                </button>
              </div>

              {/* Progress Visual Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 font-medium">✓ {pass} Passed ({passPercent}%)</span>
                    <span className="text-rose-400 font-medium">✗ {fail} Failed ({failPercent}%)</span>
                    <span className="text-amber-400 font-medium">⊘ {blocked} Blocked ({blockedPercent}%)</span>
                    <span className="text-slate-500">{notRun} Pending</span>
                  </div>
                  <span>Total: {total} Cases</span>
                </div>

                <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                  <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${passPercent}%` }} />
                  <div className="h-full bg-rose-500 transition-all duration-300" style={{ width: `${failPercent}%` }} />
                  <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${blockedPercent}%` }} />
                </div>
              </div>

              {/* Footer info */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Created: {run.createdAt} by {run.createdBy}</span>
                <span className="text-indigo-400 font-medium">Click "Execute Console" to run test cases</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* New Test Run Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-750 shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-white text-base">Initialize New Test Run</h3>
            <form onSubmit={handleCreateRun} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Run Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sprint 25 Regression - Payment Gateway"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Target Environment</label>
                  <select
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value as Environment)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="DEV">DEV</option>
                    <option value="QA">QA</option>
                    <option value="STG">STG</option>
                    <option value="PROD">PROD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Build / Release Version</label>
                  <input
                    type="text"
                    required
                    value={buildVersion}
                    onChange={(e) => setBuildVersion(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Test Scope</label>
                <textarea
                  rows={2}
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  Start Run
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Execution Modal */}
      {activeRun && (
        <TestRunExecutionModal
          run={activeRun}
          onClose={() => setActiveRun(null)}
        />
      )}
    </div>
  );
};
