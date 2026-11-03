import { Database } from 'better-sqlite3';

export type StandardTaxonomyCategory =
  | '01_Project_Overview'
  | '02_Business_Requirements'
  | '03_System_Requirements'
  | '04_UI_UX'
  | '05_Technical_Documents'
  | '06_QA'
  | '07_EVD_Evidence'
  | '08_Change_History';

export const ALL_TAXONOMY_CATEGORIES: StandardTaxonomyCategory[] = [
  '01_Project_Overview',
  '02_Business_Requirements',
  '03_System_Requirements',
  '04_UI_UX',
  '05_Technical_Documents',
  '06_QA',
  '07_EVD_Evidence',
  '08_Change_History'
];

export interface ClassificationWeightsConfig {
  pathWeight: number;
  headingWeight: number;
  keywordWeight: number;
}

export const DEFAULT_CLASSIFICATION_WEIGHTS: ClassificationWeightsConfig = {
  pathWeight: 0.35,
  headingWeight: 0.35,
  keywordWeight: 0.30
};

interface CategoryRule {
  pathTokens: string[];
  headingTokens: string[];
  keywords: string[];
}

export const TAXONOMY_RULES: Record<StandardTaxonomyCategory, CategoryRule> = {
  '01_Project_Overview': {
    pathTokens: ['01_project_overview', 'project_overview', 'charter', 'vision', 'tong_quan', 'tổng quan', 'scope', 'milestone', 'wbs'],
    headingTokens: ['tổng quan', 'project overview', 'charter', 'vision', 'mục tiêu', 'phạm vi', 'scope', 'stakeholders', 'lộ trình', 'roadmap', 'wbs'],
    keywords: ['project overview', 'charter', 'vision', 'tổng quan dự án', 'mục tiêu', 'phạm vi', 'scope', 'stakeholders', 'lộ trình', 'roadmap', 'milestones', 'bàn giao']
  },
  '02_Business_Requirements': {
    pathTokens: ['02_business_requirements', 'business_requirement', 'brd', 'payment', 'nghiep_vu', 'nghiệp vụ', 'business_rule', 'user_story', 'quy_trinh', 'quy trình'],
    headingTokens: ['brd', 'business requirement', 'nghiệp vụ', 'quy tắc nghiệp vụ', 'business rule', 'user story', 'quy trình', 'workflow', 'chính sách'],
    keywords: ['brd', 'business requirement', 'nghiệp vụ', 'quy tắc nghiệp vụ', 'business rule', 'user story', 'quy trình', 'workflow', 'chính sách', 'tích điểm', 'voucher', 'merchant', 'onboarding']
  },
  '03_System_Requirements': {
    pathTokens: ['03_system_requirements', 'system_requirement', 'srs', 'functional_spec', 'yeu_cau_he_thong', 'nfr', 'use_case'],
    headingTokens: ['srs', 'system requirement', 'yêu cầu hệ thống', 'yêu cầu chức năng', 'phi chức năng', 'use case', 'functional spec', 'non-functional', 'nfr'],
    keywords: ['srs', 'system requirement', 'yêu cầu hệ thống', 'yêu cầu chức năng', 'phi chức năng', 'use case', 'functional spec', 'non-functional', 'ccu', 'latency', 'xác thực đa nhân tố', 'mfa', 'performance']
  },
  '04_UI_UX': {
    pathTokens: ['04_ui_ux', 'ui_ux', 'wireframe', 'figma', 'design', 'giao_dien', 'giao diện', 'mockup', 'prototype', 'style_guide'],
    headingTokens: ['ui', 'ux', 'wireframe', 'figma', 'design', 'giao diện', 'mockup', 'prototype', 'style guide', 'component', 'layout', 'typography'],
    keywords: ['ui', 'ux', 'wireframe', 'figma', 'design', 'giao diện', 'mockup', 'prototype', 'style guide', 'component', 'layout', 'màu sắc', 'khung lưới', 'responsive', 'zen mode']
  },
  '05_Technical_Documents': {
    pathTokens: ['05_technical_documents', 'tech', 'technical', 'architecture', 'database', 'db_schema', 'api_spec', 'openapi', 'swagger', 'erd', 'ddl'],
    headingTokens: ['architecture', 'database', 'db schema', 'api spec', 'openapi', 'swagger', 'erd', 'kiến trúc', 'endpoint', 'microservices', 'payload', 'ddl'],
    keywords: ['architecture', 'database', 'db schema', 'api spec', 'openapi', 'swagger', 'erd', 'kiến trúc', 'endpoint', 'microservices', 'payload', 'sqlite', 'wal', 'restful', 'khóa ngoại']
  },
  '06_QA': {
    pathTokens: ['06_qa', 'qa', 'qc', 'test_plan', 'test_strategy', 'test_case', 'kiem_thu', 'kiểm thử', 'acceptance_criteria', 'rtm'],
    headingTokens: ['test plan', 'test strategy', 'test case', 'kế hoạch kiểm thử', 'qa', 'qc', 'kịch bản', 'acceptance criteria', 'traceability matrix', 'defect'],
    keywords: ['test plan', 'test strategy', 'test case', 'kế hoạch kiểm thử', 'qa', 'qc', 'kịch bản', 'acceptance criteria', 'traceability matrix', 'defect', 'stg', 'hồi quy', 'regression', 'pass/fail']
  },
  '07_EVD_Evidence': {
    pathTokens: ['07_evd_evidence', 'evd', 'evidence', 'proof', 'screenshot', 'minh_chung', 'bằng chứng', 'uat_signoff', 'execution_log', 'nghiem_thu', 'nghiệm thu'],
    headingTokens: ['evidence', 'proof', 'screenshot', 'minh chứng', 'bằng chứng', 'uat sign-off', 'test execution log', 'audit trail', 'biên bản nghiệm thu'],
    keywords: ['evidence', 'proof', 'screenshot', 'minh chứng', 'bằng chứng', 'uat sign-off', 'test execution log', 'audit trail', 'biên bản nghiệm thu', 'kết quả kiểm thử', 'chữ ký phê duyệt', 'sign-off']
  },
  '08_Change_History': {
    pathTokens: ['08_change_history', 'change_history', 'changelog', 'release_note', 'lich_su_thay_doi', 'lịch sử thay đổi', 'version_history', 'rfc', 'change_request'],
    headingTokens: ['change history', 'changelog', 'release note', 'lịch sử thay đổi', 'nhật ký phát hành', 'version history', 'rfc', 'change request'],
    keywords: ['change history', 'changelog', 'release note', 'lịch sử thay đổi', 'nhật ký phát hành', 'version history', 'rfc', 'change request', 'bản vá lỗi', 'hotfix', 'v0.1.0', 'đề xuất thay đổi']
  }
};

