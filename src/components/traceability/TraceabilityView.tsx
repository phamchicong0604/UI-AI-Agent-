import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../common/i18n/I18nContext';
import {
  AlertCircle,
  CheckCircle2,
  Download
} from 'lucide-react';
import { Button, Badge, Card } from '../../common/components';
import { downloadCsv } from '../../common/utils/export';
import { RequirementItem, DocumentItem, TestCaseItem, TestRunItem, BugItem, EvidenceItem } from '../../types';

export interface TraceabilityRow {
  requirement: RequirementItem;
  document: DocumentItem | undefined;
  testCases: TestCaseItem[];
  executions: any[];
  evidences: EvidenceItem[];
  bugs: BugItem[];
  hasGap: boolean;
  hasFailures: boolean;
  hasBugs: boolean;
}

export function buildTraceabilityRows(
  requirements: RequirementItem[],
  documents: DocumentItem[],
  testCases: TestCaseItem[],
  testRuns: TestRunItem[],
  evidences: EvidenceItem[],
  bugs: BugItem[]
): TraceabilityRow[] {
  return requirements.map(req => {
    const linkedDoc = documents.find(d => d.id === req.sourceReferences[0]?.documentId);
    const linkedTests = testCases.filter(t => t.requirementId === req.id);
    
    // Find runs where these tests ran
    const runRecords = testRuns.flatMap(run => 
      run.records.filter(r => linkedTests.some(lt => lt.id === r.testCaseId))
        .map(r => ({ ...r, runId: run.id, env: run.environment, build: run.buildVersion }))
    );

    // Linked evidences
    const linkedEvdIds = Array.from(new Set([
      ...linkedTests.flatMap(t => t.relatedEvidenceIds),
      ...runRecords.flatMap(r => r.evidenceIds)
    ]));
    const linkedEvds = evidences.filter(e => linkedEvdIds.includes(e.id));

    // Linked bugs
    const linkedBugs = bugs.filter(b => 
      b.linkedRequirementId === req.id ||
      linkedTests.some(lt => lt.id === b.linkedTestCaseId) ||
      runRecords.some(r => r.runId === b.linkedTestRunId)
    );

    const hasGap = linkedTests.length === 0;
    const hasFailures = runRecords.some(r => r.status === 'Fail');
    const hasBugs = linkedBugs.length > 0;

    return {
      requirement: req,
      document: linkedDoc,
      testCases: linkedTests,
      executions: runRecords,
      evidences: linkedEvds,
      bugs: linkedBugs,
      hasGap,
      hasFailures,
      hasBugs
    };
  });
}

