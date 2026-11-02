import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TestRunItem, TestResultStatus, BugItem } from '../../types';
import {
  X,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Clock,
  Bug,
  FileCheck2,
  Plus,
  Play
} from 'lucide-react';

interface TestRunExecutionModalProps {
  run: TestRunItem;
  onClose: () => void;
}

export const TestRunExecutionModal: React.FC<TestRunExecutionModalProps> = ({ run, onClose }) => {
  const { recordTestResult, evidences, testCases, addBug, bugs } = useApp();

  const [selectedCaseId, setSelectedCaseId] = useState<string>(
    run.records[0]?.testCaseId || ''
  );
  const [actualResult, setActualResult] = useState('');
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [showLogBugForm, setShowLogBugForm] = useState(false);

  // Bug logging form state
  const [bugTitle, setBugTitle] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [bugSeverity, setBugSeverity] = useState<'Critical' | 'Major' | 'Minor'>('Major');

  const currentRecord = run.records.find(r => r.testCaseId === selectedCaseId);
  const currentCase = testCases.find(t => t.id === selectedCaseId);

  const handleSetStatus = (status: TestResultStatus) => {
    if (!selectedCaseId) return;

    recordTestResult(
      run.id,
      selectedCaseId,
      status,
      actualResult || `Executed as ${status}`,
      selectedEvidenceIds
    );

    if (status === 'Fail') {
      // Pre-fill bug form
      setBugTitle(`[${run.buildVersion}] Failed: ${currentCase?.title || selectedCaseId}`);
      setBugDescription(`Execution in Test Run ${run.id} (${run.environment}) failed.\n\nActual Result: ${actualResult || 'Assertion mismatch observed.'}`);
      setShowLogBugForm(true);
    }
  };

  const handleSaveBug = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugTitle.trim()) return;

    const newBug: BugItem = {
      id: `BUG-00${bugs.length + 1}`,
      title: bugTitle,
      description: bugDescription,
      severity: bugSeverity,
      priority: bugSeverity === 'Critical' ? 'Critical' : 'High',
      status: 'Open',
      assignee: 'Tech Lead / DEV',
      environment: run.environment,
      buildVersion: run.buildVersion,
      stepsToReproduce: currentCase ? currentCase.steps.map(s => s.action) : ['Re-run test scenario'],
      expectedResult: currentCase ? currentCase.steps.map(s => s.expectedResult).join('; ') : 'Expected step assertions to pass',
      actualResult: actualResult || 'Observed failure during run',
      linkedTestCaseId: selectedCaseId,
      linkedTestRunId: run.id,
      linkedRequirementId: currentCase?.requirementId,
      linkedEvidenceIds: selectedEvidenceIds,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
    };

    addBug(newBug);
    setShowLogBugForm(false);
    alert(`Bug ${newBug.id} filed successfully and linked to Traceability!`);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-slate-900 border border-slate-750 shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-purple-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                {run.id}
              </span>
              <h3 className="font-bold text-white text-base">{run.title}</h3>
              <span className="text-xs text-slate-400 font-mono">[{run.environment} • {run.buildVersion}]</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{run.scope}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content: Left test case list / Right execution controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 overflow-hidden">
          
          {/* Test Cases List (4 Cols) */}
          <div className="md:col-span-4 bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2 overflow-y-auto max-h-[65vh]">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
              Test Cases ({run.records.length})
            </div>
            {run.records.map((rec) => {
              const isSelected = rec.testCaseId === selectedCaseId;
              return (
                <button
                  key={rec.testCaseId}
                  onClick={() => {
                    setSelectedCaseId(rec.testCaseId);
                    setActualResult(rec.actualResult || '');
                    setSelectedEvidenceIds(rec.evidenceIds || []);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl text-xs transition-all ${
                    isSelected
                      ? 'bg-indigo-600/20 text-white border border-indigo-500/40'
                      : 'text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-cyan-400 font-bold">{rec.testCaseId}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      rec.status === 'Pass' ? 'bg-emerald-500/20 text-emerald-300' :
                      rec.status === 'Fail' ? 'bg-rose-500/20 text-rose-300' :
                      rec.status === 'Blocked' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {rec.status}
                    </span>
                  </div>
                  <div className="line-clamp-1 font-medium">{rec.testCaseTitle}</div>
                </button>
              );
            })}
          </div>

          {/* Execution & Assertion Panel (8 Cols) */}
          <div className="md:col-span-8 bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-4 overflow-y-auto max-h-[65vh] text-xs">
            {currentCase ? (
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-indigo-400 font-bold">{currentCase.id}</span>
                    <span className="text-[11px] text-slate-400">Ref: {currentCase.requirementId}</span>
                  </div>
                  <h4 className="font-bold text-white text-sm">{currentCase.title}</h4>
                  <p className="text-slate-300">{currentCase.scenario}</p>
                </div>

                {/* Steps with Expected Results */}
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="font-semibold text-slate-300">Expected Execution Procedure:</div>
                  <div className="space-y-2">
                    {currentCase.steps.map(s => (
                      <div key={s.stepNumber} className="p-2 rounded bg-slate-950 border border-slate-850 text-xs">
                        <div><strong className="text-indigo-400">Step {s.stepNumber}:</strong> {s.action}</div>
                        <div className="text-emerald-400 mt-0.5"><strong>Expected:</strong> {s.expectedResult}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actual Result Input */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Actual Observation / Result Notes:
                  </label>
                  <textarea
                    rows={2}
                    value={actualResult}
                    onChange={(e) => setActualResult(e.target.value)}
                    placeholder="Enter what actually occurred during test execution..."
                    className="w-full bg-slate-900 border border-slate-750 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Attach Evidence */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Attach EVD Proof (Screenshots, Logs, Responses):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {evidences.map(evd => {
                      const isAttached = selectedEvidenceIds.includes(evd.id);
                      return (
                        <div
                          key={evd.id}
                          onClick={() => {
                            if (isAttached) {
                              setSelectedEvidenceIds(selectedEvidenceIds.filter(id => id !== evd.id));
                            } else {
                              setSelectedEvidenceIds([...selectedEvidenceIds, evd.id]);
                            }
                          }}
                          className={`p-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-colors ${
                            isAttached
                              ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="truncate">
                            <span className="font-mono font-bold">{evd.id}:</span> {evd.title}
                          </div>
                          <FileCheck2 className={`w-3.5 h-3.5 shrink-0 ${isAttached ? 'text-indigo-400' : 'text-slate-600'}`} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Execution Buttons: Pass / Fail / Blocked */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="font-semibold text-slate-300">Record Execution State:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSetStatus('Pass')}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 shadow"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Pass</span>
                    </button>
                    <button
                      onClick={() => handleSetStatus('Fail')}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center gap-1.5 shadow"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Fail & Log Bug</span>
                    </button>
                    <button
                      onClick={() => handleSetStatus('Blocked')}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold flex items-center gap-1.5 shadow"
                    >
                      <AlertOctagon className="w-4 h-4" />
                      <span>Blocked</span>
                    </button>
                  </div>
                </div>

                {/* Bug Logging Drawer on Failure */}
                {showLogBugForm && (
                  <form onSubmit={handleSaveBug} className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 space-y-3">
                    <div className="flex items-center justify-between text-rose-300 font-semibold">
                      <div className="flex items-center gap-2">
                        <Bug className="w-4 h-4 text-rose-400" />
                        <span>Defect Detected: Pre-populate Bug Report</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowLogBugForm(false)}
                        className="text-xs text-rose-400 hover:text-white"
                      >
                        Dismiss
                      </button>
                    </div>

                    <div>
                      <label className="block text-slate-300 text-[11px] mb-1">Bug Summary</label>
                      <input
                        type="text"
                        required
                        value={bugTitle}
                        onChange={(e) => setBugTitle(e.target.value)}
                        className="w-full bg-slate-900 border border-rose-500/40 rounded-lg p-2 text-white text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 text-[11px] mb-1">Severity</label>
                        <select
                          value={bugSeverity}
                          onChange={(e) => setBugSeverity(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-750 rounded-lg p-2 text-white text-xs"
                        >
                          <option value="Critical">Critical</option>
                          <option value="Major">Major</option>
                          <option value="Minor">Minor</option>
                        </select>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center">
                        Links will be automatically created to Test Run {run.id} and Requirement {currentCase?.requirementId}.
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow"
                      >
                        File Bug into Tracking
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <div className="text-slate-400">Select a test case to execute.</div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-800 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
          >
            Close Console
          </button>
        </div>
      </div>
    </div>
  );
};