export interface CategoryScoreResult {
  category: StandardTaxonomyCategory;
  score: number;
  pathScore: number;
  headingScore: number;
  keywordScore: number;
  matchedEvidence: {
    matchedPathTerms: string[];
    matchedHeadings: string[];
    topKeywords: string[];
  };
}

export interface ClassificationInput {
  filePath?: string;
  headings?: string[];
  content?: string;
  projectId?: string;
  db?: Database;
  weights?: Partial<ClassificationWeightsConfig>;
}

export interface ClassificationResult {
  primaryCategory: StandardTaxonomyCategory;
  primaryScore: number;
  isAmbiguous: boolean;
  canAutoClassifyWithoutLLM: boolean;
  secondaryCategories: Array<{ category: StandardTaxonomyCategory; score: number }>;
  allScores: Record<StandardTaxonomyCategory, CategoryScoreResult>;
  usedWeights: ClassificationWeightsConfig;
}

export class ClassificationScorer {
  /**
   * Deterministically calculate taxonomy classification scores.
   * Same input strictly produces identical output (deterministic guarantee).
   */
  public static score(input: ClassificationInput): ClassificationResult {
    const weights: ClassificationWeightsConfig = {
      pathWeight: input.weights?.pathWeight ?? DEFAULT_CLASSIFICATION_WEIGHTS.pathWeight,
      headingWeight: input.weights?.headingWeight ?? DEFAULT_CLASSIFICATION_WEIGHTS.headingWeight,
      keywordWeight: input.weights?.keywordWeight ?? DEFAULT_CLASSIFICATION_WEIGHTS.keywordWeight,
    };

    const normalizedPath = (input.filePath || '').toLowerCase();
    const normalizedHeadings = (input.headings || []).map(h => h.toLowerCase().trim());
    const normalizedContent = (input.content || '').toLowerCase();

    const allScores: Record<string, CategoryScoreResult> = {};

    for (const category of ALL_TAXONOMY_CATEGORIES) {
      const rule = TAXONOMY_RULES[category];

      // Helper for token match with word boundary on short words (e.g. "ui", "qa", "qc")
      const matchesToken = (text: string, token: string): boolean => {
        if (token.length <= 3) {
          return new RegExp(`(^|[^a-zA-Z0-9_])${token}([^a-zA-Z0-9_]|$)`, 'i').test(text);
        }
        return text.includes(token.toLowerCase());
      };

      // 1. Path & Filename Matching (35%)
      const matchedPathTerms: string[] = [];
      let pathScore = 0;
      if (normalizedPath) {
        const pathVariations = [
          normalizedPath,
          normalizedPath.replace(/[_\-]/g, ' '),
          normalizedPath.replace(/[\s\-]/g, '_')
        ];
        // Direct category folder code matching gets full 1.0
        if (pathVariations.some(p => p.includes(category.toLowerCase()) || p.includes(category.toLowerCase().replace(/_/g, ' ')))) {
          pathScore = 1.0;
          matchedPathTerms.push(category);
        } else {
          for (const token of rule.pathTokens) {
            const tokenVariations = [
              token.toLowerCase(),
              token.toLowerCase().replace(/[_\-]/g, ' '),
              token.toLowerCase().replace(/[\s\-]/g, '_')
            ];
            if (pathVariations.some(p => tokenVariations.some(tv => matchesToken(p, tv)))) {
              matchedPathTerms.push(token);
            }
          }
          if (matchedPathTerms.length > 0) {
            pathScore = Math.min(1.0, 0.5 + matchedPathTerms.length * 0.25);
          }
        }
      }

      // 2. Headings Matching (35%)
      const matchedHeadings: string[] = [];
      let headingScore = 0;
      if (normalizedHeadings.length > 0) {
        for (const heading of normalizedHeadings) {
          for (const token of rule.headingTokens) {
            if (matchesToken(heading, token)) {
              matchedHeadings.push(heading);
              break;
            }
          }
        }
        if (matchedHeadings.length > 0) {
          headingScore = Math.min(1.0, matchedHeadings.length / Math.min(normalizedHeadings.length, 3));
        }
      }

      // 3. Keyword Density Matching (30%)
      const topKeywords: string[] = [];
      let keywordHits = 0;
      let keywordScore = 0;
      if (normalizedContent) {
        for (const kw of rule.keywords) {
          const kwLower = kw.toLowerCase();
          let count = 0;
          let pos = normalizedContent.indexOf(kwLower);
          while (pos !== -1) {
            count++;
            pos = normalizedContent.indexOf(kwLower, pos + kwLower.length);
          }
          if (count > 0) {
            keywordHits += count;
            topKeywords.push(`${kw} (${count})`);
          }
        }
        if (keywordHits > 0) {
          keywordScore = Math.min(1.0, keywordHits / 5);
        }
      }

      // If FTS5 is available and matching approved knowledge units in project, add subtle grounding (BUG-024)
      if (input.db && input.projectId && normalizedContent.length > 20) {
        try {
          const tokens = normalizedContent.slice(0, 60)
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .trim()
            .split(/\s+/)
            .filter(t => t.length > 1)
            .slice(0, 5);
          if (tokens.length > 0) {
            const ftsQuery = tokens.map(t => `"${t.replace(/"/g, '""')}"`).join(' OR ');
            const ftsMatch = input.db.prepare(`
              SELECT count(*) as cnt FROM approved_knowledge_fts
              WHERE project_id = ? AND approved_knowledge_fts MATCH ?
            `).get(input.projectId, ftsQuery) as { cnt: number } | undefined;
            if (ftsMatch && ftsMatch.cnt > 0) {
              keywordScore = Math.min(1.0, keywordScore + 0.05);
            }
          }
        } catch {
          // Fallback gracefully if FTS query syntax error on weird characters
        }
      }

      // Total Weighted Score
      const totalScore = Math.min(1.0, Number((
        weights.pathWeight * pathScore +
        weights.headingWeight * headingScore +
        weights.keywordWeight * keywordScore
      ).toFixed(4)));

      allScores[category] = {
        category,
        score: totalScore,
        pathScore: Number(pathScore.toFixed(4)),
        headingScore: Number(headingScore.toFixed(4)),
        keywordScore: Number(keywordScore.toFixed(4)),
        matchedEvidence: {
          matchedPathTerms,
          matchedHeadings,
          topKeywords
        }
      };
    }

    // Sort categories descending by score
    const sorted = Object.values(allScores).sort((a, b) => b.score - a.score);
    const top = sorted[0];

    const isAmbiguous = top.score < 0.40;
    const canAutoClassifyWithoutLLM = top.score >= 0.75;

    const secondaryCategories = sorted
      .slice(1)
      .filter(s => s.score >= 0.35)
      .map(s => ({ category: s.category, score: s.score }));

    return {
      primaryCategory: top.category,
      primaryScore: top.score,
      isAmbiguous,
      canAutoClassifyWithoutLLM,
      secondaryCategories,
      allScores: allScores as Record<StandardTaxonomyCategory, CategoryScoreResult>,
      usedWeights: weights
    };
  }
}
