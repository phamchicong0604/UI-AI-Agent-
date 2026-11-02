import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { EvidenceItem, EvidenceType, Environment, EvidenceStatus } from '../../types';
import { X, Upload, CheckCircle2, Plus } from 'lucide-react';
import { syncSha256 } from '../../common/utils/hash';

interface EvidenceModalProps {
  onClose: () => void;
}

export const EvidenceModal: React.FC<EvidenceModalProps> = ({ onClose }) => {
  const { addEvidence, currentUser, evidences, requirements, testCases, bugs } = useApp();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<EvidenceType>('Screenshot');
  const [environment, setEnvironment] = useState<Environment>('QA');
  const [buildVersion, setBuildVersion] = useState('build-1045');
  const [logPayload, setLogPayload] = useState('');
  const [targetType, setTargetType] = useState<'Requirement' | 'TestCase' | 'Bug'>('TestCase');
  const [targetId, setTargetId] = useState(testCases[0]?.id || '');
  const [purpose, setPurpose] = useState('Proof of assertion validation');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let targetTitle = targetId;
    if (targetType === 'Requirement') {
      targetTitle = requirements.find(r => r.id === targetId)?.title || targetId;
    } else if (targetType === 'TestCase') {
      targetTitle = testCases.find(t => t.id === targetId)?.title || targetId;
    } else if (targetType === 'Bug') {
      targetTitle = bugs.find(b => b.id === targetId)?.title || targetId;
    }

    const newEvd: EvidenceItem = {
      id: `EVD-00${evidences.length + 1}`,
      title,
      description,
      type,
      environment,
      buildVersion,
      status: 'Submitted',
      storageRef: `s3://docqa-evidence/${environment.toLowerCase()}/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/${title.toLowerCase().replace(/\s+/g, '_').slice(0, 20)}.dat`,
      storageChecksum: `sha256:${syncSha256(`${title}|${environment}|${buildVersion}|${logPayload}|${Date.now()}`)}`,
      fileSize: '512 KB',
      previewUrl: type === 'Screenshot' ? 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80' : undefined,
      logPayload: logPayload.trim() ? logPayload : undefined,
      createdBy: currentUser,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      links: [
        {
          targetType,
          targetId,
          targetTitle,
          purpose
        }
      ]
    };

    addEvidence(newEvd);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-750 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Upload className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-base">Register Evidence (EVD)</h3>
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
            <label className="block text-slate-300 font-semibold mb-1">Evidence Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Screenshot of 200 OK Token Response"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Evidence Type *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as EvidenceType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Screenshot">Screenshot</option>
                <option value="Log">Log File</option>
                <option value="API Response">API Response</option>
                <option value="Video">Video Recording</option>
                <option value="Approval Record">Approval Record</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Environment *</label>
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
              <label className="block text-slate-300 font-semibold mb-1">Build / Version *</label>
              <input
                type="text"
                required
                value={buildVersion}
                onChange={(e) => setBuildVersion(e.target.value)}
                placeholder="build-1045"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Description of Proof</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="State exactly what this evidence proves and the condition observed..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Trace Target Link */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="font-semibold text-indigo-300 text-xs">Direct Traceability Link</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Target Entity Type</label>
                <select
                  value={targetType}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setTargetType(val);
                    if (val === 'Requirement') setTargetId(requirements[0]?.id || '');
                    if (val === 'TestCase') setTargetId(testCases[0]?.id || '');
                    if (val === 'Bug') setTargetId(bugs[0]?.id || '');
                  }}
                  className="w-full bg-slate-900 border border-slate-750 rounded-lg px-2.5 py-1.5 text-white"
                >
                  <option value="TestCase">Test Case</option>
                  <option value="Requirement">Requirement</option>
                  <option value="Bug">Defect / Bug</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Select Target</label>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-750 rounded-lg px-2.5 py-1.5 text-white"
                >
                  {targetType === 'Requirement' && requirements.map(r => (
                    <option key={r.id} value={r.id}>{r.id}: {r.title.slice(0, 30)}</option>
                  ))}
                  {targetType === 'TestCase' && testCases.map(t => (
                    <option key={t.id} value={t.id}>{t.id}: {t.title.slice(0, 30)}</option>
                  ))}
                  {targetType === 'Bug' && bugs.map(b => (
                    <option key={b.id} value={b.id}>{b.id}: {b.title.slice(0, 30)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Link Purpose</label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Validates AC-02 negative condition"
                className="w-full bg-slate-900 border border-slate-750 rounded-lg px-2.5 py-1.5 text-white"
              />
            </div>
          </div>

          {(type === 'Log' || type === 'API Response') && (
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Log / JSON Content</label>
              <textarea
                rows={4}
                value={logPayload}
                onChange={(e) => setLogPayload(e.target.value)}
                placeholder="Paste log snippet or JSON response..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-emerald-400 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

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
              <span>Save Evidence</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
