import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { DatabaseMigrator } from '../../database/migrator.js';
import { allMigrations } from '../../database/migrations/index.js';
import { ClassificationScorer } from '../../modules/documents/classificationScorer.js';
import { SemanticValidator, CandidateKnowledgeUnit } from '../../modules/knowledge/semanticValidator.js';
import { defaultStage2Runner } from '../../modules/ai/stage2Runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface EvalMetrics {
  totalCases: number;
  classificationAccuracy: number; // 0 - 100%
  multiLabelF1: number;           // 0 - 100%
  extractionPrecision: number;    // 0 - 100%
  extractionRecall: number;       // 0 - 100%
  conflictDetectionRecall: number;// 0 - 100%
  conflictDetectionPrecision: number; // 0 - 100%
  conflictFalsePositives: number;
  averageLatencyMs: number;
  totalTokensEstimated: number;
}

export class EvalRunner {
  public static async run(): Promise<{ metrics: EvalMetrics; detailedResults: any[] }> {
    const datasetPath = path.join(__dirname, 'dataset.v1.json');
    const rawData = fs.readFileSync(datasetPath, 'utf-8');
    const dataset: any[] = JSON.parse(rawData);

    // Setup in-memory SQLite DB for conflict and knowledge grounding
    const db = new Database(':memory:');
    const migrator = new DatabaseMigrator(db, allMigrations);
    migrator.runPendingMigrations();

    const projectId = 'PRJ-EVAL';
    db.prepare(`
      INSERT INTO projects (id, name, key, description, version, author, members_count, ai_policy, data, created_at, updated_at)
      VALUES (?, 'Eval Project', 'EVAL', 'Evaluation dataset project', 'v1.0.0', 'QA Lead', 1, 'ALLOW_EXTERNAL', '{}', datetime('now'), datetime('now'))
    `).run(projectId);

    let correctClassification = 0;
    let multiLabelTruePositives = 0;
    let multiLabelFalsePositives = 0;
    let multiLabelFalseNegatives = 0;

    const detailedResults: any[] = [];
    const startTime = Date.now();
    let totalTokens = 0;

    for (const testCase of dataset) {
      const caseStart = Date.now();
      totalTokens += Math.ceil((testCase.content.length + (testCase.headings.join(' ').length)) / 4);

      // 1. Classification
      const scoreResult = ClassificationScorer.score({
        filePath: testCase.filePath,
        headings: testCase.headings,
        content: testCase.content,
        projectId,
        db
      });

      // Multi-label aware primary classification check
      const targetCategories = [
        testCase.groundTruth.primaryCategory,
        ...(testCase.groundTruth.secondaryCategories || [])
      ];
      const isCorrect = targetCategories.includes(scoreResult.primaryCategory);
      if (isCorrect) correctClassification++;

      // Multi-label F1 calculation: compare all predicted categories against all expected categories
      const allExpected = [
        testCase.groundTruth.primaryCategory,
        ...(testCase.groundTruth.secondaryCategories || [])
      ];
      const predictedSecondary = scoreResult.secondaryCategories.map((s: any) => s.category);
      const allPredicted = [
        scoreResult.primaryCategory,
        ...predictedSecondary
      ];

      for (const exp of allExpected) {
        if (allPredicted.includes(exp)) {
          multiLabelTruePositives++;
        } else {
          multiLabelFalseNegatives++;
        }
      }
      for (const pred of allPredicted) {
        if (!allExpected.includes(pred)) {
          multiLabelFalsePositives++;
        }
      }

      detailedResults.push({
        id: testCase.id,
        title: testCase.title,
        expectedCategory: testCase.groundTruth.primaryCategory,
        predictedCategory: scoreResult.primaryCategory,
        primaryScore: scoreResult.primaryScore,
        isCorrect,
        secondaryPredicted: predictedSecondary,
        latencyMs: Date.now() - caseStart
      });
    }

    // 2. Conflict Detection Benchmark (BUG-007: Positive & Negative conflict pairs)
    const now = new Date().toISOString();
    
    // Seed approved units into SQLite for conflict evaluation
    db.prepare(`
      INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, evidence_level, status, created_at, updated_at)
      VALUES 
        ('ku-base-timeout', ?, 'Requirement', 'Thời gian timeout phiên thanh toán là 15m.', 'Thời gian timeout phiên thanh toán', 'Thiết lập', 'Explicit', 'Approved', ?, ?),
        ('ku-base-2fa', ?, 'Requirement', 'Xác thực 2FA là bắt buộc khi đăng nhập tài khoản quản trị hệ thống.', 'Xác thực 2FA quản trị', 'Yêu cầu xác thực hai lớp', 'Explicit', 'Approved', ?, ?),
        ('ku-base-duration', ?, 'Requirement', 'Thời gian xử lý giao dịch là 5 phút.', 'Thời gian xử lý giao dịch', 'Giới hạn thời gian', 'Explicit', 'Approved', ?, ?)
    `).run(projectId, now, now, projectId, now, now, projectId, now, now);

    const testPairs: Array<{ candidate: CandidateKnowledgeUnit; expectConflict: boolean }> = [
      // Positive cases (contradictions)
      {
        candidate: {
          id: 'ku-cand-timeout',
          project_id: projectId,
          unit_type: 'Requirement',
          subject: 'Thời gian timeout phiên thanh toán',
          action: 'Thiết lập',
          content: 'Thời gian timeout phiên thanh toán là 30m.',
          evidence_level: 'Explicit'
        },
        expectConflict: true
      },
      {
        candidate: {
          id: 'ku-cand-2fa',
          project_id: projectId,
          unit_type: 'Requirement',
          subject: 'Xác thực 2FA quản trị',
          action: 'Miễn trừ',
          content: 'Xác thực 2FA là không bắt buộc khi đăng nhập tài khoản quản trị hệ thống.',
          evidence_level: 'Explicit'
        },
        expectConflict: true
      },
      {
        candidate: {
          id: 'ku-cand-duration',
          project_id: projectId,
          unit_type: 'Requirement',
          subject: 'Thời gian xử lý giao dịch',
          action: 'Giới hạn thời gian',
          content: 'Thời gian xử lý giao dịch là 7 phút.',
          evidence_level: 'Explicit'
        },
        expectConflict: true
      },
      // Negative cases (non-conflicting independent requirements)
      {
        candidate: {
          id: 'ku-cand-audit-log',
          project_id: projectId,
          unit_type: 'Requirement',
          subject: 'Nhật ký kiểm toán truy cập máy chủ',
          action: 'Lưu trữ an toàn',
          content: 'Hệ thống tự động lưu trữ nhật ký truy cập vào máy chủ an toàn trong 180 ngày.',
          evidence_level: 'Explicit'
        },
        expectConflict: false
      },
      {
        candidate: {
          id: 'ku-cand-timeout-consistent',
          project_id: projectId,
          unit_type: 'Requirement',
          subject: 'Thời gian timeout phiên thanh toán',
          action: 'Thiết lập',
          content: 'Thời gian timeout phiên thanh toán là 15m.',
          evidence_level: 'Explicit'
        },
        expectConflict: false
      }
    ];

    let conflictTruePositives = 0;
    let conflictFalseNegatives = 0;
    let conflictFalsePositives = 0;
    let conflictTrueNegatives = 0;

    for (const pair of testPairs) {
      db.prepare(`
        INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, evidence_level, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?)
      `).run(pair.candidate.id, pair.candidate.project_id, pair.candidate.unit_type, pair.candidate.content, pair.candidate.subject, pair.candidate.action, pair.candidate.evidence_level, now, now);

      const { conflicts: detected } = SemanticValidator.validateAgainstApproved(db, pair.candidate);
      const isCritical = detected.some(c => c.severity === 'Critical' && c.conflictType === 'Contradiction');

      if (pair.expectConflict) {
        if (isCritical) conflictTruePositives++;
        else conflictFalseNegatives++;
      } else {
        if (isCritical) conflictFalsePositives++;
        else conflictTrueNegatives++;
      }
    }

    const conflictDivider = conflictTruePositives + conflictFalseNegatives;
    const conflictDetectionRecall = conflictDivider > 0
      ? Number(((conflictTruePositives / conflictDivider) * 100).toFixed(2))
      : 100.0;

    const conflictPrecisionDivider = conflictTruePositives + conflictFalsePositives;
    const conflictDetectionPrecision = conflictPrecisionDivider > 0
      ? Number(((conflictTruePositives / conflictPrecisionDivider) * 100).toFixed(2))
      : 100.0;

    // 3. Grounded Extraction Verification against Ground Truth (BUG-007)
    let totalGroundTruthUnits = 0;
    let recalledGtUnits = 0;
    let totalExtractedUnits = 0;
    let verbatimGroundedUnits = 0;

    for (const tc of dataset) {
      const gtUnits = tc.groundTruth.extractedUnits || [];
      totalGroundTruthUnits += gtUnits.length;

      // Execute actual Stage 2 Grounded Extractor with skipPersistence to prevent DB pollution
      const stage2Result = await defaultStage2Runner.execute({
        documentVersionId: tc.id,
        documentTitle: tc.title,
        documentText: tc.content,
        projectId,
        skipPersistence: true
      });

      const extracted = stage2Result.output.extraction.extracted_units;
      totalExtractedUnits += extracted.length;

      // Verify verbatim grounding: char offsets must exactly match quote in content
      for (const unit of extracted) {
        const quote = unit.source_anchor.exact_quote;
        const textSlice = tc.content.slice(
          unit.source_anchor.char_offset_start,
          unit.source_anchor.char_offset_end
        );
        if (textSlice === quote && tc.content.includes(quote)) {
          verbatimGroundedUnits++;
        }
      }

      // Verify recall against ground truth quotes
      for (const gt of gtUnits) {
        if (!gt.exactQuote) continue;
        const matched = extracted.some(u => 
          u.source_anchor.exact_quote.includes(gt.exactQuote) || 
          gt.exactQuote.includes(u.source_anchor.exact_quote)
        );
        if (matched) {
          recalledGtUnits++;
        }
      }
    }

    const extractionRecall = totalGroundTruthUnits > 0
      ? Number(((recalledGtUnits / totalGroundTruthUnits) * 100).toFixed(2))
      : 100.0;

    const extractionPrecision = totalExtractedUnits > 0
      ? Number(((verbatimGroundedUnits / totalExtractedUnits) * 100).toFixed(2))
      : 100.0;

    db.close();

    const totalCases = dataset.length;
    const classificationAccuracy = Number(((correctClassification / totalCases) * 100).toFixed(2));

    const precisionDivider = multiLabelTruePositives + multiLabelFalsePositives;
    const recallDivider = multiLabelTruePositives + multiLabelFalseNegatives;
    const p = precisionDivider > 0 ? multiLabelTruePositives / precisionDivider : 1.0;
    const r = recallDivider > 0 ? multiLabelTruePositives / recallDivider : 1.0;
    const multiLabelF1 = p + r > 0 ? Number(((2 * p * r / (p + r)) * 100).toFixed(2)) : 100.0;

    const totalElapsed = Date.now() - startTime;
    const averageLatencyMs = Number((totalElapsed / totalCases).toFixed(2));

    const metrics: EvalMetrics = {
      totalCases,
      classificationAccuracy,
      multiLabelF1,
      extractionPrecision,
      extractionRecall,
      conflictDetectionRecall,
      conflictDetectionPrecision,
      conflictFalsePositives,
      averageLatencyMs,
      totalTokensEstimated: totalTokens
    };

    return { metrics, detailedResults };
  }
}
