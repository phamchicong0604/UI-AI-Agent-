import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, XCircle, Shuffle, ShieldAlert, X } from 'lucide-react';
import { Button, Badge } from '../../common/components';

export interface ConflictData {
  id: string;
  projectId: string;
  unitAId: string;
  unitBId: string;
  conflictType: 'Contradiction' | 'Ambiguity' | 'Redundancy';
  severity: 'Critical' | 'Major' | 'Minor';
  description: string;
  unitAContent?: string;
  unitASubject?: string;
  unitBContent?: string;
  unitBSubject?: string;
  unitASource?: string;
  unitBSource?: string;
}

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflict: ConflictData | null;
  onResolved: (conflictId: string, resolution: string) => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  onClose,
  conflict,
  onResolved
}) => {
  const [resolutionChoice, setResolutionChoice] = useState<'KEEP_NEW_SUPERSEDE_OLD' | 'REJECT_NEW_PRESERVE_OLD' | 'MERGE_SPECIFICATION'>('KEEP_NEW_SUPERSEDE_OLD');
  const [mergeNotes, setMergeNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !conflict) return null;

  const handleResolve = async () => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/v1/conflicts/${conflict.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution: resolutionChoice,
          resolvedBy: 'Lead QA / Reviewer',
          notes: resolutionChoice === 'MERGE_SPECIFICATION' ? mergeNotes : undefined
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Không thể giải quyết xung đột');
      }

      onResolved(conflict.id, resolutionChoice);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi xử lý');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'Critical':
        return <Badge variant="danger" size="sm">CRITICAL</Badge>;
      case 'Major':
        return <Badge variant="warning" size="sm">MAJOR</Badge>;
      default:
        return <Badge variant="neutral" size="sm">MINOR</Badge>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-750 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Xử lý Xung đột Tri thức (Conflict Resolution)</h3>
                {getSeverityBadge(conflict.severity)}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Loại: <span className="font-semibold text-slate-300">{conflict.conflictType}</span> — ID: {conflict.id.slice(0, 8)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Description banner */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <span className="font-semibold">Mô tả mâu thuẫn: </span>
              {conflict.description}
            </div>
          </div>

          {/* Side by side comparison (E8-T4) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Unit B: Approved Base Truth */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Bản ghi ĐÃ PHÊ DUYỆT (Unit B)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">{conflict.unitBId.slice(0, 8)}</span>
                </div>
                <div className="text-xs text-slate-400 mb-1">
                  Chủ thể: <span className="text-slate-200 font-medium">{conflict.unitBSubject || 'Quy tắc đã duyệt'}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 italic font-serif">
                  "{conflict.unitBContent || 'Nội dung quy chuẩn hiện tại trong kho tri thức.'}"
                </div>
              </div>
              <div className="text-[11px] text-slate-400 mt-2">
                Nguồn: <span className="text-slate-400">{conflict.unitBSource || 'Tài liệu đã phê duyệt trước đây'}</span>
              </div>
            </div>

            {/* Unit A: Incoming Candidate */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                  <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Đề xuất TÀI LIỆU MỚI (Unit A)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">{conflict.unitAId.slice(0, 8)}</span>
                </div>
                <div className="text-xs text-slate-400 mb-1">
                  Chủ thể: <span className="text-slate-200 font-medium">{conflict.unitASubject || 'Đề xuất mới'}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 italic font-serif">
                  "{conflict.unitAContent || 'Nội dung đề xuất mới đang chờ kiểm duyệt.'}"
                </div>
              </div>
              <div className="text-[11px] text-slate-400 mt-2">
                Nguồn: <span className="text-slate-400">{conflict.unitASource || 'Tài liệu đang xét duyệt'}</span>
              </div>
            </div>
          </div>

          {/* Resolution Options */}
          <div className="space-y-3 pt-2">
            <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
              Chọn phương án phân giải xung đột:
            </label>

            {/* Option 1: KEEP_NEW_SUPERSEDE_OLD */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                resolutionChoice === 'KEEP_NEW_SUPERSEDE_OLD'
                  ? 'bg-indigo-950/40 border-indigo-500 text-white'
                  : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="resolution"
                value="KEEP_NEW_SUPERSEDE_OLD"
                checked={resolutionChoice === 'KEEP_NEW_SUPERSEDE_OLD'}
                onChange={() => setResolutionChoice('KEEP_NEW_SUPERSEDE_OLD')}
                className="mt-1 accent-indigo-500"
              />
              <div className="text-xs">
                <div className="font-semibold text-indigo-300">1. KEEP_NEW_SUPERSEDE_OLD (Phê duyệt mới, lưu trữ bản cũ)</div>
                <div className="text-slate-400 mt-0.5">
                  Chấp thuận đề xuất mới từ tài liệu này. Bản ghi tri thức cũ sẽ chuyển sang trạng thái <strong>Superseded</strong> và tự động đưa các Test Case liên quan về <strong>In Review</strong> (Change Impact).
                </div>
              </div>
            </label>

            {/* Option 2: REJECT_NEW_PRESERVE_OLD */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                resolutionChoice === 'REJECT_NEW_PRESERVE_OLD'
                  ? 'bg-rose-950/40 border-rose-500 text-white'
                  : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="resolution"
                value="REJECT_NEW_PRESERVE_OLD"
                checked={resolutionChoice === 'REJECT_NEW_PRESERVE_OLD'}
                onChange={() => setResolutionChoice('REJECT_NEW_PRESERVE_OLD')}
                className="mt-1 accent-rose-500"
              />
              <div className="text-xs">
                <div className="font-semibold text-rose-300">2. REJECT_NEW_PRESERVE_OLD (Giữ nguyên cũ, từ chối đề xuất mới)</div>
                <div className="text-slate-400 mt-0.5">
                  Bảo lưu quy định đã được phê duyệt trước đây. Đề xuất mới bị từ chối do vi phạm quy chuẩn dự án.
                </div>
              </div>
            </label>

            {/* Option 3: MERGE_SPECIFICATION */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                resolutionChoice === 'MERGE_SPECIFICATION'
                  ? 'bg-amber-950/40 border-amber-500 text-white'
                  : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="resolution"
                value="MERGE_SPECIFICATION"
                checked={resolutionChoice === 'MERGE_SPECIFICATION'}
                onChange={() => setResolutionChoice('MERGE_SPECIFICATION')}
                className="mt-1 accent-amber-500"
              />
              <div className="text-xs">
                <div className="font-semibold text-amber-300">3. MERGE_SPECIFICATION (Hợp nhất đặc tả điều kiện)</div>
                <div className="text-slate-400 mt-0.5">
                  Cả hai cùng tồn tại nhưng áp dụng cho các ngữ cảnh hoặc phân hệ khác nhau.
                </div>
              </div>
            </label>

            {resolutionChoice === 'MERGE_SPECIFICATION' && (
              <div className="pt-2">
                <textarea
                  value={mergeNotes}
                  onChange={(e) => setMergeNotes(e.target.value)}
                  placeholder="Ghi chú phân tách điều kiện hợp nhất (ví dụ: áp dụng 15m cho QR Code, 30m cho thanh toán thẻ quốc tế)..."
                  className="w-full h-20 p-3 rounded-xl bg-slate-950 border border-amber-500/40 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/80">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Hủy bỏ
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleResolve}
            disabled={isSubmitting}
            className="bg-indigo-600 hover:bg-indigo-500"
          >
            {isSubmitting ? 'Đang xử lý...' : 'Xác nhận Phân giải'}
          </Button>
        </div>
      </div>
    </div>
  );
};
