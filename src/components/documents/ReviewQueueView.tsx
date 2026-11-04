import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Filter,
  Search,
  FileText,
  ChevronRight,
  RefreshCw,
  Folder,
  Layers,
  Sparkles
} from 'lucide-react';
import { Button, Badge } from '../../common/components';
import { DocumentItem, DocumentCategory } from '../../types';
import { KnowledgeReviewModal, KnowledgeUnitItem } from './KnowledgeReviewModal';
import { ConflictResolutionModal, ConflictData } from './ConflictResolutionModal';
import { getAuthToken } from '../../common/services/api';
import { useI18n } from '../../common/i18n/I18nContext';

export interface ReviewQueueItem {
  document: DocumentItem;
  latestVersion: any;
  riskResult: {
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    autoApproveAllowed: boolean;
    breakdown: {
      criticalConflictPenalty: number;
      ambiguityPenalty: number;
      unknownTermPenalty: number;
      unsupportedInferencePenalty: number;
    };
  };
  unitsCount: number;
  explicitCount: number;
  inferredCount: number;
  conflictsCount: number;
  criticalConflictsCount: number;
  units: KnowledgeUnitItem[];
  conflicts: ConflictData[];
}

interface ReviewQueueViewProps {
  projectId: string;
  projectName: string;
  onOpenDocReader?: (docId: string) => void;
}

