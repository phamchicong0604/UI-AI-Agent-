import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TestCaseItem, TestCaseType, PriorityLevel, TestStep } from '../../types';
import { X, TestTube2, Plus, Trash2, CheckCircle2 } from 'lucide-react';

interface TestCaseModalProps {
  onClose: () => void;
}

export const TestCaseModal: React.FC<TestCaseModalProps> = ({ onClose }) => {
  const { addTestCase, requirements, testCases, documents } = useApp();

  const [title, setTitle] = useState('');
  const [selectedReqId, setSelectedReqId] = useState(requirements[0]?.id || '');
  const [scenario, setScenario] = useState('');
  const [preconditions, setPreconditions] = useState('User is logged in.');
  const [testData, setTestData] = useState('');
  const [type, setType] = useState<TestCaseType>('Positive');
  const [priority, setPriority] = useState<PriorityLevel>('High');
  const [steps, setSteps] = useState<TestStep[]>([
    { stepNumber: 1, action: 'Open target screen', expectedResult: 'Screen loads properly with no errors' }
  ]);

  const handleAddStep = () => {
    setSteps(prev => [
      ...prev,
      { stepNumber: prev.length + 1, action: '', expectedResult: '' }
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const matchedReq = requirements.find(r => r.id === selectedReqId);

    const newCase: TestCaseItem = {
      id: `TC-CUSTOM-00${testCases.length + 1}`,
      requirementId: selectedReqId,
      requirementTitle: matchedReq ? matchedReq.title : selectedReqId,
      title,
      scenario,
      preconditions,
      testData,
      type,
      priority,
      status: 'Draft',
      version: 'v1.0',
      sourceReferences: matchedReq ? matchedReq.sourceReferences : [],
      steps: steps.filter(s => s.action.trim().length > 0),
      reviewComments: [],
      relatedEvidenceIds: [],
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
    };

    addTestCase(newCase);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-750 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
              <TestTube2 className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-base">Create Test Case</h3>
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
            <label className="block text-slate-300 font-semibold mb-1">Test Case Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Verify OTP rate limit lock after 3 invalid tries"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Target Requirement *</label>
              <select
                value={selectedReqId}
                onChange={(e) => setSelectedReqId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                {requirements.map(r => (
                  <option key={r.id} value={r.id}>{r.id}: {r.title.slice(0, 30)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Test Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TestCaseType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Positive">Positive</option>
                <option value="Negative">Negative</option>
                <option value="Boundary">Boundary</option>
                <option value="Security">Security</option>
                <option value="Permission">Permission</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Test Objective / Scenario</label>
            <textarea
              rows={2}
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              placeholder="Explain the functional scenario being verified..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Preconditions</label>
              <input
                type="text"
                value={preconditions}
                onChange={(e) => setPreconditions(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Test Data</label>
              <input
                type="text"
                value={testData}
                onChange={(e) => setTestData(e.target.value)}
                placeholder="e.g. mobile: +84912345678, otp: 000000"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Test Steps */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-300 font-semibold">Step Sequence</label>
              <button
                type="button"
                onClick={handleAddStep}
                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold text-[11px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Step</span>
              </button>
            </div>

            <div className="space-y-2">
              {steps.map((s, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                  <span className="font-mono text-slate-400 font-bold">#{idx + 1}</span>
                  <input
                    type="text"
                    required
                    value={s.action}
                    onChange={(e) => {
                      const updated = [...steps];
                      updated[idx].action = e.target.value;
                      setSteps(updated);
                    }}
                    placeholder="Action..."
                    className="flex-1 bg-slate-900 border border-slate-750 rounded-lg px-2.5 py-1.5 text-white"
                  />
                  <input
                    type="text"
                    required
                    value={s.expectedResult}
                    onChange={(e) => {
                      const updated = [...steps];
                      updated[idx].expectedResult = e.target.value;
                      setSteps(updated);
                    }}
                    placeholder="Expected Result..."
                    className="flex-1 bg-slate-900 border border-slate-750 rounded-lg px-2.5 py-1.5 text-white"
                  />
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSteps(steps.filter((_, i) => i !== idx))}
                      className="p-1 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save as Draft</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
