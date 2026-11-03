import { Database } from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { EvidenceLevel } from '../ai/skills/schemas.js';

export interface SemanticRiskFactors {
  criticalConflictsCount: number;
  ambiguitiesCount: number;
  unknownTermsCount: number;
  unsupportedInferencesCount: number;
}

export interface SemanticRiskResult {
  riskScore: number; // 0 - 100 capped
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  factors: SemanticRiskFactors;
  breakdown: {
    criticalConflictPenalty: number;
    ambiguityPenalty: number;
    unknownTermPenalty: number;
    unsupportedInferencePenalty: number;
  };
  reviewPriorityOrder: number;
  autoApproveAllowed: false; // Architectural constraint: score is NEVER used to auto-approve
}

export interface CandidateKnowledgeUnit {
  id: string;
  project_id: string;
  unit_type: 'Requirement' | 'BusinessRule' | 'Constraint' | 'Definition';
  content: string;
  subject: string;
  action: string;
  condition?: string;
  evidence_level: EvidenceLevel;
  heading_path?: string;
  char_offset_start?: number;
  char_offset_end?: number;
  exact_quote?: string;
}

export interface DetectedConflict {
  id: string;
  projectId: string;
  unitAId: string;
  unitBId: string;
  conflictType: 'Contradiction' | 'Ambiguity' | 'Redundancy';
  severity: 'Critical' | 'Major' | 'Minor';
  description: string;
}

export class SemanticRiskScorer {
  /**
   * Calculate semantic risk score capped at 100.
   * STRICT RULE: The score is exclusively used for ordering review queues.
   * It MUST NEVER be used to auto-approve any document or knowledge unit.
   */
  public static calculate(factors: SemanticRiskFactors): SemanticRiskResult {
    const criticalConflictPenalty = factors.criticalConflictsCount * 30;
    const ambiguityPenalty = factors.ambiguitiesCount * 15;
    const unknownTermPenalty = factors.unknownTermsCount * 10;
    const unsupportedInferencePenalty = factors.unsupportedInferencesCount * 10;

    const rawTotal = criticalConflictPenalty + ambiguityPenalty + unknownTermPenalty + unsupportedInferencePenalty;
    const riskScore = Math.min(100, Math.max(0, rawTotal));

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (riskScore >= 60) {
      riskLevel = 'HIGH';
    } else if (riskScore >= 30) {
      riskLevel = 'MEDIUM';
    }

    return {
      riskScore,
      riskLevel,
      factors,
      breakdown: {
        criticalConflictPenalty,
        ambiguityPenalty,
        unknownTermPenalty,
        unsupportedInferencePenalty
      },
      reviewPriorityOrder: riskScore,
      autoApproveAllowed: false // Architectural lock: auto-approve via risk score is forbidden
    };
  }
}