export const TraceabilityView: React.FC = () => {
  const {
    documents,
    requirements,
    testCases,
    testRuns,
    bugs,
    evidences,
    setSelectedTestCaseId,
    setActiveTab
  } = useApp();

  const { t } = useI18n();

  const [filterMode, setFilterMode] = useState<'ALL' | 'GAPS_ONLY' | 'FAILURES_ONLY' | 'WITH_BUGS'>('ALL');

  // Compute coverage data via canonical exported engine
  const matrixRows = useMemo(() => 
    buildTraceabilityRows(requirements, documents, testCases, testRuns, evidences, bugs),
    [requirements, documents, testCases, testRuns, evidences, bugs]
  );

  const filteredRows = matrixRows.filter(row => {
    if (filterMode === 'GAPS_ONLY') return row.hasGap;
    if (filterMode === 'FAILURES_ONLY') return row.hasFailures;
    if (filterMode === 'WITH_BUGS') return row.hasBugs;
    return true;
  });

  const totalReqs = requirements.length;
  const gapCount = matrixRows.filter(r => r.hasGap).length;
  const coveredCount = totalReqs - gapCount;
  const coveragePercent = totalReqs > 0 ? Math.round((coveredCount / totalReqs) * 100) : 0;

  const handleExportCSV = () => {
    const headers = [
      t('traceExportSourceDoc'),
      t('traceExportVersion'),
      t('traceExportReqId'),
      t('traceExportReqTitle'),
      t('traceExportStatus'),
      t('traceExportTestCases'),
      t('traceExportExecutions'),
      t('traceExportEvidences'),
      t('traceExportBugs')
    ];

    const rows = filteredRows.map(r => [
      r.document?.title || 'N/A',
      r.document?.currentVersion || '',
      r.requirement.id,
      r.requirement.title,
      r.requirement.status,
      r.testCases.map(tc => tc.id).join('; ') || t('traceNoTestCases'),
      r.executions.map(e => `${e.testCaseId}:${e.status}`).join('; ') || t('statusNotRun'),
      r.evidences.map(e => e.id).join('; '),
      r.bugs.map(b => `${b.id}(${b.severity})`).join('; ') || t('traceNoBugs')
    ]);

    downloadCsv(`Traceability_Matrix_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">{t('traceTitle')}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{t('traceSubtitle')}</p>
        </div>

        <Button
          variant="secondary"
          onClick={handleExportCSV}
          icon={<Download className="w-4 h-4 text-indigo-400" />}
        >
          {t('actionExportCsv')}
        </Button>
      </div>

      {/* Coverage Status Bar (AC-08 Criterion) */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-base font-mono">
            {coveragePercent}%
          </div>
          <div>
            <div className="text-sm font-bold text-white">{t('traceOverallCoverage')}</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {coveredCount} / {totalReqs} {t('dashTotalReqs').toLowerCase()} {t('dashCovered').toLowerCase()}
            </div>
          </div>
        </div>

        {gapCount > 0 ? (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-300">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>{gapCount} {t('traceGapWarning')}</strong>
            </span>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{t('traceAllCovered')}</span>
          </div>
        )}
      </div>

      {/* Filter and View Mode Toolbar */}
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">{t('actionFilter')}:</span>
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filterMode === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
            }`}
          >
            {t('actionAll')} ({matrixRows.length})
          </button>
          <button
            onClick={() => setFilterMode('GAPS_ONLY')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              filterMode === 'GAPS_ONLY' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-amber-300 hover:bg-slate-750'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{t('traceFilterGaps')} ({gapCount})</span>
          </button>
          <button
            onClick={() => setFilterMode('FAILURES_ONLY')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filterMode === 'FAILURES_ONLY' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
            }`}
          >
            {t('traceFilterFailures')}
          </button>
          <button
            onClick={() => setFilterMode('WITH_BUGS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filterMode === 'WITH_BUGS' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
            }`}
          >
            {t('traceFilterBugs')}
          </button>
        </div>

        <div className="text-slate-400 text-xs font-mono">
          {filteredRows.length} routes
        </div>
      </div>

      {/* Traceability Table Matrix View */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3.5 pl-4">{t('traceColDoc')}</th>
                <th className="p-3.5">{t('traceColReq')}</th>
                <th className="p-3.5">{t('traceColTest')}</th>
                <th className="p-3.5">{t('traceColRun')}</th>
                <th className="p-3.5">{t('traceColEvd')}</th>
                <th className="p-3.5 pr-4">{t('traceColBug')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredRows.map((row) => (
                <tr 
                  key={row.requirement.id}
                  className={`hover:bg-slate-850/50 transition-colors ${
                    row.hasGap ? 'bg-amber-950/10' : ''
                  }`}
                >
                  {/* Column 1: Source Document */}
                  <td className="p-3.5 pl-4 align-top w-48">
                    {row.document ? (
                      <div className="space-y-1">
                        <div className="font-semibold text-white line-clamp-2">{row.document.title}</div>
                        <div className="font-mono text-[11px] text-indigo-400">
                          {row.document.currentVersion} • {row.document.status}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {row.requirement.sourceReferences[0]?.section}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">No doc ref</span>
                    )}
                  </td>

                  {/* Column 2: Requirement */}
                  <td className="p-3.5 align-top w-56">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-cyan-400">{row.requirement.id}</span>
                        <Badge variant={row.requirement.status === 'Approved' ? 'success' : 'warning'}>
                          {row.requirement.status}
                        </Badge>
                      </div>
                      <div className="font-medium text-slate-200 line-clamp-2">{row.requirement.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {row.requirement.acceptanceCriteria.length} ACs
                      </div>
                    </div>
                  </td>

                  {/* Column 3: Test Cases */}
                  <td className="p-3.5 align-top w-56">
                    {row.testCases.length > 0 ? (
                      <div className="space-y-1.5">
                        {row.testCases.map(tc => (
                          <div
                            key={tc.id}
                            onClick={() => {
                              setSelectedTestCaseId(tc.id);
                              setActiveTab('testcases');
                            }}
                            className="p-1.5 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition-all space-y-0.5"
                          >
                            <div className="flex items-center justify-between font-mono">
                              <span className="font-bold text-emerald-400">{tc.id}</span>
                              <span className="text-[9px] text-slate-400">{tc.status}</span>
                            </div>
                            <div className="text-[11px] text-slate-300 line-clamp-1">{tc.title}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Coverage Gap (0 Cases)</span>
                      </div>
                    )}
                  </td>

                  {/* Column 4: Test Run Execution */}
                  <td className="p-3.5 align-top w-48">
                    {row.executions.length > 0 ? (
                      <div className="space-y-1.5">
                        {row.executions.map((exec, idx) => (
                          <div key={idx} className="p-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] space-y-0.5">
                            <div className="flex items-center justify-between font-mono">
                              <span className="text-purple-300 font-semibold">{exec.runId}</span>
                              <Badge variant={exec.status === 'Pass' ? 'success' : exec.status === 'Fail' ? 'danger' : 'neutral'}>
                                {exec.status}
                              </Badge>
                            </div>
                            <div className="text-slate-400 text-[10px] truncate">{exec.actualResult || 'Executed'}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">Not executed</span>
                    )}
                  </td>

                  {/* Column 5: Evidence */}
                  <td className="p-3.5 align-top w-44">
                    {row.evidences.length > 0 ? (
                      <div className="space-y-1">
                        {row.evidences.map(evd => (
                          <div key={evd.id} className="p-1 rounded bg-slate-950 border border-slate-800 text-[11px] flex items-center justify-between">
                            <span className="font-mono text-cyan-400 font-semibold">{evd.id}</span>
                            <span className="text-slate-400 text-[10px] truncate max-w-[80px]">{evd.type}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">No EVD</span>
                    )}
                  </td>

                  {/* Column 6: Bugs */}
                  <td className="p-3.5 pr-4 align-top w-48">
                    {row.bugs.length > 0 ? (
                      <div className="space-y-1.5">
                        {row.bugs.map(bug => (
                          <div key={bug.id} className="p-1.5 rounded-lg bg-rose-950/20 border border-rose-500/30 text-[11px] space-y-0.5">
                            <div className="flex items-center justify-between font-mono">
                              <span className="font-bold text-rose-400">{bug.id}</span>
                              <Badge variant="danger">{bug.status}</Badge>
                            </div>
                            <div className="text-slate-200 line-clamp-1">{bug.title}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-emerald-400 text-xs font-mono">Clean (0 Bugs)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
