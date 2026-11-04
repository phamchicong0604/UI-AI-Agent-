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

    const STOP_WORDS = new Set([
      'hệ', 'thống', 'của', 'và', 'các', 'cho', 'trong', 'với', 'khi', 'được', 'là',
      'tại', 'về', 'này', 'đó', 'thì', 'theo', 'như', 'những', 'một', 'hai', 'ba',
      'thời', 'gian',
      'the', 'a', 'an', 'of', 'in', 'on', 'to', 'for', 'with', 'by', 'at', 'and', 'or', 'is', 'are'
    ]);

    const extractSignificantTokens = (text: string): string[] => {
      return text
        .normalize('NFC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 3 && !STOP_WORDS.has(t));
    };

    // Subject matching tokens with NFC normalization (R3-14)
    const searchSubject = candidate.subject.normalize('NFC').trim();
    const candidateSubjectNorm = candidate.subject.normalize('NFC').toLowerCase().trim();
    const candidateContentNorm = candidate.content.normalize('NFC').toLowerCase().trim();
    const candidateSigTokens = extractSignificantTokens(candidateSubjectNorm);

    // Also leverage FTS5 with AND of significant tokens if >= 2 available (BUG-015, BUG-024)
    let ftsMatches: Array<{ unit_id: string; subject: string; content: string }> = [];
    if (candidateSigTokens.length >= 2) {
      try {
        const ftsQuery = candidateSigTokens.slice(0, 4).map(t => `"${t.replace(/"/g, '""')}"`).join(' AND ');
        ftsMatches = db.prepare(`
          SELECT unit_id, subject, content
          FROM approved_knowledge_fts
          WHERE project_id = ? AND approved_knowledge_fts MATCH ?
        `).all(candidate.project_id, ftsQuery) as Array<{ unit_id: string; subject: string; content: string }>;
      } catch {
        // Fallback gracefully on query token error
      }
    }

    for (const approved of approvedUnits) {
      const approvedSubjectNorm = approved.subject.normalize('NFC').toLowerCase().trim();
      const approvedContentNorm = approved.content.normalize('NFC').toLowerCase().trim();
      const approvedSigTokens = extractSignificantTokens(approvedSubjectNorm);

      let isSubjectMatch = false;
      if (candidateSubjectNorm === approvedSubjectNorm) {
        isSubjectMatch = true;
      } else if (ftsMatches.some(m => m.unit_id === approved.id)) {
        isSubjectMatch = true;
      } else if (candidateSigTokens.length > 0 && approvedSigTokens.length > 0) {
        const commonTokens = candidateSigTokens.filter(t => approvedSigTokens.includes(t));
        if (candidateSigTokens.length === 1 && approvedSigTokens.length === 1) {
          isSubjectMatch = candidateSigTokens[0] === approvedSigTokens[0] && candidateSigTokens[0].length >= 4;
        } else {
          isSubjectMatch = commonTokens.length >= 2;
        }
      }

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

      // Check Numerical / Value Contradiction with STRICT UNIT MATCHING (BUG-015, R3-14)
      // Never compare bare unitless numbers like "bước 1" vs "bước 2". Only compare matching physical/logical units!
      // Supports Vietnamese decimal comma (e.g., "1,5 giờ" -> 1.5) and avoids false alarms on multi-choice lists (R3-14)
      interface UnitValue {
        raw: string;
        value: number;
        unit: string;
      }

      const extractNumbersWithUnits = (text: string): UnitValue[] => {
        // Unicode-aware regex supporting decimal commas (1,5 giờ) and dots (1.5h) (R3-14)
        const regex = /(?:^|[^\p{L}\p{N}])(\d+(?:[.,]\d+)?)\s*(phút|giây|giờ|ngày|tháng|năm|lần|ms|s|m|h|mb|gb|kb|tb|ccu|user|users|người|%|vnd|usd|px)(?=[^\p{L}\p{N}]|$)/gui;
        const results: UnitValue[] = [];
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
          const normalizedNumStr = match[1].replace(',', '.');
          const val = parseFloat(normalizedNumStr);
          let u = match[2].toLowerCase();
          if (u === 's') u = 'giây';
          else if (u === 'm') u = 'phút';
          else if (u === 'h') u = 'giờ';
          else if (u === 'users' || u === 'user') u = 'người';
          results.push({ raw: `${match[1]} ${match[2]}`.trim(), value: val, unit: u });
        }
        return results;
      };

      const candidateUnits = extractNumbersWithUnits(candidateContentNorm);
      const approvedUnitsList = extractNumbersWithUnits(approvedContentNorm);

      let hasNumberConflict = false;
      if (candidateUnits.length > 0 && approvedUnitsList.length > 0) {
        for (const cu of candidateUnits) {
          const matchingApproved = approvedUnitsList.filter(au => au.unit === cu.unit);
          if (matchingApproved.length === 0) continue;

          // If the candidate value matches any of the approved values with this unit, it's valid (e.g. from an approved list/options)
          if (matchingApproved.some(au => Math.abs(au.value - cu.value) < 1e-6)) {
            continue;
          }

          // Conflict detected: none of the approved specs match the candidate's value
          const firstApproved = matchingApproved[0];
          hasNumberConflict = true;
          conflicts.push({
            id: randomUUID(),
            projectId: candidate.project_id,
            unitAId: candidate.id,
            unitBId: approved.id,
            conflictType: 'Contradiction',
            severity: 'Critical',
            description: `Contradiction detected on subject "${candidate.subject}": new value [${cu.raw}] conflicts with approved specification [${firstApproved.raw}].`
          });
          break;
        }
      }

      // Check Affirmative vs Negative Contradiction (BUG-015: Only strict obligation terms, never common words like "yêu cầu" or "phải")
      const negativeTerms = ['không bắt buộc', 'không yêu cầu', 'không cần', 'chưa bắt buộc', 'optional', 'tùy chọn', 'not required'];
      const affirmativeTerms = ['bắt buộc', 'bắt buộc phải', 'mandatory', 'strictly required'];

      const candHasNegative = negativeTerms.some(t => candidateContentNorm.includes(t));
      const candHasAffirmative = !candHasNegative && affirmativeTerms.some(t => candidateContentNorm.includes(t));

      const apprHasNegative = negativeTerms.some(t => approvedContentNorm.includes(t));
      const apprHasAffirmative = !apprHasNegative && affirmativeTerms.some(t => approvedContentNorm.includes(t));

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
