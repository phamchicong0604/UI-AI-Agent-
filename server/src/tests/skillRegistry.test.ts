import { describe, it, expect, beforeEach } from 'vitest';
import { db, dbRepository } from '../database/db.js';
import { SkillRegistry } from '../modules/ai/skillRegistry.js';
import { 
  Stage2CombinedOutputSchema,
  EvidenceLevelEnum
} from '../modules/ai/skills/schemas.js';
import { Stage2CombinedRunner } from '../modules/ai/stage2Runner.js';

describe('AI Skill Contracts & Versioned Registry (Epic E4)', () => {
  let registry: SkillRegistry;
  let runner: Stage2CombinedRunner;

  beforeEach(() => {
    registry = new SkillRegistry();
    runner = new Stage2CombinedRunner();
  });

  describe('Schema Validation & Evidence Guard (E4-T1, E4-T3)', () => {
    it('should validate valid Stage 2 combined output structure', () => {
      const validPayload = {
        understanding: {
          document_intent: 'Tài liệu hướng dẫn thanh toán QR',
          executive_summary: 'Mô tả quy trình quét mã QR và xác thực sinh trắc học',
          target_audience: ['Merchant', 'Customer'],
          key_domains: ['Payments', 'Security']
        },
        extraction: {
          extracted_units: [
            {
              unit_type: 'BusinessRule',
              subject: 'Giao dịch chuyển tiền',
              action: 'yêu cầu xác thực OTP hoặc sinh trắc học',
              condition: 'nếu giá trị trên 10 triệu VND',
              evidence_level: 'Explicit',
              source_anchor: {
                document_version_id: 'DOC-QR-v1.0',
                heading_path: ['Mục 3', 'Hạn mức giao dịch'],
                char_offset_start: 500,
                char_offset_end: 650,
                page_number: 2,
                exact_quote: 'Giao dịch trên 10 triệu đồng bắt buộc xác thực sinh trắc học khuôn mặt.'
              }
            }
          ]
        },
        classification: {
          recommended_category: '02_Business_Requirements',
          confidence_score: 0.95,
          reasoning: 'Tài liệu quy định nghiệp vụ giao dịch tài chính'
        }
      };

      const parsed = Stage2CombinedOutputSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
    });

    it('should catch invalid outputs: corrupt fields, missing source_anchor, or invalid enum (E4-T3 AC)', () => {
      // 1. Missing required field in understanding
      const missingField = {
        understanding: {
          document_intent: 'Thiếu executive_summary'
        },
        extraction: { extracted_units: [] },
        classification: {
          recommended_category: '02_Business_Requirements',
          confidence_score: 0.9,
          reasoning: 'Ok'
        }
      };
      expect(Stage2CombinedOutputSchema.safeParse(missingField).success).toBe(false);

      // 2. Invalid evidence_level enum
      const invalidEnum = {
        understanding: {
          document_intent: 'Intent',
          executive_summary: 'Summary',
          target_audience: [],
          key_domains: []
        },
        extraction: {
          extracted_units: [
            {
              unit_type: 'Requirement',
              subject: 'User',
              action: 'do something',
              evidence_level: 'SUPER_CERTAIN_GUESS', // Invalid enum
              source_anchor: {
                document_version_id: 'DOC-1-v1',
                heading_path: [],
                char_offset_start: 0,
                char_offset_end: 10,
                exact_quote: 'Quote'
              }
            }
          ]
        },
        classification: {
          recommended_category: '01_Project_Overview',
          confidence_score: 0.8,
          reasoning: 'Ok'
        }
      };
      expect(Stage2CombinedOutputSchema.safeParse(invalidEnum).success).toBe(false);
    });

    it('should mandate EvidenceLevel enum adherence (BR-AI-01 / E4-T3.3)', () => {
      const validLevels = ['Explicit', 'Inferred', 'Assumed', 'Not Specified', 'Conflict', 'Unknown'];
      for (const level of validLevels) {
        expect(EvidenceLevelEnum.safeParse(level).success).toBe(true);
      }

      // Invalid levels must be strictly rejected
      const invalidLevels = ['Guessed', 'Fabricated', 'Hallucinated', 'Custom', '', 'EXPLICIT'];
      for (const invalid of invalidLevels) {
        expect(EvidenceLevelEnum.safeParse(invalid).success).toBe(false);
      }
    });
  });

  describe('Versioned Skill Registry & Output Caching (E4-T2)', () => {
    it('should create new skill_version on prompt change, and return existing version for same prompt', () => {
      const skillId = `SKILL-TEST-${Date.now()}`;

      // 1. First prompt version
      const v1 = registry.registerOrGetVersion({
        skillId,
        name: 'Test Skill',
        description: 'Test skill for versioning',
        promptTemplate: 'Prompt version 1',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' }
      });
      expect(v1.version).toBe('1.0.0');

      // 2. Calling with same prompt returns existing v1
      const v1Again = registry.registerOrGetVersion({
        skillId,
        name: 'Test Skill',
        description: 'Test skill for versioning',
        promptTemplate: 'Prompt version 1',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' }
      });
      expect(v1Again.id).toBe(v1.id);
      expect(v1Again.version).toBe('1.0.0');

      // 3. Changed prompt creates new version (e.g. 1.1.0 or 2.0.0)
      const v2 = registry.registerOrGetVersion({
        skillId,
        name: 'Test Skill',
        description: 'Test skill for versioning',
        promptTemplate: 'Prompt version 2 (updated instructions)',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' }
      });
      expect(v2.id).not.toBe(v1.id);
      expect(v2.version).not.toBe('1.0.0');
    });

    it('should serve results from cache when calling same document version, skill version and model (E4-T2.3 AC)', async () => {
      const docId = `DOC-CACHE-${Date.now()}`;
      const docVersionId = `${docId}-v1.0`;

      // Seed parent document and document_version for foreign key integrity
      db.prepare(`
        INSERT INTO documents (id, project_id, category, status, data, updated_at)
        VALUES (?, 'PRJ-01', '01_Project_Overview', 'Draft', '{}', '2026-11-03')
      `).run(docId);
      db.prepare(`
        INSERT INTO document_versions (id, document_id, version_no, file_id, extracted_content, status, change_summary, created_by, created_at)
        VALUES (?, ?, 'v1.0', NULL, 'Test content', 'UPLOADED', 'Initial', 'Tester', '2026-11-03')
      `).run(docVersionId, docId);

      let llmCallCount = 0;

      const mockLlmCaller = async () => {
        llmCallCount++;
        return JSON.stringify({
          understanding: {
            document_intent: 'Intent from LLM',
            executive_summary: 'Summary from LLM',
            target_audience: ['Dev'],
            key_domains: ['Core']
          },
          extraction: {
            extracted_units: [
              {
                unit_type: 'Constraint',
                subject: 'Database',
                action: 'chỉ chấp nhận kết nối qua SSL',
                evidence_level: 'Explicit',
                source_anchor: {
                  document_version_id: docVersionId,
                  heading_path: ['Config'],
                  char_offset_start: 10,
                  char_offset_end: 50,
                  exact_quote: 'Chỉ chấp nhận kết nối qua SSL'
                }
              }
            ]
          },
          classification: {
            recommended_category: '05_Technical_Documents',
            confidence_score: 0.98,
            reasoning: 'Config database SSL'
          }
        });
      };

      // Run 1: First execution -> Calls LLM, saves to cache
      const run1 = await runner.execute({
        projectId: 'PRJ-01',
        documentVersionId: docVersionId,
        documentTitle: 'Database Specs',
        documentText: 'Tài liệu cấu hình database. Chỉ chấp nhận kết nối qua SSL.',
        modelId: 'gemini-1.5-flash',
        llmCaller: mockLlmCaller
      });

      expect(run1.fromCache).toBe(false);
      expect(llmCallCount).toBe(1);

      // Run 2: Second execution with identical input and model -> Retrieved from cache
      const run2 = await runner.execute({
        projectId: 'PRJ-01',
        documentVersionId: docVersionId,
        documentTitle: 'Database Specs',
        documentText: 'Tài liệu cấu hình database. Chỉ chấp nhận kết nối qua SSL.',
        modelId: 'gemini-1.5-flash',
        llmCaller: mockLlmCaller
      });

      expect(run2.fromCache).toBe(true);
      expect(llmCallCount).toBe(1); // Did NOT call LLM again!
      expect(run2.output.classification.recommended_category).toBe('05_Technical_Documents');
    });
  });

  describe('Stage 2 Combined Execution & Pipeline Traceability (E4-T4)', () => {
    it('should execute combined Understanding, Extraction and Classification in a single pipeline run', async () => {
      const docId = `DOC-STAGE2-${Date.now()}`;
      const docVersionId = `${docId}-v1.0`;

      // Seed parent document and document_version for foreign key integrity
      db.prepare(`
        INSERT INTO documents (id, project_id, category, status, data, updated_at)
        VALUES (?, 'PRJ-01', '01_Project_Overview', 'Draft', '{}', '2026-11-03')
      `).run(docId);
      db.prepare(`
        INSERT INTO document_versions (id, document_id, version_no, file_id, extracted_content, status, change_summary, created_by, created_at)
        VALUES (?, ?, 'v1.0', NULL, 'Test content', 'UPLOADED', 'Initial', 'Tester', '2026-11-03')
      `).run(docVersionId, docId);

      const result = await runner.execute({
        projectId: 'PRJ-01',
        documentVersionId: docVersionId,
        documentTitle: 'QA Plan MVP',
        documentText: '# Kế hoạch kiểm thử\nYêu cầu hệ thống phải hỗ trợ chạy 500 test cases đồng thời.'
      });

      expect(result.output.understanding).toBeDefined();
      expect(result.output.extraction).toBeDefined();
      expect(result.output.classification).toBeDefined();
      expect(result.output.extraction.extracted_units.length).toBeGreaterThan(0);

      // Verify single pipeline_runs entry exists in SQLite (E4-T4.2 AC)
      const runs = db.prepare('SELECT * FROM pipeline_runs WHERE document_version_id = ?').all(docVersionId) as any[];
      expect(runs.length).toBe(1);
      expect(runs[0].status).toBe('SUCCESS');
      expect(runs[0].tokens_prompt).toBeGreaterThan(0);
      expect(runs[0].tokens_completion).toBeGreaterThan(0);
    });
  });
});
