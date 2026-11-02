import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BugItem, BugSeverity, BugStatus, PriorityLevel, Environment } from '../../types';
import { X, Bug, Plus, Trash2, CheckCircle2 } from 'lucide-react';

interface BugModalProps {
  bug: BugItem | null;
  onClose: () => void;
}

export const BugModal: React.FC<BugModalProps> = ({ bug, onClose }) => {
  const { addBug, bugs, requirements, testCases, testRuns, evidences } = useApp();

  const [title, setTitle] = useState(bug ? bug.title : '');
  const [description, setDescription] = useState(bug ? bug.description : '');
  const [severity, setSeverity] = useState<BugSeverity>(bug ? bug.severity : 'Major');
  const [priority, setPriority] = useState<PriorityLevel>(bug ? bug.priority : 'High');
  const [status, setStatus] = useState<BugStatus>(bug ? bug.status : 'Open');
  const [environment, setEnvironment] = useState<Environment>(bug ? bug.environment : 'QA');
  const [buildVersion, setBuildVersion] = useState(bug ? bug.buildVersion : 'build-1048');
  const [assignee, setAssignee] = useState(bug ? bug.assignee : 'Tech Lead / DEV');

  const [linkedReqId, setLinkedReqId] = useState(bug ? bug.linkedRequirementId || '' : requirements[0]?.id || '');
  const [linkedTestCaseId, setLinkedTestCaseId] = useState(bug ? bug.linkedTestCaseId || '' : testCases[0]?.id || '');
  const [linkedTestRunId, setLinkedTestRunId] = useState(bug ? bug.linkedTestRunId || '' : testRuns[0]?.id || '');
  
  const [expectedResult, setExpectedResult] = useState(bug ? bug.expectedResult : '');
  const [actualResult, setActualResult] = useState(bug ? bug.actualResult : '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newBug: BugItem = {
      id: bug ? bug.id : `BUG-00${bugs.length + 1}`,
      title,
      description,
      severity,
      priority,
      status,
      assignee,
      environment,
      buildVersion,
      stepsToReproduce: ['Navigate to feature', 'Perform action', 'Observe error'],
      expectedResult,
      actualResult,
      linkedRequirementId: linkedReqId || undefined,
      linkedTestCaseId: linkedTestCaseId || undefined,
      linkedTestRunId: linkedTestRunId || undefined,
      linkedEvidenceIds: bug ? bug.linkedEvidenceIds : [],
      createdAt: bug ? bug.createdAt : new Date().toISOString().replace('T', ' ').slice(0, 16),
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
    };

    addBug(newBug);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-750 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
              <Bug className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-base">
              {bug ? `Edit Defect: ${bug.id}` : 'Report Defect / Bug'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Defect Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Session expires prematurely during fund transfer"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as BugSeverity)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
              >
                <option value="Critical">Critical</option>
                <option value="Major">Major</option>
                <option value="Minor">Minor</option>
                <option value="Trivial">Trivial</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BugStatus)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Environment</label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as Environment)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
              >
                <option value="DEV">DEV</option>
                <option value="QA">QA</option>
                <option value="STG">STG</option>
                <option value="PROD">PROD</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Build / Version</label>
              <input
                type="text"
                value={buildVersion}
                onChange={(e) => setBuildVersion(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Assignee</label>
              <input
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Traceability Linkages */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="font-semibold text-rose-300 text-xs">Traceability References</div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Linked Req</label>
                <select
                  value={linkedReqId}
                  onChange={(e) => setLinkedReqId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-750 rounded-lg p-1.5 text-white text-[11px]"
                >
                  <option value="">None</option>
                  {requirements.map(r => (
                    <option key={r.id} value={r.id}>{r.id}: {r.title.slice(0, 20)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Linked Test Case</label>
                <select
                  value={linkedTestCaseId}
                  onChange={(e) => setLinkedTestCaseId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-750 rounded-lg p-1.5 text-white text-[11px]"
                >
                  <option value="">None</option>
                  {testCases.map(t => (
                    <option key={t.id} value={t.id}>{t.id}: {t.title.slice(0, 20)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Linked Test Run</label>
                <select
                  value={linkedTestRunId}
                  onChange={(e) => setLinkedTestRunId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-750 rounded-lg p-1.5 text-white text-[11px]"
                >
                  <option value="">None</option>
                  {testRuns.map(run => (
                    <option key={run.id} value={run.id}>{run.id}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Description / Summary</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="State the observed impact and conditions..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Expected Result</label>
              <textarea
                rows={2}
                value={expectedResult}
                onChange={(e) => setExpectedResult(e.target.value)}
                placeholder="What should have happened..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Actual Result</label>
              <textarea
                rows={2}
                value={actualResult}
                onChange={(e) => setActualResult(e.target.value)}
                placeholder="What actually occurred..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Defect</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
