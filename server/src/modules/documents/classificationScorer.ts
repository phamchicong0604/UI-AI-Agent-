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

/** Number of distinct taxonomy terms in the content that counts as a full keyword signal */
const KEYWORD_SATURATION = 6;
/** Occurrences of one term beyond this are ignored when comparing folders */
const KEYWORD_REPEAT_CAP = 3;
/** Minimum lead of the best folder over the runner-up to classify without human confirmation */
const AMBIGUITY_MARGIN = 0.10;

interface CategoryRule {
  pathTokens: string[];
  headingTokens: string[];
  keywords: string[];
}

export const TAXONOMY_RULES: Record<StandardTaxonomyCategory, CategoryRule> = {
  '01_Project_Overview': {
    pathTokens: ['01_project_overview', 'project_overview', 'charter', 'vision', 'tong_quan', 'tổng quan', 'scope', 'milestone', 'wbs',
      'overview', 'introduction', 'gioi_thieu', 'tam_nhin', 'pham_vi', 'kickoff', 'roadmap'],
    headingTokens: ['tổng quan', 'project overview', 'charter', 'vision', 'mục tiêu', 'phạm vi', 'scope', 'stakeholders', 'lộ trình', 'roadmap', 'wbs',
      'tầm nhìn', 'giới thiệu', 'các bên liên quan', 'các bên tham gia', 'objective', 'goal', 'purpose', 'milestone', 'các mốc', 'timeline', 'kế hoạch tổng thể', 'tổ chức dự án', 'lý do thực hiện'],
    keywords: ['project overview', 'charter', 'vision', 'tổng quan dự án', 'mục tiêu', 'phạm vi', 'scope', 'stakeholders', 'lộ trình', 'roadmap', 'milestones', 'bàn giao',
      'tầm nhìn', 'mục tiêu kinh doanh', 'các bên liên quan', 'nhà tài trợ', 'sponsor', 'objective', 'goal', 'giai đoạn', 'phase', 'timeline', 'kickoff', 'in scope', 'out of scope', 'ngoài phạm vi', 'trong phạm vi', 'pilot', 'rollout', 'dự án']
  },
  '02_Business_Requirements': {
    pathTokens: ['02_business_requirements', 'business_requirement', 'brd', 'payment', 'nghiep_vu', 'nghiệp vụ', 'business_rule', 'user_story', 'quy_trinh', 'quy trình',
      'business', 'quy_tac', 'quy_dinh', 'chinh_sach', 'policy'],
    headingTokens: ['brd', 'business requirement', 'nghiệp vụ', 'quy tắc nghiệp vụ', 'business rule', 'user story', 'quy trình', 'workflow', 'chính sách',
      'quy định', 'quy tắc', 'policy', 'rule', 'story', 'điều kiện', 'ngoại lệ', 'exception', 'thẩm quyền', 'approval', 'business process', 'cách tính', 'entitlement', 'đối tượng áp dụng'],
    keywords: ['brd', 'business requirement', 'nghiệp vụ', 'quy tắc nghiệp vụ', 'business rule', 'user story', 'quy trình', 'workflow', 'chính sách', 'tích điểm', 'voucher', 'merchant', 'onboarding',
      'quy định', 'quy tắc', 'policy', 'phê duyệt', 'thẩm quyền', 'ngoại lệ', 'exception', 'business process', 'so that', 'chiết khấu', 'hạn mức', 'approved by', 'duyệt', 'áp dụng', 'hợp đồng', 'commission', 'entitlement']
  },
  '03_System_Requirements': {
    pathTokens: ['03_system_requirements', 'system_requirement', 'srs', 'functional_spec', 'yeu_cau_he_thong', 'nfr', 'use_case',
      'dac_ta', 'yeu_cau_chuc_nang', 'yeu_cau_phan_mem', 'software_requirement', 'functional_requirement'],
    headingTokens: ['srs', 'system requirement', 'yêu cầu hệ thống', 'yêu cầu chức năng', 'phi chức năng', 'use case', 'functional spec', 'non-functional', 'nfr',
      'functional requirement', 'software requirement', 'yêu cầu phần mềm', 'đặc tả', 'ca sử dụng', 'quality attribute', 'ràng buộc', 'constraint', 'the system shall', 'chức năng'],
    keywords: ['srs', 'system requirement', 'yêu cầu hệ thống', 'yêu cầu chức năng', 'phi chức năng', 'use case', 'functional spec', 'non-functional', 'ccu', 'latency', 'xác thực đa nhân tố', 'mfa', 'performance',
      'the system shall', 'shall', 'hệ thống phải', 'functional requirement', 'ca sử dụng', 'tác nhân', 'actor', 'luồng chính', 'main flow', 'alternative flow', 'luồng thay thế', 'đồng thời', 'concurrent', 'thời gian phản hồi', 'fr-01', 'nfr-01']
  },
  '04_UI_UX': {
    pathTokens: ['04_ui_ux', 'ui_ux', 'wireframe', 'figma', 'design', 'giao_dien', 'giao diện', 'mockup', 'prototype', 'style_guide',
      'ui', 'ux', 'layout', 'screen', 'man_hinh'],
    headingTokens: ['ui', 'ux', 'wireframe', 'figma', 'design', 'giao diện', 'mockup', 'prototype', 'style guide', 'component', 'layout', 'typography',
      'screen', 'màn hình', 'bố cục', 'color', 'colour', 'màu', 'spacing', 'icon', 'kiểu chữ', 'phông chữ', 'thành phần', 'responsive', 'dark mode', 'accessibility', 'visual', 'tương tác', 'interaction'],
    keywords: ['ui', 'ux', 'wireframe', 'figma', 'design', 'giao diện', 'mockup', 'prototype', 'style guide', 'component', 'layout', 'màu sắc', 'khung lưới', 'responsive', 'zen mode',
      'màn hình', 'bố cục', 'button', 'nút', 'màu', 'color', 'colour', 'typography', 'phông', 'padding', 'icon', 'biểu tượng', 'px', 'hover', 'di chuột', 'toggle', 'sidebar', 'lưới', 'grid', 'contrast', 'toast', 'dialog']
  },
  '05_Technical_Documents': {
    pathTokens: ['05_technical_documents', 'tech', 'technical', 'architecture', 'database', 'db_schema', 'api_spec', 'openapi', 'swagger', 'erd', 'ddl',
      'kien_truc', 'schema', 'api', 'ha_tang', 'infra', 'deploy', 'co_so_du_lieu'],
    headingTokens: ['architecture', 'database', 'db schema', 'api spec', 'openapi', 'swagger', 'erd', 'kiến trúc', 'endpoint', 'microservices', 'payload', 'ddl',
      'api', 'schema', 'cơ sở dữ liệu', 'hạ tầng', 'infrastructure', 'triển khai', 'deployment', 'authentication', 'xác thực', 'get /', 'post /', 'mã lỗi', 'rate limit', 'cấu hình', 'configuration', 'sao lưu', 'sơ đồ tuần tự', 'điểm cuối'],
    keywords: ['architecture', 'database', 'db schema', 'api spec', 'openapi', 'swagger', 'erd', 'kiến trúc', 'endpoint', 'microservices', 'payload', 'sqlite', 'wal', 'restful', 'khóa ngoại',
      'create table', 'primary key', 'foreign key', 'create index', 'schema', 'cơ sở dữ liệu', 'api', 'http', 'json', 'token', 'container', 'máy chủ', 'hạ tầng', 'cân bằng tải', 'load balancer', 'migration', 'điểm cuối', 'hàng đợi', 'bộ nhớ đệm', 'rest', 'get /', 'post /']
  },
  '06_QA': {
    pathTokens: ['06_qa', 'qa', 'qc', 'test_plan', 'test_strategy', 'test_case', 'kiem_thu', 'kiểm thử', 'acceptance_criteria', 'rtm',
      'test', 'testing', 'kich_ban'],
    headingTokens: ['test plan', 'test strategy', 'test case', 'kế hoạch kiểm thử', 'qa', 'qc', 'kịch bản', 'acceptance criteria', 'traceability matrix', 'defect',
      'kiểm thử', 'test', 'testing', 'tc-', 'ca kiểm thử', 'entry and exit', 'tiêu chí bắt đầu', 'quản lý lỗi', 'traceability', 'coverage', 'đảm bảo chất lượng'],
    keywords: ['test plan', 'test strategy', 'test case', 'kế hoạch kiểm thử', 'qa', 'qc', 'kịch bản', 'acceptance criteria', 'traceability matrix', 'defect', 'stg', 'hồi quy', 'regression', 'pass/fail',
      'expected result', 'kết quả mong đợi', 'các bước', 'steps', 'precondition', 'điều kiện trước', 'ca kiểm thử', 'kiểm thử', 'test', 'testing', 'entry', 'exit', 'severity', 'mức độ nghiêm trọng', 'smoke', 'dữ liệu kiểm thử', 'coverage', 'kiểm thử viên']
  },
  '07_EVD_Evidence': {
    pathTokens: ['07_evd_evidence', 'evd', 'evidence', 'proof', 'screenshot', 'minh_chung', 'bằng chứng', 'uat_signoff', 'execution_log', 'nghiem_thu', 'nghiệm thu',
      'uat', 'signoff', 'sign_off', 'ket_qua', 'bien_ban', 'result'],
    headingTokens: ['evidence', 'proof', 'screenshot', 'minh chứng', 'bằng chứng', 'uat sign-off', 'test execution log', 'audit trail', 'biên bản nghiệm thu',
      'sign-off', 'nghiệm thu', 'biên bản', 'kết quả chạy', 'kết quả thực hiện', 'result', 'log', 'ký xác nhận', 'chữ ký', 'attached', 'kèm theo', 'đính kèm', 'execution', 'totals', 'tổng hợp'],
    keywords: ['evidence', 'proof', 'screenshot', 'minh chứng', 'bằng chứng', 'uat sign-off', 'test execution log', 'audit trail', 'biên bản nghiệm thu', 'kết quả kiểm thử', 'chữ ký phê duyệt', 'sign-off',
      'passed', 'failed', 'executed', 'đã chạy', 'không đạt', 'ảnh chụp màn hình', 'log', 'video', 'recording', 'signed', 'chữ ký', 'nghiệm thu', 'biên bản', 'attached', 'đính kèm', 'kèm theo', 'retest', 'chạy lại', 'uat', 'pass', 'fail']
  },
  '08_Change_History': {
    pathTokens: ['08_change_history', 'change_history', 'changelog', 'release_note', 'lich_su_thay_doi', 'lịch sử thay đổi', 'version_history', 'rfc', 'change_request',
      'release', 'nhat_ky_thay_doi', 'thay_doi', 'whats_new'],
    headingTokens: ['change history', 'changelog', 'release note', 'lịch sử thay đổi', 'nhật ký phát hành', 'version history', 'rfc', 'change request',
      'nhật ký thay đổi', 'ghi chú phát hành', 'yêu cầu thay đổi', 'phiên bản', 'added', 'changed', 'fixed', 'removed', 'deprecated', 'breaking change', 'sửa lỗi', 'tính năng mới', 'cải tiến', 'what changed', 'nội dung thay đổi', 'upgrade'],
    keywords: ['change history', 'changelog', 'release note', 'lịch sử thay đổi', 'nhật ký phát hành', 'version history', 'rfc', 'change request', 'bản vá lỗi', 'hotfix', 'v0.1.0', 'đề xuất thay đổi',
      'added', 'changed', 'fixed', 'deprecated', 'removed', 'thêm:', 'sửa:', 'sửa lỗi', 'phiên bản', 'phát hành', 'breaking change', 'thay đổi', 'gỡ bỏ', 'backward compatible', 'không tương thích', 'so với', 'upgrade']
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
  /**
   * True when the winning folder is supported by content keywords alone: neither the file path nor any
   * heading points to it. Independent of isAmbiguous. Callers should treat the result as a suggestion to
   * be confirmed by a person rather than file the document on it (M0-T5).
   */
  isKeywordOnly: boolean;
  canAutoClassifyWithoutLLM: boolean;
  secondaryCategories: Array<{ category: StandardTaxonomyCategory; score: number }>;
  allScores: Record<StandardTaxonomyCategory, CategoryScoreResult>;
  /** Weights as configured */
  usedWeights: ClassificationWeightsConfig;
  /** Weights actually applied: equals usedWeights unless the file name carried no signal for any folder */
  effectiveWeights: ClassificationWeightsConfig;
}

const WORD_CHAR = /[\p{L}\p{N}]/u;
const tokenRegexCache = new Map<string, RegExp>();

/**
 * Whole-term matcher, Unicode aware (Vietnamese letters count as word characters).
 * A term only matches when it is not glued to other letters or digits, so "ui" does not match inside
 * "require" and "screen" does not match inside "screenshot". A trailing plural "s"/"es" is tolerated.
 * Terms that start or end with punctuation (e.g. "tc-", "get /", "thêm:") are not anchored on that side.
 */
function tokenRegex(token: string): RegExp {
  let re = tokenRegexCache.get(token);
  if (!re) {
    const t = token.toLowerCase();
    const escaped = t.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
    const lead = WORD_CHAR.test(t[0]) ? '(?<![\\p{L}\\p{N}_])' : '';
    const trail = WORD_CHAR.test(t[t.length - 1]) ? '(?:s|es)?(?![\\p{L}\\p{N}_])' : '';
    re = new RegExp(`${lead}${escaped}${trail}`, 'giu');
    tokenRegexCache.set(token, re);
  }
  return re;
}

function countMatches(text: string, token: string): number {
  const re = tokenRegex(token);
  re.lastIndex = 0;
  let count = 0;
  while (re.exec(text) !== null) count++;
  return count;
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
    // File names separate words with "_" or "-"; compare them as space-separated words
    const pathWords = normalizedPath.replace(/[_\-]/g, ' ');

    const components: Array<Omit<CategoryScoreResult, 'score'>> = [];
    const keywordHitsByCategory = new Map<StandardTaxonomyCategory, number>();

    for (const category of ALL_TAXONOMY_CATEGORIES) {
      const rule = TAXONOMY_RULES[category];

      // 1. Path & Filename Matching
      const matchedPathTerms: string[] = [];
      let pathScore = 0;
      if (normalizedPath) {
        // Direct category folder code matching gets full 1.0
        if (normalizedPath.includes(category.toLowerCase()) || pathWords.includes(category.toLowerCase().replace(/_/g, ' '))) {
          pathScore = 1.0;
          matchedPathTerms.push(category);
        } else {
          for (const token of rule.pathTokens) {
            if (countMatches(pathWords, token.replace(/[_\-]/g, ' ')) > 0) {
              matchedPathTerms.push(token);
            }
          }
          if (matchedPathTerms.length > 0) {
            pathScore = Math.min(1.0, 0.5 + matchedPathTerms.length * 0.25);
          }
        }
      }

      // 2. Headings Matching
      const matchedHeadings: string[] = [];
      let headingScore = 0;
      if (normalizedHeadings.length > 0) {
        for (const heading of normalizedHeadings) {
          if (rule.headingTokens.some(token => countMatches(heading, token) > 0)) {
            matchedHeadings.push(heading);
          }
        }
        if (matchedHeadings.length > 0) {
          // Up to 12 headings, three matching headings are a full signal; longer documents need a quarter of them
          const fullSignal = Math.max(Math.min(normalizedHeadings.length, 3), Math.ceil(normalizedHeadings.length * 0.25));
          headingScore = Math.min(1.0, matchedHeadings.length / fullSignal);
        }
      }

      // 3. Keyword Matching: number of distinct taxonomy terms present, so one repeated word cannot saturate it
      const topKeywords: string[] = [];
      let keywordScore = 0;
      let keywordHits = 0;
      if (normalizedContent) {
        for (const kw of rule.keywords) {
          const count = countMatches(normalizedContent, kw);
          if (count > 0) {
            topKeywords.push(`${kw} (${count})`);
            keywordHits += Math.min(count, KEYWORD_REPEAT_CAP);
          }
        }
        keywordScore = Math.min(1.0, topKeywords.length / KEYWORD_SATURATION);
      }
      keywordHitsByCategory.set(category, keywordHits);

      components.push({
        category,
        pathScore: Number(pathScore.toFixed(4)),
        headingScore: Number(headingScore.toFixed(4)),
        keywordScore,
        matchedEvidence: { matchedPathTerms, matchedHeadings, topKeywords }
      });
    }

    // Long documents mention terms of many folders. Scale each folder's keyword signal by its share of the
    // strongest folder's hits, so the signal reflects relative evidence instead of saturating everywhere.
    const maxKeywordHits = Math.max(...keywordHitsByCategory.values());
    for (const c of components) {
      const share = maxKeywordHits > 0 ? (keywordHitsByCategory.get(c.category) || 0) / maxKeywordHits : 0;
      c.keywordScore = Number((c.keywordScore * share).toFixed(4));
    }

    // A file name that says nothing about any folder (e.g. "final_v3.md") is a missing signal, not evidence
    // against every folder: in that case the path weight is redistributed to headings and keywords.
    const hasPathSignal = components.some(c => c.pathScore > 0);
    const contentWeight = weights.headingWeight + weights.keywordWeight;
    const effective: ClassificationWeightsConfig = hasPathSignal || contentWeight <= 0
      ? weights
      : {
          pathWeight: 0,
          headingWeight: weights.headingWeight / contentWeight,
          keywordWeight: weights.keywordWeight / contentWeight
        };

    const allScores: Record<string, CategoryScoreResult> = {};
    for (const c of components) {
      // Total Weighted Score (Deterministic based on file path, headings and keywords - BUG-024)
      const totalScore = Math.min(1.0, Number((
        effective.pathWeight * c.pathScore +
        effective.headingWeight * c.headingScore +
        effective.keywordWeight * c.keywordScore
      ).toFixed(4)));
      allScores[c.category] = { ...c, score: totalScore };
    }

    // Sort categories descending by score
    const sorted = Object.values(allScores).sort((a, b) => b.score - a.score);
    const top = sorted[0];

    // Ambiguous when the best folder is weak, or when the runner-up is too close to call without a person
    const isAmbiguous = top.score < 0.40 || top.score - sorted[1].score < AMBIGUITY_MARGIN;
    // The winner rests on content keywords alone when neither the file path nor a heading supports it
    const isKeywordOnly = top.keywordScore > 0 && top.pathScore === 0 && top.headingScore === 0;
    const canAutoClassifyWithoutLLM = top.score >= 0.75;

    const secondaryCategories = sorted
      .slice(1)
      .filter(s => s.score >= 0.35)
      .map(s => ({ category: s.category, score: s.score }));

    return {
      primaryCategory: top.category,
      primaryScore: top.score,
      isAmbiguous,
      isKeywordOnly,
      canAutoClassifyWithoutLLM,
      secondaryCategories,
      allScores: allScores as Record<StandardTaxonomyCategory, CategoryScoreResult>,
      usedWeights: weights,
      effectiveWeights: effective
    };
  }
}
