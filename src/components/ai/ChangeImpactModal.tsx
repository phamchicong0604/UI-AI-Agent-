import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../common/i18n/I18nContext';
import {
  Zap,
  AlertTriangle
} from 'lucide-react';
import { Modal, Button, Badge } from '../../common/components';

export const ChangeImpactModal: React.FC = () => {
  const {
    isImpactModalOpen,
    setIsImpactModalOpen,
    documents,
    requirements,
    testCases,
    updateTestCaseStatus
  } = useApp();

  const { t } = useI18n();

  const [selectedDocId, setSelectedDocId] = useState(documents[1]?.id || documents[0]?.id || '');
  const [analyzed, setAnalyzed] = useState(false);

  if (!isImpactModalOpen) return null;

  const targetDoc = documents.find(d => d.id === selectedDocId);

  // Find all requirements linked to this doc
  const impactedReqs = requirements.filter(r => 
    r.sourceReferences.some(s => s.documentId === selectedDocId)
  );

  // Find all test cases linked to these requirements
  const impactedCases = testCases.filter(tc => 
    impactedReqs.some(r => r.id === tc.requirementId)
  );

  const handleFlagForReview = () => {
    impactedCases.forEach(tc => {
      updateTestCaseStatus(tc.id, 'In Review');
    });
    alert(`Flagged ${impactedCases.length} impacted test cases as "In Review" per Proposal Section 6.5 policy.`);
    setIsImpactModalOpen(false);
  };

  return (
    <Modal
      isOpen={true}
      onClose={() => setIsImpactModalOpen(false)}
      title={t('impactTitle')}
      subtitle={t('impactSubtitle')}
      icon={<Zap className="w-5 h-5 text-amber-400" />}
      maxWidth="2xl"
      footer={
        <Button variant="secondary" onClick={() => setIsImpactModalOpen(false)}>
          {t('actionClose')}
        </Button>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Policy Alert */}
        <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>{t('impactPolicyTitle')}</strong> {t('impactPolicyText')}
          </span>
        </div>

        {/* Document Selector */}
        <div className="space-y-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              {t('impactSelectRevisedDoc')}
            </label>
            <select
              value={selectedDocId}
              onChange={(e) => {
                setSelectedDocId(e.target.value);
                setAnalyzed(false);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
            >
              {documents.map(d => (
                <option key={d.id} value={d.id}>
                  {d.id}: {d.title} ({d.currentVersion})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end">
            <Button
              variant="amber"
              onClick={() => setAnalyzed(true)}
              icon={<Zap className="w-4 h-4" />}
            >
              {t('impactCalculate')}
            </Button>
          </div>
        </div>

        {/* Analysis Results */}
        {analyzed && (
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono flex items-center justify-between">
              <span className="text-slate-400">{t('impactAffectedScope')}</span>
              <span className="text-amber-400 font-bold">
                {impactedReqs.length} {t('dashTotalReqs')} • {impactedCases.length} {t('dashTotalTestCases')}
              </span>
            </div>

            <div>
              <div className="font-semibold text-slate-300 mb-1.5">Directly Impacted Test Cases:</div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {impactedCases.map(tc => (
                  <div key={tc.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-850 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-emerald-400 font-bold">{tc.id}</span>
                        <span className="text-white font-medium">{tc.title}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Linked via: {tc.requirementId} • Status: {tc.status}
                      </div>
                    </div>
                    <Badge variant="warning">Re-review Needed</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-300">Flag all impacted items for review?</span>
              <Button variant="amber" size="sm" onClick={handleFlagForReview}>
                {t('impactFlagBtn')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
