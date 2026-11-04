import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  Info,
  X,
  MessageSquare,
  Sparkles,
  Lock,
  Check
} from 'lucide-react';
import { Button, Badge } from '../../common/components';
import { ConflictResolutionModal, ConflictData } from './ConflictResolutionModal';
import { useI18n } from '../../common/i18n/I18nContext';

export interface KnowledgeUnitItem {
  id: string;
  projectId: string;
  unitType: 'Requirement' | 'BusinessRule' | 'Constraint' | 'Definition';
  content: string;
  subject: string;
  action: string;
  condition?: string;
  evidenceLevel: 'Explicit' | 'Inferred' | 'Assumed' | 'Not Specified' | 'Conflict' | 'Unknown';
  status: 'Draft' | 'In Review' | 'Approved' | 'Rejected' | 'Superseded' | 'Deprecated';
  headingPath?: string;
  charOffsetStart?: number;
  charOffsetEnd?: number;
  exactQuote?: string;
}

interface KnowledgeReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  documentContent: string;
  units: KnowledgeUnitItem[];
  conflicts?: ConflictData[];
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  onUnitDecision: (unitId: string, decision: 'Approve' | 'Reject', reason?: string) => Promise<void>;
  onBulkApproveExplicit: () => Promise<void>;
  onConflictResolved?: (conflictId: string, resolution: string) => void;
}

