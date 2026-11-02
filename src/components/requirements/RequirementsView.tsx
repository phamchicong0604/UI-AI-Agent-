import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../common/i18n/I18nContext';
import { RequirementItem, StatusLifecycle } from '../../types';
import {
  FileText,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  Link2
} from 'lucide-react';
import { RequirementModal } from './RequirementModal';
import { Button, Badge, Card, Modal } from '../../common/components';

export const RequirementsView: React.FC = () => {
  const {
    requirements,
    testCases,
    canApprove,
    canEditRequirement,
    updateRequirementStatus,
    setIsAiModalOpen
  } = useApp();

  const { t } = useI18n();

  const [selectedReq, setSelectedReq] = useState<RequirementItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [activeReqDetails, setActiveReqDetails] = useState<RequirementItem | null>(null);

  const filteredReqs = requirements.filter(req => {
    if (typeFilter !== 'ALL' && req.type !== typeFilter) return false;
    if (statusFilter !== 'ALL' && req.status !== statusFilter) return false;
    return true;
  });

  const getStatusBadge = (status: StatusLifecycle) => {
    switch (status) {
      case 'Approved':
        return <Badge variant="success" icon={<CheckCircle2 className="w-3 h-3" />}>{t('statusApproved')}</Badge>;
      case 'In Review':
        return <Badge variant="warning" icon={<Clock className="w-3 h-3" />}>{t('statusInReview')}</Badge>;
      case 'Draft':
        return <Badge variant="neutral">{t('statusDraft')}</Badge>;
      case 'Rejected':
        return <Badge variant="danger">{t('statusRejected')}</Badge>;
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return <Badge variant="danger">{t('priorityCritical')}</Badge>;
      case 'High':
        return <Badge variant="warning">{t('priorityHigh')}</Badge>;
      case 'Medium':
        return <Badge variant="info">{t('priorityMedium')}</Badge>;
      default:
        return <Badge variant="neutral">{t('priorityLow')}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">{t('reqTitle')}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{t('reqSubtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsAiModalOpen(true)}
            icon={<Sparkles className="w-3.5 h-3.5 text-indigo-400" />}
          >
            {t('reqAiDraft')}
          </Button>
          
          {canEditRequirement() && (
            <Button
              variant="primary"
              onClick={() => {
                setSelectedReq(null);
                setIsModalOpen(true);
              }}
              icon={<Plus className="w-4 h-4" />}
            >
              {t('reqCreate')}
            </Button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Type:</span>
            {['ALL', 'Business', 'Functional', 'Non-functional', 'Technical'].map((ty) => (
              <button
                key={ty}
                onClick={() => setTypeFilter(ty)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  typeFilter === ty
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {ty === 'ALL' ? t('actionAll') : ty}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
            <span className="text-slate-400 font-medium">Status:</span>
            {['ALL', 'Approved', 'In Review', 'Draft'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {s === 'ALL' ? t('actionAll') : s}
              </button>
            ))}
          </div>
        </div>

        <div className="text-slate-400 text-xs">
          {t('docShowingCount', { count: filteredReqs.length })}
        </div>
      </div>

      {/* Requirements List */}
      <div className="space-y-4">
        {filteredReqs.map((req) => {
          const linkedTests = testCases.filter(tc => tc.requirementId === req.id);
          const hasTestCoverage = linkedTests.length > 0;

          return (
            <Card
              key={req.id}
              className="space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                      {req.id}
                    </span>
                    <h3 
                      onClick={() => setActiveReqDetails(req)}
                      className="font-bold text-white text-base hover:text-indigo-400 cursor-pointer transition-colors"
                    >
                      {req.title}
                    </h3>
                    <Badge variant="cyan">{req.type}</Badge>
                    {getPriorityBadge(req.priority)}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{req.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {getStatusBadge(req.status)}
                </div>
              </div>

              {/* Source Document Citation */}
              {req.sourceReferences.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-wrap items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2 text-indigo-300">
                    <Link2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="font-medium">{t('reqAuthoritativeSource')}</span>
                    <span className="text-slate-200">
                      {req.sourceReferences[0].documentTitle} ({req.sourceReferences[0].version})
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      [{req.sourceReferences[0].section}]
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-400">Owner: <strong className="text-slate-200">{req.owner}</strong></span>
                    <span className="text-slate-400">Approver: <strong className="text-slate-200">{req.approver}</strong></span>
                  </div>
                </div>
              )}

              {/* Acceptance Criteria Chips */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {t('reqAcceptanceCriteria')} ({req.acceptanceCriteria.length})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {req.acceptanceCriteria.map((ac) => (
                    <div
                      key={ac.id}
                      className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-850 flex items-start gap-2 text-xs"
                    >
                      <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                        ac.completed ? 'text-emerald-400' : 'text-slate-500'
                      }`} />
                      <div>
                        <span className="font-mono font-bold text-slate-400 mr-1.5">{ac.id}:</span>
                        <span className={ac.completed ? 'text-slate-300' : 'text-slate-400'}>
                          {ac.text}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer: Traceability & Actions */}
              <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1 font-semibold ${
                    hasTestCoverage ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {hasTestCoverage ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{linkedTests.length} {t('reqLinkedCases')}</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{t('reqCoverageGap')}</span>
                      </>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {canEditRequirement() && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedReq(req);
                        setIsModalOpen(true);
                      }}
                    >
                      {t('reqEditSpec')}
                    </Button>
                  )}

                  {canApprove() && req.status !== 'Approved' && (
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => updateRequirementStatus(req.id, 'Approved')}
                    >
                      {t('reqApproveReq')}
                    </Button>
                  )}

                  {req.status === 'Draft' && (
                    <Button
                      variant="amber"
                      size="sm"
                      onClick={() => updateRequirementStatus(req.id, 'In Review')}
                    >
                      {t('reqSubmitReview')}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Requirement Details Modal */}
      {activeReqDetails && (
        <Modal
          isOpen={true}
          onClose={() => setActiveReqDetails(null)}
          title={`${activeReqDetails.id}: ${activeReqDetails.title}`}
          icon={<FileText className="w-5 h-5 text-indigo-400" />}
          footer={
            <Button variant="secondary" onClick={() => setActiveReqDetails(null)}>
              {t('actionClose')}
            </Button>
          }
        >
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 font-medium">Description:</span>
              <p className="text-slate-200 mt-1 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
                {activeReqDetails.description}
              </p>
            </div>

            <div>
              <span className="text-slate-400 font-medium">{t('reqBusinessRules')}:</span>
              <div className="mt-1 space-y-1">
                {activeReqDetails.businessRules.map((br, idx) => (
                  <div key={idx} className="p-2 rounded bg-slate-950 border border-slate-850 text-slate-300 font-mono text-[11px]">
                    {br}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="text-slate-400 font-medium">{t('reqAcceptanceCriteria')}:</span>
              <div className="mt-1 space-y-1">
                {activeReqDetails.acceptanceCriteria.map((ac) => (
                  <div key={ac.id} className="p-2 rounded bg-slate-950 border border-slate-850 flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className={`w-4 h-4 ${ac.completed ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span className="font-mono font-bold text-slate-400">{ac.id}</span>
                    <span>{ac.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {isModalOpen && (
        <RequirementModal
          requirement={selectedReq}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
};
