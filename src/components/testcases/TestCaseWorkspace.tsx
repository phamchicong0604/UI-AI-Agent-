import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../common/i18n/I18nContext';
import { TestCaseItem, TestStep } from '../../types';
import {
  ArrowLeft,
  Save,
  Send,
  CheckCircle2,
  XCircle,
  Download,
  Plus,
  Trash2,
  FileText,
  FileCheck2,
  MessageSquare,
  Sparkles,
  Link2
} from 'lucide-react';
import { Button, Badge, Card } from '../../common/components';
import { downloadCsv } from '../../common/utils/export';

interface TestCaseWorkspaceProps {
  testCaseId: string;
  onBack: () => void;
}

export const TestCaseWorkspace: React.FC<TestCaseWorkspaceProps> = ({ testCaseId, onBack }) => {
  const {
    testCases,
    requirements,
    evidences,
    canApprove,
    updateTestCase,
    updateTestCaseStatus,
    addTestCaseReviewComment
  } = useApp();

  const { t } = useI18n();

  const tc = testCases.find(t => t.id === testCaseId);
  if (!tc) return <div>Test case not found.</div>;

  const linkedReq = requirements.find(r => r.id === tc.requirementId);
  const linkedEvidences = evidences.filter(e => tc.relatedEvidenceIds.includes(e.id));

  // Editable local state
  const [title, setTitle] = useState(tc.title);
  const [scenario, setScenario] = useState(tc.scenario);
  const [preconditions, setPreconditions] = useState(tc.preconditions);
  const [testData, setTestData] = useState(tc.testData);
  const [steps, setSteps] = useState<TestStep[]>(tc.steps);
  const [reviewRemark, setReviewRemark] = useState('');

  const handleAddStep = () => {
    setSteps(prev => [
      ...prev,
      {
        stepNumber: prev.length + 1,
        action: '',
        expectedResult: '',
        testData: ''
      }
    ]);
  };

  const handleRemoveStep = (index: number) => {
    setSteps(prev => 
      prev.filter((_, i) => i !== index).map((s, idx) => ({ ...s, stepNumber: idx + 1 }))
    );
  };

  const handleSaveDraft = () => {
    const updated: TestCaseItem = {
      ...tc,
      title,
      scenario,
      preconditions,
      testData,
      steps,
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
    };
    updateTestCase(updated);
    alert('Test Case draft saved successfully.');
  };

  const handleSubmitForReview = () => {
    handleSaveDraft();
    updateTestCaseStatus(tc.id, 'In Review');
  };

  const handleApprove = () => {
    if (reviewRemark.trim()) {
      addTestCaseReviewComment(tc.id, reviewRemark, 'Approved');
    } else {
      updateTestCaseStatus(tc.id, 'Approved');
    }
    setReviewRemark('');
  };

  const handleReject = () => {
    if (reviewRemark.trim()) {
      addTestCaseReviewComment(tc.id, reviewRemark, 'Changes Requested');
    } else {
      updateTestCaseStatus(tc.id, 'Draft');
    }
    setReviewRemark('');
  };

  const handleExportCSV = () => {
    const headers = ['Step #', 'Action', 'Expected Result', 'Test Data'];
    const rows = steps.map(s => [
      s.stepNumber,
      s.action,
      s.expectedResult,
      s.testData || ''
    ]);
    downloadCsv(`${tc.id}_export`, headers, rows);
  };

  return (
    <div className="space-y-4">
      {/* Action Bar (Top Toolbar as defined in 7.1) */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
            {t('actionClose')}
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-cyan-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                {tc.id}
              </span>
              <span className="text-xs text-slate-400 font-mono">v{tc.version}</span>
              <Badge variant={tc.status === 'Approved' ? 'success' : 'warning'}>
                {tc.status}
              </Badge>
              {tc.isAiDrafted && (
                <Badge variant="info" icon={<Sparkles className="w-3 h-3 text-indigo-400" />}>
                  AI Drafted
                </Badge>
              )}
            </div>
            <h2 className="text-sm font-bold text-white tracking-tight mt-0.5 max-w-xl truncate">
              {tc.title}
            </h2>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            {t('actionExportCsv')}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleSaveDraft}
            icon={<Save className="w-3.5 h-3.5 text-indigo-400" />}
          >
            {t('tcSaveDraft')}
          </Button>

          {tc.status === 'Draft' && (
            <Button
              variant="amber"
              size="sm"
              onClick={handleSubmitForReview}
              icon={<Send className="w-3.5 h-3.5" />}
            >
              {t('tcSubmitReview')}
            </Button>
          )}

          {canApprove() && tc.status !== 'Approved' && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
              <Button
                variant="success"
                size="sm"
                onClick={handleApprove}
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                {t('actionApprove')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleReject}
                icon={<XCircle className="w-3.5 h-3.5" />}
              >
                {t('actionReject')}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 3-Column Test Case Workspace (Section 7.1 Architecture) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* COLUMN 1: Left (Requirement / AC & Source Documents) - 3 Cols */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-xs font-semibold text-slate-300">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>{t('tcCol1Title')}</span>
            </div>

            {linkedReq ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-mono text-cyan-400 font-bold">{linkedReq.id}</span>
                  <div className="text-white font-semibold text-sm mt-0.5">{linkedReq.title}</div>
                  <div className="text-[10px] text-slate-400 mt-1">Status: <strong className="text-emerald-400">{linkedReq.status}</strong></div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 leading-relaxed text-[11px]">
                  {linkedReq.description}
                </div>

                <div>
                  <div className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider mb-1">
                    {t('reqAcceptanceCriteria')}
                  </div>
                  <div className="space-y-1.5">
                    {linkedReq.acceptanceCriteria.map(ac => (
                      <div key={ac.id} className="p-2 rounded-lg bg-slate-950 border border-slate-855 flex items-start gap-1.5 text-[11px]">
                        <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${ac.completed ? 'text-emerald-400' : 'text-slate-600'}`} />
                        <div>
                          <strong className="text-slate-400 font-mono">{ac.id}:</strong>{' '}
                          <span className="text-slate-300">{ac.text}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider mb-1">
                    {t('reqBusinessRules')}
                  </div>
                  <div className="space-y-1">
                    {linkedReq.businessRules.map((br, idx) => (
                      <div key={idx} className="p-1.5 rounded bg-slate-950 font-mono text-[10px] text-slate-400 border border-slate-850">
                        {br}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950 text-slate-400 text-xs">
                No requirement directly mapped.
              </div>
            )}
          </Card>
        </div>

        {/* COLUMN 2: Center (Test Case Steps & Editor) - 6 Cols */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-300">
                {t('tcCol2Title')}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddStep}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                {t('tcAddStep')}
              </Button>
            </div>

            {/* Test Scenario & Preconditions */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">{t('tcTitle')}</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">{t('tcPreconditions')}</label>
                  <textarea
                    rows={2}
                    value={preconditions}
                    onChange={(e) => setPreconditions(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">{t('tcTestData')}</label>
                  <textarea
                    rows={2}
                    value={testData}
                    onChange={(e) => setTestData(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Steps List */}
            <div className="space-y-3 pt-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Execution Steps ({steps.length})
              </div>

              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                      Step #{step.stepNumber}
                    </span>
                    {steps.length > 1 && (
                      <button
                        onClick={() => handleRemoveStep(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
                        {t('tcAction')}
                      </label>
                      <textarea
                        rows={2}
                        value={step.action}
                        onChange={(e) => {
                          const updated = [...steps];
                          updated[idx].action = e.target.value;
                          setSteps(updated);
                        }}
                        placeholder="Click login, submit form, send API payload..."
                        className="w-full bg-slate-900 border border-slate-750 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
                        {t('tcExpectedResult')}
                      </label>
                      <textarea
                        rows={2}
                        value={step.expectedResult}
                        onChange={(e) => {
                          const updated = [...steps];
                          updated[idx].expectedResult = e.target.value;
                          setSteps(updated);
                        }}
                        placeholder="Expected dialog opens, HTTP 200 returned..."
                        className="w-full bg-slate-900 border border-slate-750 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* COLUMN 3: Right (Source References, EVD, Review Comments & History) - 3 Cols */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Source References */}
          <Card className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-xs font-semibold text-slate-300">
              <Link2 className="w-4 h-4 text-indigo-400" />
              <span>{t('tcCol3Title')}</span>
            </div>

            <div className="space-y-2 text-xs">
              {tc.sourceReferences.map((ref, i) => (
                <div key={i} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-semibold text-white">{ref.documentTitle}</div>
                  <div className="text-[11px] font-mono text-indigo-300">Version: {ref.version}</div>
                  <div className="text-[11px] text-slate-400">Anchor: {ref.section}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Related Evidence */}
          <Card className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-semibold text-slate-300">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-emerald-400" />
                <span>{t('navEvidence')} ({linkedEvidences.length})</span>
              </div>
            </div>

            {linkedEvidences.length === 0 ? (
              <div className="text-slate-400 text-xs italic">No evidence attached yet.</div>
            ) : (
              <div className="space-y-2">
                {linkedEvidences.map(evd => (
                  <div key={evd.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-cyan-400 font-bold">{evd.id}</span>
                      <span className="text-[10px] text-slate-400">{evd.type}</span>
                    </div>
                    <div className="text-slate-300 font-medium line-clamp-1">{evd.title}</div>
                    <div className="text-[10px] text-emerald-400 font-mono">Status: {evd.status}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Review Comments & Decision Gate */}
          <Card className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-xs font-semibold text-slate-300">
              <MessageSquare className="w-4 h-4 text-purple-400" />
              <span>{t('tcReviewComments')} ({tc.reviewComments.length})</span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {tc.reviewComments.length === 0 ? (
                <div className="text-slate-400 text-xs italic">No review remarks recorded.</div>
              ) : (
                tc.reviewComments.map(rc => (
                  <div key={rc.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-200 font-semibold">{rc.author} ({rc.role})</span>
                      <span className="text-slate-400 font-mono text-[10px]">{rc.createdAt}</span>
                    </div>
                    <p className="text-slate-300">{rc.content}</p>
                    {rc.decision && (
                      <Badge variant={rc.decision === 'Approved' ? 'success' : 'danger'}>
                        {rc.decision}
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Leave Review Remarks */}
            <div className="pt-2 border-t border-slate-800 space-y-2 text-xs">
              <textarea
                rows={2}
                value={reviewRemark}
                onChange={(e) => setReviewRemark(e.target.value)}
                placeholder={t('tcLeaveFeedback')}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
              <div className="flex items-center gap-1.5 justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (reviewRemark.trim()) {
                      addTestCaseReviewComment(tc.id, reviewRemark);
                      setReviewRemark('');
                    }
                  }}
                >
                  Comment Only
                </Button>
              </div>
            </div>
          </Card>

        </div>

      </div>
    </div>
  );
};
