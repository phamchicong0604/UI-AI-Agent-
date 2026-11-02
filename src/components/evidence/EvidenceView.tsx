import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { EvidenceItem, EvidenceType, Environment, EvidenceStatus } from '../../types';
import {
  FileCheck2,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Image as ImageIcon,
  FileCode2,
  Video,
  FileCheck,
  Link2,
  Eye,
  ExternalLink,
  ShieldCheck,
  Server
} from 'lucide-react';
import { EvidenceModal } from './EvidenceModal';

export const EvidenceView: React.FC = () => {
  const { evidences, verifyEvidence, canApprove } = useApp();
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedEnv, setSelectedEnv] = useState<string>('ALL');
  const [previewEvd, setPreviewEvd] = useState<EvidenceItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredEvidences = evidences.filter(e => {
    if (selectedType !== 'ALL' && e.type !== selectedType) return false;
    if (selectedEnv !== 'ALL' && e.environment !== selectedEnv) return false;
    return true;
  });

  const getTypeIcon = (type: EvidenceType) => {
    switch (type) {
      case 'Screenshot':
        return <ImageIcon className="w-4 h-4 text-cyan-400" />;
      case 'Log':
      case 'API Response':
        return <FileCode2 className="w-4 h-4 text-emerald-400" />;
      case 'Video':
        return <Video className="w-4 h-4 text-purple-400" />;
      case 'Approval Record':
        return <FileCheck className="w-4 h-4 text-amber-400" />;
      default:
        return <FileCheck2 className="w-4 h-4 text-indigo-400" />;
    }
  };

  const getStatusBadge = (status: EvidenceStatus) => {
    switch (status) {
      case 'Verified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            Verified
          </span>
        );
      case 'Submitted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            Submitted
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
          <h2 className="text-xl font-bold text-white tracking-tight">EVD / Evidence Library</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable proof management linking across Requirements, Test Runs, Bugs, and Compliance records.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Upload / Register Evidence</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Type:</span>
            {['ALL', 'Screenshot', 'Log', 'API Response', 'Approval Record'].map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  selectedType === t
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
            <span className="text-slate-400 font-medium">Environment:</span>
            {['ALL', 'DEV', 'QA', 'STG', 'PROD'].map((e) => (
              <button
                key={e}
                onClick={() => setSelectedEnv(e)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  selectedEnv === e
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="text-slate-400 text-xs">
          Showing <span className="text-white font-semibold">{filteredEvidences.length}</span> evidence items
        </div>
      </div>

      {/* Grid of Evidence Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEvidences.map((evd) => (
          <div
            key={evd.id}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-750 transition-all flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-slate-800 border border-slate-700">
                    {getTypeIcon(evd.type)}
                  </span>
                  <div>
                    <span className="font-mono text-xs font-bold text-cyan-400">{evd.id}</span>
                    <span className="text-[11px] text-slate-400 ml-2 font-mono">[{evd.type}]</span>
                  </div>
                </div>
                {getStatusBadge(evd.status)}
              </div>

              <h3 
                onClick={() => setPreviewEvd(evd)}
                className="font-bold text-white text-sm hover:text-indigo-400 cursor-pointer transition-colors"
              >
                {evd.title}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">{evd.description}</p>
            </div>

            {/* Storage Ref & Env Info */}
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-850 space-y-1 text-xs">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-slate-400 flex items-center gap-1">
                  <Server className="w-3 h-3 text-indigo-400" />
                  {evd.environment} • {evd.buildVersion}
                </span>
                <span className="text-slate-500">{evd.fileSize}</span>
              </div>
              <div className="font-mono text-[10px] text-slate-400 truncate">
                {evd.storageRef}
              </div>
              <div className="font-mono text-[10px] text-emerald-400 truncate pt-0.5 border-t border-slate-850">
                Checksum: {evd.storageChecksum}
              </div>
            </div>

            {/* Multi-Entity Links */}
            <div className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Trace Links ({evd.links.length})
              </div>
              <div className="space-y-1">
                {evd.links.map((link, idx) => (
                  <div key={idx} className="p-1.5 rounded-md bg-slate-950 border border-slate-800/80 text-[11px] flex items-center justify-between">
                    <span className="font-mono font-semibold text-indigo-300">{link.targetId}</span>
                    <span className="text-slate-400 truncate max-w-[150px]">{link.purpose}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">By {evd.createdBy}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewEvd(evd)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Inspect</span>
                </button>

                {canApprove() && evd.status !== 'Verified' && (
                  <button
                    onClick={() => verifyEvidence(evd.id)}
                    className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                  >
                    Verify
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Evidence Inspector / Preview Drawer Modal */}
      {previewEvd && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                {getTypeIcon(previewEvd.type)}
                <h3 className="font-bold text-white text-base">
                  {previewEvd.id}: {previewEvd.title}
                </h3>
              </div>
              <button
                onClick={() => setPreviewEvd(null)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono">
                <div>Environment: <strong className="text-indigo-300">{previewEvd.environment}</strong></div>
                <div>Build: <strong className="text-indigo-300">{previewEvd.buildVersion}</strong></div>
                <div>Storage: <span className="text-slate-400 truncate">{previewEvd.storageRef}</span></div>
                <div>Checksum: <span className="text-emerald-400 truncate">{previewEvd.storageChecksum}</span></div>
              </div>

              {previewEvd.previewUrl && (
                <div>
                  <div className="font-semibold text-slate-300 mb-1.5">Captured Screenshot / Visual Artifact:</div>
                  <img
                    src={previewEvd.previewUrl}
                    alt={previewEvd.title}
                    className="w-full h-64 object-cover rounded-xl border border-slate-750"
                  />
                </div>
              )}

              {previewEvd.logPayload && (
                <div>
                  <div className="font-semibold text-slate-300 mb-1.5">Execution Log / Raw API Payload:</div>
                  <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                    {previewEvd.logPayload}
                  </pre>
                </div>
              )}

              {/* Linked Objects Table */}
              <div>
                <div className="font-semibold text-slate-300 mb-1.5">Bidirectional Trace Links:</div>
                <div className="space-y-1.5">
                  {previewEvd.links.map((link, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-slate-950 border border-slate-850 flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-indigo-400 font-bold">{link.targetType}:</span>
                        <span className="text-white font-semibold">{link.targetId}</span>
                        <span className="text-slate-400">({link.targetTitle})</span>
                      </div>
                      <span className="text-slate-400 text-xs italic">{link.purpose}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <div className="text-xs text-slate-400">
                {previewEvd.verifiedBy ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4" />
                    Verified by {previewEvd.verifiedBy} ({previewEvd.verifiedAt})
                  </span>
                ) : (
                  <span className="text-amber-400">Pending Verification</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {canApprove() && previewEvd.status !== 'Verified' && (
                  <button
                    onClick={() => {
                      verifyEvidence(previewEvd.id);
                      setPreviewEvd(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow"
                  >
                    Verify & Certify Evidence
                  </button>
                )}
                <button
                  onClick={() => setPreviewEvd(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isModalOpen && (
        <EvidenceModal onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
};