export class SemanticValidator {
  /**
   * Validate candidate knowledge unit against already APPROVED knowledge units in the project.
   * Uses structured search & SQLite FTS5 for subject/term matching.
   * Only units with status = 'Approved' are ever consulted as ground truth.
   */
  public static validateAgainstApproved(
    db: Database,
    candidate: CandidateKnowledgeUnit
  ): { conflicts: DetectedConflict[]; riskResult: SemanticRiskResult } {
    // 1. Query ONLY units with status = 'Approved' for this project
    const approvedUnits = db.prepare(`
      SELECT ku.id, ku.subject, ku.action, ku.condition, ku.content, ku.evidence_level, ku.status
      FROM knowledge_units ku
      WHERE ku.project_id = ? AND ku.status = 'Approved'
    `).all(candidate.project_id) as Array<{
      id: string;
      subject: string;
      action: string;
      condition?: string;
      content: string;
      evidence_level: string;
      status: string;
    }>;

    const conflicts: DetectedConflict[] = [];

    // Also leverage FTS5 if candidate subject is available
    const searchSubject = candidate.subject.replace(/[^\w\s]/g, ' ').trim();
    let ftsMatches: Array<{ unit_id: string; subject: string; content: string }> = [];
    if (searchSubject) {
      try {
        ftsMatches = db.prepare(`
          SELECT unit_id, subject, content
          FROM approved_knowledge_fts
          WHERE project_id = ? AND approved_knowledge_fts MATCH ?
        `).all(candidate.project_id, `"${searchSubject}"`) as Array<{ unit_id: string; subject: string; content: string }>;
      } catch {
        // Fallback gracefully on query token error
      }
    }

    const candidateSubjectNorm = candidate.subject.toLowerCase().trim();
    const candidateContentNorm = candidate.content.toLowerCase().trim();

    for (const approved of approvedUnits) {
      const approvedSubjectNorm = approved.subject.toLowerCase().trim();
      const approvedContentNorm = approved.content.toLowerCase().trim();

      const isSubjectMatch =
        candidateSubjectNorm === approvedSubjectNorm ||
        candidateSubjectNorm.includes(approvedSubjectNorm) ||
        approvedSubjectNorm.includes(candidateSubjectNorm) ||
        ftsMatches.some(m => m.unit_id === approved.id);

      if (!isSubjectMatch) {
        continue;
      }

      // Check Exact Redundancy
      if (candidateContentNorm === approvedContentNorm) {
        conflicts.push({
          id: randomUUID(),
          projectId: candidate.project_id,
          unitAId: candidate.id,
          unitBId: approved.id,
          conflictType: 'Redundancy',
          severity: 'Minor',
          description: `Semantically redundant with approved unit ${approved.id}: Identical content.`
        });
        continue;
      }

      // Check Numerical / Value Contradiction (e.g. 15m vs 30m, 50MB vs 100MB, 10000 vs 5000)
      const candidateNumbers: string[] = candidateContentNorm.match(/\d+[\w%]+/g) || [];
      const approvedNumbers: string[] = approvedContentNorm.match(/\d+[\w%]+/g) || [];

      let hasNumberConflict = false;
      if (candidateNumbers.length > 0 && approvedNumbers.length > 0) {
        const hasDifferingNumber = candidateNumbers.some(cn => !approvedNumbers.includes(cn));
        if (hasDifferingNumber) {
          hasNumberConflict = true;
          conflicts.push({
            id: randomUUID(),
            projectId: candidate.project_id,
            unitAId: candidate.id,
            unitBId: approved.id,
            conflictType: 'Contradiction',
            severity: 'Critical',
            description: `Contradiction detected on subject "${candidate.subject}": new value [${candidateNumbers.join(', ')}] conflicts with approved specification [${approvedNumbers.join(', ')}].`
          });
        }
      }

      // Check Affirmative vs Negative Contradiction (e.g. required vs optional / không bắt buộc)
      const affirmativeTerms = ['bắt buộc', 'required', 'mandatory', 'phải'];
      const negativeTerms = ['không bắt buộc', 'optional', 'tùy chọn', 'không yêu cầu'];

      const candHasAffirmative = affirmativeTerms.some(t => candidateContentNorm.includes(t));
      const candHasNegative = negativeTerms.some(t => candidateContentNorm.includes(t));
      const apprHasAffirmative = affirmativeTerms.some(t => approvedContentNorm.includes(t));
      const apprHasNegative = negativeTerms.some(t => approvedContentNorm.includes(t));

      if (!hasNumberConflict && ((candHasAffirmative && apprHasNegative) || (candHasNegative && apprHasAffirmative))) {
        conflicts.push({
          id: randomUUID(),
          projectId: candidate.project_id,
          unitAId: candidate.id,
          unitBId: approved.id,
          conflictType: 'Contradiction',
          severity: 'Critical',
          description: `Direct policy contradiction on "${candidate.subject}": one document specifies mandatory requirement while the other specifies optional.`
        });
      }

      // Check Ambiguity (Differing actions or conditions for same subject without clear override)
      if (
        !hasNumberConflict &&
        candidate.action.toLowerCase() !== approved.action.toLowerCase() &&
        candidate.condition &&
        approved.condition &&
        candidate.condition.toLowerCase() !== approved.condition.toLowerCase()
      ) {
        conflicts.push({
          id: randomUUID(),
          projectId: candidate.project_id,
          unitAId: candidate.id,
          unitBId: approved.id,
          conflictType: 'Ambiguity',
          severity: 'Major',
          description: `Ambiguity detected on subject "${candidate.subject}": differing actions (${candidate.action} vs ${approved.action}) under conflicting conditions.`
        });
      }
    }

    // Persist detected conflicts to database
    const insertConflictStmt = db.prepare(`
      INSERT OR IGNORE INTO conflicts (
        id, project_id, unit_a_id, unit_b_id, conflict_type, severity, description, resolution, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'UNRESOLVED', ?)
    `);

    const now = new Date().toISOString();
    for (const c of conflicts) {
      insertConflictStmt.run(
        c.id,
        c.projectId,
        c.unitAId,
        c.unitBId,
        c.conflictType,
        c.severity,
        c.description,
        now
      );
    }

    // Count factors for risk calculation
    const criticalConflictsCount = conflicts.filter(c => c.severity === 'Critical').length;
    const ambiguitiesCount = conflicts.filter(c => c.conflictType === 'Ambiguity').length + (candidate.evidence_level === 'Unknown' || candidate.evidence_level === 'Not Specified' ? 1 : 0);
    const unknownTermsCount = candidate.content.includes('TBD') || candidate.content.includes('Chưa rõ') ? 1 : 0;
    const unsupportedInferencesCount = (candidate.evidence_level === 'Assumed' || candidate.evidence_level === 'Inferred') && !candidate.exact_quote ? 1 : 0;

    const riskResult = SemanticRiskScorer.calculate({
      criticalConflictsCount,
      ambiguitiesCount,
      unknownTermsCount,
      unsupportedInferencesCount
    });

    return { conflicts, riskResult };
  }
}
