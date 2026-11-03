import { Database } from 'better-sqlite3';

export interface SkillUsageMetric {
  skillId: string;
  skillName: string;
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  errorRate: number; // 0 - 100%
  totalTokensPrompt: number;
  totalTokensCompletion: number;
  estimatedCostUsd: number;
  avgLatencyMs: number;
}

export interface ModelUsageMetric {
  modelId: string;
  provider: string;
  totalRuns: number;
  totalTokens: number;
  estimatedCostUsd: number;
  avgLatencyMs: number;
}

export interface HumanCorrectionRateMetric {
  skillVersionId: string;
  skillName: string;
  version: string;
  totalDecisions: number;
  approvedCount: number;
  rejectedCount: number;
  correctionRate: number; // percentage of AI output rejected or edited
}

export interface ObservabilityReport {
  summary: {
    totalRuns: number;
    successRuns: number;
    failedRuns: number;
    overallErrorRate: number;
    totalTokens: number;
    totalTokensPrompt: number;
    totalTokensCompletion: number;
    totalCostEstimateUsd: number;
    avgLatencyMs: number;
  };
  skillsBreakdown: SkillUsageMetric[];
  modelsBreakdown: ModelUsageMetric[];
  humanCorrectionRates: HumanCorrectionRateMetric[];
}

export class ObservabilityService {
  /**
   * Aggregate AI pipeline usage metrics from SQLite pipeline_runs and review_decisions
   */
  public static getObservabilityReport(db: Database): ObservabilityReport {
    // 1. Overall Summary
    const summaryRow = db.prepare(`
      SELECT 
        COUNT(*) as totalRuns,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as successRuns,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failedRuns,
        COALESCE(SUM(tokens_prompt), 0) as totalTokensPrompt,
        COALESCE(SUM(tokens_completion), 0) as totalTokensCompletion,
        COALESCE(AVG(latency_ms), 0) as avgLatencyMs
      FROM pipeline_runs
    `).get() as any;

    const totalRuns = summaryRow?.totalRuns || 0;
    const successRuns = summaryRow?.successRuns || 0;
    const failedRuns = summaryRow?.failedRuns || 0;
    const totalTokensPrompt = summaryRow?.totalTokensPrompt || 0;
    const totalTokensCompletion = summaryRow?.totalTokensCompletion || 0;
    const totalTokens = totalTokensPrompt + totalTokensCompletion;
    const avgLatencyMs = Math.round(summaryRow?.avgLatencyMs || 0);
    const overallErrorRate = totalRuns > 0 ? Number(((failedRuns / totalRuns) * 100).toFixed(2)) : 0;

    // Approximate cost: $0.15 per 1M prompt tokens, $0.60 per 1M completion tokens for Gemini 1.5/2.0 Flash
    const totalCostEstimateUsd = Number(
      ((totalTokensPrompt * 0.00000015) + (totalTokensCompletion * 0.00000060)).toFixed(6)
    );

    // 2. Skills Breakdown
    const skillRows = db.prepare(`
      SELECT 
        s.id as skillId,
        s.name as skillName,
        COUNT(pr.id) as totalRuns,
        SUM(CASE WHEN pr.status = 'COMPLETED' THEN 1 ELSE 0 END) as successRuns,
        SUM(CASE WHEN pr.status = 'FAILED' THEN 1 ELSE 0 END) as failedRuns,
        COALESCE(SUM(pr.tokens_prompt), 0) as tokensPrompt,
        COALESCE(SUM(pr.tokens_completion), 0) as tokensCompletion,
        COALESCE(AVG(pr.latency_ms), 0) as avgLatency
      FROM skills s
      JOIN skill_versions sv ON sv.skill_id = s.id
      LEFT JOIN pipeline_runs pr ON pr.skill_version_id = sv.id
      GROUP BY s.id, s.name
    `).all() as any[];

    const skillsBreakdown: SkillUsageMetric[] = skillRows.map(r => {
      const runs = r.totalRuns || 0;
      const fails = r.failedRuns || 0;
      const tPrompt = r.tokensPrompt || 0;
      const tComp = r.tokensCompletion || 0;
      const cost = Number(((tPrompt * 0.00000015) + (tComp * 0.00000060)).toFixed(6));

      return {
        skillId: r.skillId,
        skillName: r.skillName,
        totalRuns: runs,
        successRuns: r.successRuns || 0,
        failedRuns: fails,
        errorRate: runs > 0 ? Number(((fails / runs) * 100).toFixed(2)) : 0,
        totalTokensPrompt: tPrompt,
        totalTokensCompletion: tComp,
        estimatedCostUsd: cost,
        avgLatencyMs: Math.round(r.avgLatency || 0)
      };
    });

    // 3. Models Breakdown
    const modelRows = db.prepare(`
      SELECT 
        model_id as modelId,
        provider,
        COUNT(*) as totalRuns,
        COALESCE(SUM(tokens_prompt + tokens_completion), 0) as totalTokens,
        COALESCE(SUM(tokens_prompt), 0) as tPrompt,
        COALESCE(SUM(tokens_completion), 0) as tComp,
        COALESCE(AVG(latency_ms), 0) as avgLatency
      FROM pipeline_runs
      GROUP BY model_id, provider
    `).all() as any[];

    const modelsBreakdown: ModelUsageMetric[] = modelRows.map(r => {
      const tPrompt = r.tPrompt || 0;
      const tComp = r.tComp || 0;
      const cost = Number(((tPrompt * 0.00000015) + (tComp * 0.00000060)).toFixed(6));

      return {
        modelId: r.modelId,
        provider: r.provider,
        totalRuns: r.totalRuns || 0,
        totalTokens: r.totalTokens || 0,
        estimatedCostUsd: cost,
        avgLatencyMs: Math.round(r.avgLatency || 0)
      };
    });

    // 4. Human Correction Rate (E10-T2)
    // Measure rejection / correction rate per skill version
    const correctionRows = db.prepare(`
      SELECT 
        sv.id as skillVersionId,
        s.name as skillName,
        sv.version as version,
        COUNT(DISTINCT rd.id) as totalDecisions,
        COUNT(DISTINCT CASE WHEN rd.decision = 'Approve' THEN rd.id END) as approvedCount,
        COUNT(DISTINCT CASE WHEN rd.decision = 'Reject' THEN rd.id END) as rejectedCount
      FROM skill_versions sv
      JOIN skills s ON s.id = sv.skill_id
      LEFT JOIN pipeline_runs pr ON pr.skill_version_id = sv.id
      LEFT JOIN review_decisions rd ON rd.target_id = pr.id OR rd.target_id = pr.document_version_id
      GROUP BY sv.id, s.name, sv.version
    `).all() as any[];

    const humanCorrectionRates: HumanCorrectionRateMetric[] = correctionRows.map(r => {
      const total = r.totalDecisions || 0;
      const rejected = r.rejectedCount || 0;
      const correctionRate = total > 0 ? Number(((rejected / total) * 100).toFixed(2)) : 0;

      return {
        skillVersionId: r.skillVersionId,
        skillName: r.skillName,
        version: r.version,
        totalDecisions: total,
        approvedCount: r.approvedCount || 0,
        rejectedCount: rejected,
        correctionRate
      };
    });

    return {
      summary: {
        totalRuns,
        successRuns,
        failedRuns,
        overallErrorRate,
        totalTokens,
        totalTokensPrompt,
        totalTokensCompletion,
        totalCostEstimateUsd,
        avgLatencyMs
      },
      skillsBreakdown,
      modelsBreakdown,
      humanCorrectionRates
    };
  }
}