export const ReviewQueueView: React.FC<ReviewQueueViewProps> = ({
  projectId,
  projectName,
  onOpenDocReader
}) => {
  const { t } = useI18n();
  const [queueItems, setQueueItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active modals
  const [reviewingItem, setReviewingItem] = useState<ReviewQueueItem | null>(null);
  const [activeConflict, setActiveConflict] = useState<ConflictData | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchQueue = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      const token = getAuthToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/documents/review-queue?projectId=${projectId}`, { signal, headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setQueueItems(json.data);
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Failed to fetch review queue:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchQueue(controller.signal);
    return () => controller.abort();
  }, [fetchQueue]);

  const filteredItems = useMemo(() => {
    return queueItems.filter(item => {
      if (riskFilter !== 'ALL' && item.riskResult.riskLevel !== riskFilter) return false;
      if (categoryFilter !== 'ALL' && item.document.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.document.title.toLowerCase().includes(q) ||
          item.document.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [queueItems, riskFilter, categoryFilter, searchQuery]);

  // Overall metric counts
  const totalNeedingReview = queueItems.length;
  const highRiskCount = queueItems.filter(i => i.riskResult.riskLevel === 'HIGH').length;
  const totalCriticalConflicts = queueItems.reduce((acc, i) => acc + i.criticalConflictsCount, 0);
  const totalUnits = queueItems.reduce((acc, i) => acc + i.unitsCount, 0);

  const handleUnitDecision = async (unitId: string, decision: 'Approve' | 'Reject', reason?: string) => {
    setActionError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = getAuthToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/knowledge-units/${unitId}/decision`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ decision, reviewer: 'Lead QA', reason })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Lỗi duyệt đơn vị tri thức (HTTP ${res.status})`);
      }
      // Update local state in reviewingItem using functional updater to avoid stale state in bulk loops (BUG-025)
      setReviewingItem(prev => {
        if (!prev) return null;
        return {
          ...prev,
          units: prev.units.map(u =>
            u.id === unitId ? { ...u, status: (decision === 'Approve' ? 'Approved' : 'Rejected') as any } : u
          )
        };
      });
      await fetchQueue();
    } catch (err: any) {
      console.error('Error recording unit decision:', err);
      setActionError(err.message || 'Lỗi xử lý duyệt đơn vị tri thức');
      throw err;
    }
  };

  const handleBulkApproveExplicit = async () => {
    if (!reviewingItem) return;
    setActionError(null);
    const explicitUnits = reviewingItem.units.filter(u => u.evidenceLevel === 'Explicit' && u.status !== 'Approved');
    try {
      for (const u of explicitUnits) {
        await handleUnitDecision(u.id, 'Approve');
      }
    } catch (err: any) {
      setActionError(`Lỗi khi duyệt hàng loạt: ${err.message}`);
    }
    await fetchQueue();
  };

  const handleConflictResolved = async (resolvedConflictId?: string) => {
    const targetConflictId = resolvedConflictId || activeConflict?.id;
    await fetchQueue();
    if (targetConflictId) {
      setReviewingItem(prev => {
        if (!prev) return null;
        const updatedConflicts = prev.conflicts.filter(c => c.id !== targetConflictId);
        return {
          ...prev,
          conflicts: updatedConflicts,
          conflictsCount: updatedConflicts.length
        };
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Action Error Banner (BUG-025) */}
      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-rose-400 hover:text-rose-200 text-xs px-2 py-0.5"
          >
            Đóng
          </button>
        </div>
      )}
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">{t('reviewQueueNeedingReview')}</span>
            <div className="text-xl font-bold text-white mt-1">{totalNeedingReview}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-rose-500/30 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-rose-400 font-medium">{t('reviewQueueHighRisk')}</span>
            <div className="text-xl font-bold text-rose-300 mt-1">{highRiskCount}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/30 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-amber-400 font-medium">{t('reviewQueueCriticalConflicts')}</span>
            <div className="text-xl font-bold text-amber-300 mt-1">{totalCriticalConflicts}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">{t('reviewQueueTotalUnits')}</span>
            <div className="text-xl font-bold text-emerald-400 mt-1">{totalUnits}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Risk Level Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <span className="px-2 text-slate-400 text-[11px] font-semibold">Risk:</span>
            {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map(level => (
              <button
                key={level}
                onClick={() => setRiskFilter(level)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  riskFilter === level
                    ? level === 'HIGH'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : level === 'MEDIUM'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : level === 'LOW'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {level}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchQueue()}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Làm mới hàng đợi"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tiêu đề tài liệu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Queue List (AC-E8-1: Sorted by Risk Score descending) */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
            <span>Đang tải hàng đợi review tri thức...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-white">{t('reviewQueueEmpty')}</h4>
            <p className="text-xs text-slate-400 mt-1">
              Tất cả tài liệu dự án {projectName} đã được duyệt hoàn tất hoặc không có yêu cầu cần phê duyệt.
            </p>
          </div>
        ) : (
          filteredItems.map(item => {
            const rScore = item.riskResult.riskScore;
            const rLevel = item.riskResult.riskLevel;

            return (
              <div
                key={item.document.id}
                className={`p-4 rounded-xl border transition-all ${
                  rLevel === 'HIGH'
                    ? 'bg-slate-900 border-rose-500/40 hover:border-rose-500/70'
                    : rLevel === 'MEDIUM'
                    ? 'bg-slate-900 border-amber-500/30 hover:border-amber-500/60'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Info */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-indigo-400 border border-slate-700">
                        {item.document.id}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">
                        {item.document.category}
                      </span>
                      <Badge variant="neutral" size="sm">
                        v{item.document.currentVersion}
                      </Badge>

                      {/* Risk Score Pill */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          rLevel === 'HIGH'
                            ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            : rLevel === 'MEDIUM'
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        Risk: {rScore}/100 ({rLevel})
                      </span>

                      {/* Critical conflict pill */}
                      {item.criticalConflictsCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-950 text-rose-300 border border-rose-500/50">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          {item.criticalConflictsCount} Critical Conflict
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-white truncate hover:text-indigo-300 transition-colors">
                      {item.document.title}
                    </h4>

                    {/* Extracted units breakdown */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span>
                        Tri thức trích xuất: <strong className="text-slate-200">{item.unitsCount}</strong>
                      </span>
                      <span>
                        Rõ ràng: <strong className="text-emerald-400">{item.explicitCount} Explicit</strong>
                      </span>
                      {item.inferredCount > 0 && (
                        <span>
                          Suy luận/Giả định: <strong className="text-amber-400">{item.inferredCount} Inferred</strong>
                        </span>
                      )}
                      <span>
                        Cập nhật: <span className="text-slate-400">{item.document.updatedAt}</span>
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    {item.conflictsCount > 0 && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setActiveConflict(item.conflicts[0])}
                        icon={<AlertTriangle className="w-3.5 h-3.5" />}
                      >
                        {t('reviewQueueConflictsBtn')} ({item.conflictsCount})
                      </Button>
                    )}

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setReviewingItem(item)}
                      icon={<ShieldCheck className="w-4 h-4 text-emerald-300" />}
                      className="bg-indigo-600 hover:bg-indigo-500"
                    >
                      {t('reviewQueueReviewKnowledgeBtn')}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Knowledge Review Modal (E8-T3) */}
      {reviewingItem && (
        <KnowledgeReviewModal
          isOpen={true}
          documentTitle={reviewingItem.document.title}
          documentContent={reviewingItem.document.contentMarkdown || reviewingItem.document.description || ''}
          units={reviewingItem.units}
          conflicts={reviewingItem.conflicts}
          riskScore={reviewingItem.riskResult.riskScore}
          riskLevel={reviewingItem.riskResult.riskLevel}
          onClose={() => setReviewingItem(null)}
          onUnitDecision={handleUnitDecision}
          onBulkApproveExplicit={handleBulkApproveExplicit}
          onConflictResolved={handleConflictResolved}
        />
      )}

      {/* Conflict Resolution Modal (E8-T4) */}
      {activeConflict && (
        <ConflictResolutionModal
          isOpen={true}
          conflict={activeConflict}
          onClose={() => setActiveConflict(null)}
          onResolved={handleConflictResolved}
        />
      )}
    </div>
  );
};