export const KnowledgeReviewModal: React.FC<KnowledgeReviewModalProps> = ({
  isOpen,
  onClose,
  documentTitle,
  documentContent,
  units,
  conflicts = [],
  riskScore,
  riskLevel,
  onUnitDecision,
  onBulkApproveExplicit,
  onConflictResolved
}) => {
  const { t } = useI18n();
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(units[0]?.id || null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [rejectModalUnitId, setRejectModalUnitId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectError, setRejectError] = useState<string>('');
  const [activeConflict, setActiveConflict] = useState<ConflictData | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const highlightRef = useRef<HTMLElement | null>(null);

  // BUG-034: Hooks must be called unconditionally above any early return (Rules of Hooks)
  const selectedUnit = useMemo(() => {
    return units.find(u => u.id === selectedUnitId) || units[0] || null;
  }, [units, selectedUnitId]);

  const filteredUnits = useMemo(() => {
    if (filterType === 'ALL') return units;
    return units.filter(u => u.evidenceLevel === filterType);
  }, [units, filterType]);

  const explicitCount = units.filter(u => u.evidenceLevel === 'Explicit').length;
  const nonExplicitCount = units.length - explicitCount;
  const approvedCount = units.filter(u => u.status === 'Approved').length;

  // BUG-028: Auto-scroll to highlighted mark when active unit changes
  useEffect(() => {
    if (highlightRef.current && typeof highlightRef.current.scrollIntoView === 'function') {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedUnitId]);

  if (!isOpen) return null;

  const handleApprove = async (unitId: string) => {
    setIsProcessing(true);
    setModalError(null);
    try {
      await onUnitDecision(unitId, 'Approve');
    } catch (err: any) {
      setModalError(err.message || t('knowledgeModalApproveError'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectReason.trim() || rejectReason.trim().length < 5) {
      setRejectError(t('knowledgeModalRejectReasonMin'));
      return;
    }
    if (!rejectModalUnitId) return;

    setIsProcessing(true);
    try {
      await onUnitDecision(rejectModalUnitId, 'Reject', rejectReason.trim());
      setRejectModalUnitId(null);
      setRejectReason('');
      setRejectError('');
    } catch (err: any) {
      setRejectError(err.message || t('knowledgeModalRejectError'));
    } finally {
      setIsProcessing(false);
    }
  };

  const renderEvidenceBadge = (level: string) => {
    switch (level) {
      case 'Explicit':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> {t('knowledgeModalEvidenceExplicit')}
          </span>
        );
      case 'Inferred':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" /> {t('knowledgeModalEvidenceInferred')} ⚠️
          </span>
        );
      case 'Assumed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
            <Sparkles className="w-3 h-3" /> {t('knowledgeModalEvidenceAssumed')} ⚠️
          </span>
        );
      case 'Conflict':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3 h-3" /> {t('knowledgeModalEvidenceConflict')} 🚨
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            <Info className="w-3 h-3" /> {t('knowledgeModalEvidenceUnknown')}
          </span>
        );
    }
  };

  // Render left-pane text with active unit highlight (BUG-028: Prioritize char offset over quote string)
  const renderHighlightedContent = () => {
    if (!documentContent) {
      return (
        <div className="text-slate-500 italic p-6 text-center text-xs">
          {t('knowledgeModalNoRawContent')}
        </div>
      );
    }

    if (!selectedUnit) {
      return (
        <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
          {documentContent}
        </pre>
      );
    }

    // 1. Prioritize Character Offsets (Support both unit top-level and sources[0] anchor - BUG-028)
    const firstSource = (selectedUnit as any).sources?.[0];
    const start = selectedUnit.charOffsetStart !== undefined && selectedUnit.charOffsetStart !== null
      ? selectedUnit.charOffsetStart
      : firstSource?.charOffsetStart;
    const end = selectedUnit.charOffsetEnd !== undefined && selectedUnit.charOffsetEnd !== null
      ? selectedUnit.charOffsetEnd
      : firstSource?.charOffsetEnd;

    if (typeof start === 'number' && typeof end === 'number' && start >= 0 && end > start && end <= documentContent.length) {
      const before = documentContent.slice(0, start);
      const highlighted = documentContent.slice(start, end);
      const after = documentContent.slice(end);
      return (
        <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
          {before}
          <mark
            ref={highlightRef}
            className="bg-amber-400/35 text-amber-200 border-b-2 border-amber-400 px-1 py-0.5 rounded font-semibold transition-all shadow-sm"
          >
            {highlighted}
          </mark>
          {after}
        </pre>
      );
    }

    // 2. Fallback to exact quote (from unit or sources[0] - BUG-028)
    const quote = selectedUnit.exactQuote || firstSource?.exactQuote;
    if (quote && documentContent.includes(quote)) {
      const idx = documentContent.indexOf(quote);
      const before = documentContent.slice(0, idx);
      const after = documentContent.slice(idx + quote.length);
      return (
        <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
          {before}
          <mark
            ref={highlightRef}
            className="bg-amber-400/35 text-amber-200 border-b-2 border-amber-400 px-1 py-0.5 rounded font-semibold transition-all shadow-sm"
          >
            {quote}
          </mark>
          {after}
        </pre>
      );
    }

    return (
      <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
        {documentContent}
      </pre>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-7xl h-[92vh] rounded-2xl bg-slate-900 border border-slate-750 shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-950/70 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm md:text-base font-bold text-white tracking-tight">{documentTitle}</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                    riskLevel === 'HIGH'
                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      : riskLevel === 'MEDIUM'
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  Risk Score: {riskScore}/100 ({riskLevel})
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('splitScreenReview')} — {approvedCount}/{units.length} {t('statusApproved')}
              </p>
            </div>
          </div>

          {/* Action Buttons & Close */}
          <div className="flex items-center gap-2">
            {/* Guardrail: Bulk Approve only for Explicit units (AC-E8-3) */}
            <Button
              variant="secondary"
              size="sm"
              disabled={isProcessing || explicitCount === 0}
              onClick={onBulkApproveExplicit}
              icon={<Check className="w-3.5 h-3.5 text-emerald-400" />}
              title={
                nonExplicitCount > 0
                  ? t('knowledgeModalBulkTooltip')
                      .replace('{explicit}', String(explicitCount))
                      .replace('{nonExplicit}', String(nonExplicitCount))
                  : t('knowledgeModalBulkExplicitOnly').replace('{count}', String(explicitCount))
              }
            >
              Approve {explicitCount} Explicit
            </Button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal-level Error Banner (NEW-15) */}
        {modalError && (
          <div className="px-6 py-2.5 bg-rose-950/60 border-b border-rose-500/40 flex items-center justify-between text-xs text-rose-200 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{modalError}</span>
            </div>
            <button
              onClick={() => setModalError(null)}
              className="text-rose-400 hover:text-white font-bold ml-2 px-1 rounded hover:bg-rose-900/50"
            >
              ×
            </button>
          </div>
        )}

        {/* Conflict Alert Banner if any */}
        {conflicts.length > 0 && (
          <div className="px-6 py-2.5 bg-rose-950/40 border-b border-rose-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                {t('detectedConflictsWarning')} ({conflicts.length})
              </span>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setActiveConflict(conflicts[0])}
            >
              {t('resolveConflictNow')}
            </Button>
          </div>
        )}

        {/* Main Split-Screen Workspace (E8-T1, E8-T3) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {/* LEFT PANE (5 cols): Original Document with Source Anchor Highlight */}
          <div className="md:col-span-5 flex flex-col h-full bg-slate-950/40 min-h-0">
            <div className="px-4 py-2.5 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" /> {t('originalDocumentText')}
              </span>
              {selectedUnit?.exactQuote && (
                <span className="text-[10px] text-amber-400 flex items-center gap-1">
                  {t('highlightingSourceAnchor')}
                </span>
              )}
            </div>
            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs">
              {renderHighlightedContent()}
            </div>
          </div>

          {/* RIGHT PANE (7 cols): Extracted Atomic Knowledge Units */}
          <div className="md:col-span-7 flex flex-col h-full bg-slate-900 min-h-0">
            {/* Filter bar */}
            <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-300">{t('knowledgeFilter')}:</span>
              </div>
              <div className="flex items-center gap-1">
                {['ALL', 'Explicit', 'Inferred', 'Assumed'].map(level => (
                  <button
                    key={level}
                    onClick={() => setFilterType(level)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                      filterType === level
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Units list */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {filteredUnits.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 italic">
                  {t('noUnitsMatchFilter')}
                </div>
              ) : (
                filteredUnits.map(unit => {
                  const isSelected = selectedUnit?.id === unit.id;
                  const isApproved = unit.status === 'Approved';
                  const isRejected = unit.status === 'Rejected';

                  return (
                    <div
                      key={unit.id}
                      onClick={() => setSelectedUnitId(unit.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-850 border-indigo-500 shadow-md ring-1 ring-indigo-500/30'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Unit Header */}
                      <div className="flex items-start justify-between gap-2 pb-2 mb-2 border-b border-slate-800/80">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase tracking-wide">
                            {unit.unitType}
                          </span>
                          <span className="text-xs font-bold text-white">{unit.subject}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {renderEvidenceBadge(unit.evidenceLevel)}
                          {isApproved && <Badge variant="success" size="sm">APPROVED</Badge>}
                          {isRejected && <Badge variant="danger" size="sm">REJECTED</Badge>}
                        </div>
                      </div>

                      {/* Content */}
                      <p className="text-xs text-slate-300 leading-relaxed mb-2">
                        {unit.content}
                      </p>

                      {/* Source Anchor Citation */}
                      {unit.exactQuote && (
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px] text-amber-300/90 italic font-mono mb-3">
                          "{unit.exactQuote}"
                        </div>
                      )}

                      {/* Unit Decision Actions */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-slate-500 font-mono">
                          ID: {unit.id.slice(0, 8)}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={isProcessing || isRejected}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRejectModalUnitId(unit.id);
                            }}
                            icon={<XCircle className="w-3.5 h-3.5" />}
                          >
                            {t('knowledgeModalRejectBtn')}
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={isProcessing || isApproved}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprove(unit.id);
                            }}
                            icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />}
                            className="bg-emerald-600 hover:bg-emerald-500"
                          >
                            {t('knowledgeModalApproveBtn')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory Reject Reason Dialog (AC-E8-4) */}
      {rejectModalUnitId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-rose-500/40 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-400 mb-3 font-bold text-sm">
              <XCircle className="w-5 h-5" />
              <span>{t('knowledgeModalRejectDialogTitle')}</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              {t('knowledgeModalRejectDialogDesc')}
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('rejectReasonPlaceholder')}
              className="w-full h-24 p-3 rounded-xl bg-slate-950 border border-slate-750 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 mb-2"
            />
            {rejectError && (
              <p className="text-[11px] text-rose-400 mb-3">{rejectError}</p>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRejectModalUnitId(null);
                  setRejectReason('');
                  setRejectError('');
                }}
              >
                {t('knowledgeModalCancel')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmReject}
                disabled={isProcessing}
              >
                {t('knowledgeModalConfirmReject')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Resolution Modal (E8-T4) */}
      {activeConflict && (
        <ConflictResolutionModal
          isOpen={true}
          conflict={activeConflict}
          onClose={() => setActiveConflict(null)}
          onResolved={(id, res) => {
            if (onConflictResolved) onConflictResolved(id, res);
            setActiveConflict(null);
          }}
        />
      )}
    </div>
  );
};
