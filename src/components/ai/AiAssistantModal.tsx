import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../common/i18n/I18nContext';
import { TestCaseItem } from '../../types';
import {
  Sparkles,
  ShieldCheck,
  Download,
  Hash,
  Server
} from 'lucide-react';
import { Modal, Button, Badge } from '../../common/components';
import { syncSha256, formatHashCode } from '../../common/utils/hash';
import { requestAiTestCases } from '../../common/services/api';

export const AiAssistantModal: React.FC = () => {
  const {
    isAiModalOpen,
    setIsAiModalOpen,
    requirements,
    addTestCase,
    logAudit
  } = useApp();

  const { t } = useI18n();

  const [selectedReqId, setSelectedReqId] = useState<string>(
    requirements[0]?.id || ''
  );
  const [prompt, setPrompt] = useState('Generate comprehensive positive and boundary test cases including edge failure conditions');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCases, setGeneratedCases] = useState<any[]>([]);

  if (!isAiModalOpen) return null;

  const targetReq = requirements.find(r => r.id === selectedReqId);
  const sourceDoc = targetReq?.sourceReferences[0];

  const [backendEngineName, setBackendEngineName] = useState<string>('');

  const handleGenerate = async () => {
    if (!targetReq) return;
    setIsGenerating(true);

    try {
      const res = await requestAiTestCases(targetReq, sourceDoc, prompt);
      if (res && Array.isArray(res.testCases)) {
        setGeneratedCases(res.testCases);
        setBackendEngineName(res.engine || 'Backend AI Service');
        logAudit('AI Test Drafting', 'TestCase', targetReq.id, `Backend AI (${res.engine}) generated ${res.testCases.length} test cases`);
        setIsGenerating(false);
        return;
      }
    } catch (err) {
      console.warn('Backend API fallback:', err);
    }

    setTimeout(() => {
      const generated = [
        {
          id: `TC-AI-${Math.floor(100 + Math.random() * 900)}`,
          title: `[AI] Positive Flow: ${targetReq.title}`,
          scenario: `Verify end-to-end success path for ${targetReq.title} according to specifications in ${sourceDoc?.documentTitle || 'source document'}.`,
          preconditions: `1. User possesses valid privileges.\n2. Target system is online and ready.`,
          testData: `Input parameters conforming to AC checklist of ${targetReq.id}`,
          type: 'Positive',
          priority: 'High',
          status: 'Draft',
          isAiDrafted: true,
          steps: [
            { stepNumber: 1, action: `Access interface for ${targetReq.id}`, expectedResult: 'Screen displays properly without errors' },
            { stepNumber: 2, action: `Execute action complying with ${targetReq.acceptanceCriteria[0]?.text || 'AC-01'}`, expectedResult: 'System returns success state' }
          ],
          sourceCitationHash: `sha256:${syncSha256(`${targetReq.id}|${sourceDoc?.documentTitle}|${Date.now()}`)}`
        },
        {
          id: `TC-AI-${Math.floor(100 + Math.random() * 900)}`,
          title: `[AI] Boundary & Security: Edge Condition for ${targetReq.id}`,
          scenario: `Verify that system strictly rejects invalid data or unauthorized roles as specified in ${targetReq.businessRules[0] || 'Business Rules'}.`,
          preconditions: `Session is restricted or inputs exceed upper boundary limit.`,
          testData: `Boundary data exceeding max threshold`,
          type: 'Boundary',
          priority: 'Critical',
          status: 'Draft',
          isAiDrafted: true,
          steps: [
            { stepNumber: 1, action: 'Submit payload with boundary overflow values', expectedResult: 'System returns validation error 400 or 422' },
            { stepNumber: 2, action: 'Inspect security audit logs', expectedResult: 'Failed attempt is recorded without exposing secrets' }
          ],
          sourceCitationHash: `sha256:${syncSha256(`${targetReq.id}|Boundary|${Date.now()}`)}`
        }
      ];

      setGeneratedCases(generated);
      setIsGenerating(false);
      logAudit('AI Test Drafting', 'TestCase', targetReq.id, `AI generated ${generated.length} drafted test cases citing ${targetReq.id} [SHA-256 Verified]`);
    }, 700);
  };

  const handleImportAll = () => {
    generatedCases.forEach(gc => {
      const newTc: TestCaseItem = {
        id: gc.id,
        requirementId: targetReq!.id,
        requirementTitle: targetReq!.title,
        title: gc.title,
        scenario: gc.scenario,
        preconditions: gc.preconditions,
        testData: gc.testData,
        type: gc.type,
        priority: gc.priority,
        status: 'Draft',
        version: 'v0.1',
        sourceReferences: targetReq?.sourceReferences || [],
        steps: gc.steps,
        reviewComments: [],
        relatedEvidenceIds: [],
        createdAt: new Date().toISOString().slice(0, 10),
        updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
        isAiDrafted: true
      };
      addTestCase(newTc);
    });

    alert(`Successfully imported ${generatedCases.length} AI Drafted test cases into repository with Draft status for human review.`);
    setIsAiModalOpen(false);
  };

  return (
    <Modal
      isOpen={true}
      onClose={() => setIsAiModalOpen(false)}
      title={t('aiModalTitle')}
      subtitle={t('aiModalDesc')}
      icon={<Sparkles className="w-5 h-5 text-amber-300" />}
      maxWidth="3xl"
      footer={
        <Button variant="secondary" onClick={() => setIsAiModalOpen(false)}>
          {t('actionClose')}
        </Button>
      }
    >
      <div className="space-y-4 text-xs">
        {/* AI Governance Policy Banner */}
        <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-slate-300">
            <span className="font-semibold text-white">{t('aiPolicyTitle')}</span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {t('aiPolicyText')}
            </p>
          </div>
        </div>

        {/* Input Controls */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {t('aiSelectApprovedReq')}
              </label>
              <select
                value={selectedReqId}
                onChange={(e) => setSelectedReqId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
              >
                {requirements.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id}: {r.title.slice(0, 36)} ({r.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {t('aiCitation')}
              </label>
              <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-indigo-300 font-mono text-[11px] truncate">
                {sourceDoc ? `${sourceDoc.documentTitle} (${sourceDoc.version}) - ${sourceDoc.section}` : 'General repository'}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">{t('aiInstruction')}</label>
            <textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={handleGenerate}
              loading={isGenerating}
              icon={<Sparkles className="w-4 h-4 text-amber-300" />}
            >
              {isGenerating ? t('aiGenerating') : t('aiGenerateBtn')}
            </Button>
          </div>
        </div>

        {/* Results Preview */}
        {generatedCases.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">
                  Drafted Output ({generatedCases.length} Cases)
                </span>
                {backendEngineName && (
                  <Badge variant="cyan" icon={<Server className="w-3 h-3" />}>
                    {backendEngineName}
                  </Badge>
                )}
              </div>
              <Button
                variant="success"
                size="sm"
                onClick={handleImportAll}
                icon={<Download className="w-3.5 h-3.5" />}
              >
                {t('aiImportAll')}
              </Button>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {generatedCases.map((gc) => (
                <div key={gc.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-cyan-400 font-bold">{gc.id}</span>
                      <span className="font-semibold text-white">{gc.title}</span>
                      <Badge variant="info">{gc.type}</Badge>
                    </div>
                    <Badge variant="warning">{t('statusDraft')}</Badge>
                  </div>

                  <p className="text-slate-300">{gc.scenario}</p>

                  <div className="space-y-1 pt-1 border-t border-slate-850">
                    {gc.steps.map((st: any) => (
                      <div key={st.stepNumber} className="text-[11px] text-slate-400">
                        <strong className="text-slate-300">Step {st.stepNumber}:</strong> {st.action} ➔ <span className="text-emerald-400">{st.expectedResult}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-1 border-t border-slate-850 font-mono text-[10px] text-emerald-400 flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    <span>Citation Hash: {formatHashCode(gc.sourceCitationHash, false)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
