import React from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../common/i18n/I18nContext';
import {
  FileText,
  FolderGit2,
  TestTube2,
  PlaySquare,
  Bug,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileCheck2
} from 'lucide-react';
import { Card, Button, Badge } from '../../common/components';

export const DashboardView: React.FC = () => {
  const {
    documents,
    requirements,
    testCases,
    testRuns,
    bugs,
    questions,
    setActiveTab,
    canApprove,
    updateRequirementStatus,
    updateTestCaseStatus,
    setIsAiModalOpen
  } = useApp();

  const { t } = useI18n();

  // Metrics
  const totalDocs = documents.length;
  const approvedDocs = documents.filter(d => d.status === 'Approved').length;

  const totalReqs = requirements.length;
  const approvedReqs = requirements.filter(r => r.status === 'Approved').length;
  const reqsWithTestCases = requirements.filter(r => 
    testCases.some(tc => tc.requirementId === r.id)
  ).length;
  const coveragePercent = totalReqs > 0 ? Math.round((reqsWithTestCases / totalReqs) * 100) : 0;

  const totalTestCases = testCases.length;
  const approvedTestCases = testCases.filter(tc => tc.status === 'Approved' || tc.status === 'Ready for Execution').length;

  // Execution stats across runs
  let totalExecutions = 0;
  let passExecutions = 0;
  let failExecutions = 0;
  let blockedExecutions = 0;

  testRuns.forEach(run => {
    run.records.forEach(rec => {
      totalExecutions++;
      if (rec.status === 'Pass') passExecutions++;
      if (rec.status === 'Fail') failExecutions++;
      if (rec.status === 'Blocked') blockedExecutions++;
    });
  });

  const passRate = totalExecutions > 0 ? Math.round((passExecutions / totalExecutions) * 100) : 0;

  // Pending Items
  const pendingReqs = requirements.filter(r => r.status === 'In Review');
  const pendingTestCases = testCases.filter(tc => tc.status === 'In Review');
  const openBugs = bugs.filter(b => b.status === 'Open' || b.status === 'In Progress');

  return (
    <div className="space-y-6">
      {/* Top Banner with AI-Ready status */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-900/60 via-slate-900 to-slate-900 border border-indigo-500/30 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                AI-Ready Documentation & QA Lifecycle
              </span>
              <span className="text-xs text-slate-400">Proposal v0.1 Specification</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {t('dashTitle')}
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              {t('dashSubtitle')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsAiModalOpen(true)}
              icon={<Sparkles className="w-4 h-4 text-amber-300" />}
            >
              Grounded AI Copilot
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setActiveTab('traceability')}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              {t('navTraceability')}
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Documents */}
        <Card hoverable onClick={() => setActiveTab('documents')}>
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t('dashTotalDocs')}</span>
            <FolderGit2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">{totalDocs}</div>
          <div className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{approvedDocs} {t('dashApprovedBaseline')}</span>
          </div>
        </Card>

        {/* Requirements */}
        <Card hoverable onClick={() => setActiveTab('requirements')}>
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t('dashTotalReqs')}</span>
            <FileText className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white">{totalReqs}</div>
          <div className="text-xs text-indigo-300 flex items-center gap-1 mt-1">
            <span>{approvedReqs} {t('statusApproved')} • {coveragePercent}% {t('dashCovered')}</span>
          </div>
        </Card>

        {/* Test Cases */}
        <Card hoverable onClick={() => setActiveTab('testcases')}>
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t('dashTotalTestCases')}</span>
            <TestTube2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">{totalTestCases}</div>
          <div className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
            <span>{approvedTestCases} {t('dashVerifiedReady')}</span>
          </div>
        </Card>

        {/* Test Runs */}
        <Card hoverable onClick={() => setActiveTab('testruns')}>
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t('dashExecutions')}</span>
            <PlaySquare className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">{totalExecutions}</div>
          <div className="text-xs text-purple-300 flex items-center gap-1 mt-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{passRate}% {t('dashPassRate')}</span>
          </div>
        </Card>

        {/* Bugs */}
        <Card hoverable onClick={() => setActiveTab('bugs')}>
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t('dashActiveDefects')}</span>
            <Bug className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400">{openBugs.length}</div>
          <div className="text-xs text-slate-400 flex items-center gap-1 mt-1">
            <span>{bugs.filter(b => b.severity === 'Critical').length} {t('severityCritical')}</span>
          </div>
        </Card>
      </div>

      {/* Coverage Progress Bar & Quality Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Traceability Coverage Card */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white text-sm">{t('dashCoverageTitle')}</h3>
            <Badge variant="info" size="xs">
              {coveragePercent}% {t('dashCovered')}
            </Badge>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>{t('dashReqMapping')}</span>
                <span>{reqsWithTestCases} / {totalReqs}</span>
              </div>
              <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-500"
                  style={{ width: `${coveragePercent}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>{t('dashPassRateBreakdown')}</span>
                <span>{passExecutions} {t('statusPass')} / {failExecutions} {t('statusFail')} / {blockedExecutions} {t('statusBlocked')}</span>
              </div>
              <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                <div 
                  className="h-full bg-emerald-500"
                  style={{ width: `${totalExecutions ? (passExecutions / totalExecutions) * 100 : 0}%` }}
                />
                <div 
                  className="h-full bg-rose-500"
                  style={{ width: `${totalExecutions ? (failExecutions / totalExecutions) * 100 : 0}%` }}
                />
                <div 
                  className="h-full bg-amber-500"
                  style={{ width: `${totalExecutions ? (blockedExecutions / totalExecutions) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">{t('dashGapsPending')}</span>
            <span className="font-semibold text-amber-400">
              {totalReqs - reqsWithTestCases} pending
            </span>
          </div>
        </Card>

        {/* Pending Review & Approval Queue */}
        <Card className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h3 className="font-semibold text-white text-sm">{t('dashPendingApprovals')}</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {pendingReqs.length + pendingTestCases.length} {t('dashWaitingItems')}
            </span>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto">
            {pendingReqs.length === 0 && pendingTestCases.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                {t('dashNoPending')}
              </div>
            ) : (
              <>
                {pendingReqs.map(req => (
                  <div 
                    key={req.id} 
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs hover:border-slate-700 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-cyan-400 font-semibold">{req.id}</span>
                        <span className="text-slate-200 font-medium">{req.title}</span>
                        <Badge variant="warning">{t('statusInReview')}</Badge>
                      </div>
                      <div className="text-[11px] text-slate-400">Owner: {req.owner} • Approver: {req.approver}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      {canApprove() ? (
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => updateRequirementStatus(req.id, 'Approved')}
                        >
                          {t('actionApprove')}
                        </Button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">{t('dashNeedsApproverRole')}</span>
                      )}
                    </div>
                  </div>
                ))}

                {pendingTestCases.map(tc => (
                  <div 
                    key={tc.id} 
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs hover:border-slate-700 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-emerald-400 font-semibold">{tc.id}</span>
                        <span className="text-slate-200 font-medium">{tc.title}</span>
                        <Badge variant="warning">{t('statusInReview')}</Badge>
                      </div>
                      <div className="text-[11px] text-slate-400">Ref: {tc.requirementId} • {tc.steps.length} steps</div>
                    </div>

                    <div className="flex items-center gap-2">
                      {canApprove() ? (
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => updateTestCaseStatus(tc.id, 'Approved')}
                        >
                          {t('actionApprove')}
                        </Button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">{t('dashNeedsApproverRole')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Clarification Questions & Unconfirmed Assumptions */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <FileCheck2 className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-semibold text-white text-sm">{t('dashClarificationTitle')}</h3>
              <p className="text-xs text-slate-400">{t('dashClarificationSubtitle')}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {questions.map((q) => (
            <div key={q.id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-amber-400">{q.id}</span>
                <Badge variant={q.status === 'Open' ? 'warning' : 'success'}>
                  {q.status}
                </Badge>
              </div>
              <p className="text-xs font-medium text-slate-200">{q.question}</p>
              <p className="text-[11px] text-slate-400 bg-slate-900/80 p-2 rounded border border-slate-800/80">{q.context}</p>
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
                <span>Source: {q.sourceDoc}</span>
                <span>Assignee: {q.assignedTo}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
