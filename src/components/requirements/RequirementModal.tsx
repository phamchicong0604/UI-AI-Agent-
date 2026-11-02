import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { RequirementItem, RequirementType, PriorityLevel, StatusLifecycle } from '../../types';
import { X, FileText, Plus, Trash2, CheckCircle2 } from 'lucide-react';

interface RequirementModalProps {
  requirement: RequirementItem | null;
  onClose: () => void;
}

export const RequirementModal: React.FC<RequirementModalProps> = ({ requirement, onClose }) => {
  const { addRequirement, updateRequirement, requirements, documents, currentUser } = useApp();

  const [title, setTitle] = useState(requirement ? requirement.title : '');
  const [description, setDescription] = useState(requirement ? requirement.description : '');
  const [type, setType] = useState<RequirementType>(requirement ? requirement.type : 'Functional');
  const [priority, setPriority] = useState<PriorityLevel>(requirement ? requirement.priority : 'High');
  const [status, setStatus] = useState<StatusLifecycle>(requirement ? requirement.status : 'Draft');
  const [selectedDocId, setSelectedDocId] = useState<string>(
    requirement && requirement.sourceReferences.length > 0
      ? requirement.sourceReferences[0].documentId
      : documents[0]?.id || ''
  );
  const [sourceSection, setSourceSection] = useState(
    requirement && requirement.sourceReferences.length > 0
      ? requirement.sourceReferences[0].section
      : 'Section 3.1 - Business Workflow'
  );

  const [businessRules, setBusinessRules] = useState<string[]>(
    requirement ? requirement.businessRules : ['BR-01: Rule description']
  );

  const [acceptanceCriteria, setAcceptanceCriteria] = useState<{ id: string; text: string; completed: boolean }[]>(
    requirement ? requirement.acceptanceCriteria : [
      { id: 'AC-01', text: 'Condition 1 must pass successfully', completed: false }
    ]
  );

  const handleAddRule = () => {
    setBusinessRules(prev => [...prev, `BR-0${prev.length + 1}: New business condition`]);
  };

  const handleAddAC = () => {
    setAcceptanceCriteria(prev => [
      ...prev,
      { id: `AC-0${prev.length + 1}`, text: '', completed: false }
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const matchedDoc = documents.find(d => d.id === selectedDocId);

    const reqData: RequirementItem = {
      id: requirement ? requirement.id : `REQ-00${requirements.length + 1}`,
      title,
      description,
      type,
      priority,
      businessRules: businessRules.filter(r => r.trim().length > 0),
      acceptanceCriteria: acceptanceCriteria.filter(a => a.text.trim().length > 0),
      sourceReferences: matchedDoc ? [
        {
          documentId: matchedDoc.id,
          documentTitle: matchedDoc.title,
          version: matchedDoc.currentVersion,
          section: sourceSection
        }
      ] : [],
      status,
      owner: currentUser,
      approver: 'Minh Tran (PM)',
      createdAt: requirement ? requirement.createdAt : new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
    };

    if (requirement) {
      updateRequirement(reqData);
    } else {
      addRequirement(reqData);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-750 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
              <FileText className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-base">
              {requirement ? `Edit Requirement: ${requirement.id}` : 'Create Structured Requirement'}
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
            <label className="block text-slate-300 font-semibold mb-1">Requirement Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Multi-Factor OTP Verification Gate"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Requirement Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as RequirementType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Functional">Functional</option>
                <option value="Business">Business</option>
                <option value="Non-functional">Non-functional</option>
                <option value="Technical">Technical</option>
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

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Initial Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusLifecycle)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Draft">Draft</option>
                <option value="In Review">In Review</option>
                <option value="Approved">Approved</option>
              </select>
            </div>
          </div>

          {/* Grounded Document Linkage */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="font-semibold text-indigo-300 text-xs">Authoritative Document Source Citation</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Source Document</label>
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-750 rounded-lg px-2.5 py-1.5 text-white"
                >
                  {documents.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.id}: {d.title} ({d.currentVersion})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Section / Anchor</label>
                <input
                  type="text"
                  value={sourceSection}
                  onChange={(e) => setSourceSection(e.target.value)}
                  placeholder="e.g. Section 4.2 - Rate Limits"
                  className="w-full bg-slate-900 border border-slate-750 rounded-lg px-2.5 py-1.5 text-white"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Requirement Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe user goal, system behavior and expectations in detail..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Business Rules Editor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-300 font-semibold">Business Rules</label>
              <button
                type="button"
                onClick={handleAddRule}
                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold text-[11px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Rule</span>
              </button>
            </div>
            <div className="space-y-1.5">
              {businessRules.map((br, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={br}
                    onChange={(e) => {
                      const updated = [...businessRules];
                      updated[index] = e.target.value;
                      setBusinessRules(updated);
                    }}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono text-[11px]"
                  />
                  {businessRules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setBusinessRules(businessRules.filter((_, i) => i !== index))}
                      className="p-1.5 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Acceptance Criteria Editor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-300 font-semibold">Acceptance Criteria (AC Checklist)</label>
              <button
                type="button"
                onClick={handleAddAC}
                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold text-[11px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add AC</span>
              </button>
            </div>
            <div className="space-y-1.5">
              {acceptanceCriteria.map((ac, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="font-mono text-slate-400 font-bold">{ac.id}:</span>
                  <input
                    type="text"
                    required
                    value={ac.text}
                    onChange={(e) => {
                      const updated = [...acceptanceCriteria];
                      updated[index].text = e.target.value;
                      setAcceptanceCriteria(updated);
                    }}
                    placeholder="Describe clear verifiable condition..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
                  />
                  <input
                    type="checkbox"
                    checked={ac.completed}
                    onChange={(e) => {
                      const updated = [...acceptanceCriteria];
                      updated[index].completed = e.target.checked;
                      setAcceptanceCriteria(updated);
                    }}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                </div>
              ))}
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
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Requirement</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
