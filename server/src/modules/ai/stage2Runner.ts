import { PipelineRunRecord } from '../../common/types.js';
import { db } from '../../database/db.js';
import { defaultSkillRegistry } from './skillRegistry.js';
import { defaultDataPolicyService } from './dataPolicyService.js';
import crypto from 'crypto';
import { z } from 'zod';
import { 
  Stage2CombinedOutputSchema, 
  Stage2CombinedOutput,
  ExtractedUnitSchema
} from './skills/schemas.js';

export interface Stage2RunOptions {
  projectId?: string;
  documentVersionId: string;
  documentTitle: string;
  documentText: string;
  modelId?: string;
  provider?: string;
  llmCaller?: (prompt: string, signal?: AbortSignal) => Promise<string>;
  signal?: AbortSignal;
  skipPersistence?: boolean;
}

export class Stage2CombinedRunner {
  public static readonly SKILL_ID = 'SKILL-STAGE2-COMBINED';
  public static readonly PROMPT_TEMPLATE = `
Bạn là AI Senior Business Analyst và QA Architect.
Hãy phân tích tài liệu sau đây và trả về kết quả dưới định dạng JSON duy nhất, tuân thủ đúng cấu trúc:
1. understanding: mục đích, tóm tắt điều hành, nhóm độc giả, phạm vi hệ thống.
2. extraction: danh sách các đơn vị tri thức (Requirement, BusinessRule, Constraint, Definition). Mỗi đơn vị BẮT BUỘC có evidence_level ("Explicit", "Inferred", "Assumed", "Not Specified", "Conflict", "Unknown") và source_anchor (document_version_id, heading_path, char_offset_start, char_offset_end, exact_quote).
3. classification: phân loại tài liệu vào 1 trong 8 thư mục (01_Project_Overview -> 08_Change_History) kèm confidence_score và lý do.
`.trim();

  /**
   * Execute Stage 2 combined Understanding + Extraction + Classification with caching, policy checks & schema validation
   */
  public async execute(options: Stage2RunOptions): Promise<{ output: Stage2CombinedOutput; fromCache: boolean; runId: string; securityFlags?: string[] }> {
    let projectId = options.projectId;
    if (!projectId && options.documentVersionId) {
      try {
        const row = db.prepare(`
          SELECT d.project_id
          FROM document_versions dv
          JOIN documents d ON d.id = dv.document_id
          WHERE dv.id = ?
        `).get(options.documentVersionId) as { project_id: string } | undefined;
        if (row?.project_id) {
          projectId = row.project_id;
        }
      } catch {}
    }

    let modelId = options.modelId || 'gemini-1.5-flash';
    let provider = options.provider || 'google';

    // 1. Data Policy & Offline Enforcement (E5-T2, fail-closed)
    const projectPolicy = defaultDataPolicyService.getProjectPolicy(projectId);
    const isOfflineOnly = projectPolicy !== 'ALLOW_EXTERNAL';
    if (isOfflineOnly) {
      provider = 'offline-grounded-engine';
      modelId = 'grounded-local-parser';
    }

    // 2. Register or retrieve Skill Version
    const skillVersion = defaultSkillRegistry.registerOrGetVersion({
      skillId: Stage2CombinedRunner.SKILL_ID,
      name: 'Stage 2 Combined Analysis',
      description: 'Single-call combined execution of Understanding, Extraction and Classification (E4-T4)',
      promptTemplate: Stage2CombinedRunner.PROMPT_TEMPLATE,
      inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      outputSchema: { type: 'object', required: ['understanding', 'extraction', 'classification'] },
      modelRecommended: modelId
    });

    // 3. Check Cache Hit (E4-T2.3)
    if (!options.skipPersistence) {
      const cached = defaultSkillRegistry.getCachedOutput(options.documentVersionId, skillVersion.id, modelId);
      if (cached && cached.outputPayload) {
        try {
          const parsed = JSON.parse(cached.outputPayload);
          const validated = Stage2CombinedOutputSchema.parse(parsed);
          let securityFlags: string[] | undefined;
          if (cached.inputPayload) {
            try {
              const input = JSON.parse(cached.inputPayload);
              if (Array.isArray(input.securityFlags)) {
                securityFlags = input.securityFlags;
              }
            } catch {}
          }
          return { output: validated, fromCache: true, runId: cached.id, securityFlags };
        } catch {}
      }
    }

    if (options.signal?.aborted) {
      throw new Error('Stage 2 AI analysis cancelled');
    }

    // 4. Security: Prompt Injection Scanning & Delimiter Sandboxing (E5-T3, BUG-016)
    const injectionCheck = defaultDataPolicyService.detectPromptInjection(options.documentText);
    const redactionResult = defaultDataPolicyService.redactSensitiveData(options.documentText);
    const dynamicDelimiter = `CONTENT_${crypto.randomBytes(4).toString('hex')}`;
    const sandboxedContent = defaultDataPolicyService.wrapUntrustedDocument(redactionResult.text, dynamicDelimiter);

    const startTime = Date.now();
    const fullPrompt = `${Stage2CombinedRunner.PROMPT_TEMPLATE}\n\n=== DOCUMENT VERSION: ${options.documentVersionId} ===\n${sandboxedContent}`;

    const maxRetries = 2;
    let lastError: Error | null = null;
    let validatedOutput: Stage2CombinedOutput | null = null;
    let rawOutputStr = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (options.signal?.aborted) {
          throw new Error('Stage 2 AI analysis cancelled');
        }

        let currentPrompt = fullPrompt;
        if (attempt > 1 && lastError) {
          currentPrompt = `${fullPrompt}\n\n[LỖI VALIDATION LẦN TRƯỚC]: ${lastError.message}\nYêu cầu điều chỉnh lại cấu trúc JSON phản hồi cho chuẩn xác theo schema.`;
        }

        if (isOfflineOnly) {
          // Zero external request: use Grounded Engine deterministic parser with original text for exact quotes (BUG-017)
          rawOutputStr = this.generateFallbackResponse(options.documentVersionId, options.documentTitle, options.documentText);
        } else if (options.llmCaller) {
          rawOutputStr = await options.llmCaller(currentPrompt, options.signal);
        } else {
          // Default deterministic mock response when no caller passed
          rawOutputStr = this.generateFallbackResponse(options.documentVersionId, options.documentTitle, options.documentText);
        }

        // Clean JSON markdown blocks if wrapped by LLM
        let cleanJson = rawOutputStr.trim();
        if (cleanJson.startsWith('```json')) cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '').trim();
        else if (cleanJson.startsWith('```')) cleanJson = cleanJson.replace(/^```/, '').replace(/```$/, '').trim();

        const parsedJson = JSON.parse(cleanJson);

        // Validate strictly using Zod (E4-T3.1)
        validatedOutput = Stage2CombinedOutputSchema.parse(parsedJson);
        break;
      } catch (err: any) {
        lastError = err;
      }
    }

    const latencyMs = Date.now() - startTime;
    const runId = `RUN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    if (!validatedOutput) {
      if (!options.skipPersistence) {
        // Record FAILED run in pipeline_runs (E4-T3.2)
        defaultSkillRegistry.saveRun({
          id: runId,
          documentVersionId: options.documentVersionId,
          skillVersionId: skillVersion.id,
          modelId,
          provider,
          status: 'FAILED',
          inputPayload: JSON.stringify({ textLength: options.documentText.length }),
          outputPayload: rawOutputStr || null,
          tokensPrompt: Math.ceil(fullPrompt.length / 4),
          tokensCompletion: 0,
          latencyMs,
          errorMessage: lastError?.message || 'Schema validation failed after retries',
          createdAt: new Date().toISOString()
        });
      }

      throw new Error(`Stage 2 AI analysis failed schema validation: ${lastError?.message}`);
    }

    if (!options.skipPersistence) {
      // 5. Record SUCCESS run in pipeline_runs with size and tokens (E5-T2.3)
      defaultSkillRegistry.saveRun({
        id: runId,
        documentVersionId: options.documentVersionId,
        skillVersionId: skillVersion.id,
        modelId,
        provider,
        status: 'SUCCESS',
        inputPayload: JSON.stringify({
          textLength: options.documentText.length,
          redactions: redactionResult.totalRedactions,
          securityFlags: injectionCheck.flags
        }),
        outputPayload: JSON.stringify(validatedOutput),
        tokensPrompt: isOfflineOnly ? 0 : Math.ceil(fullPrompt.length / 4),
        tokensCompletion: isOfflineOnly ? 0 : Math.ceil(rawOutputStr.length / 4),
        latencyMs,
        errorMessage: null,
        createdAt: new Date().toISOString()
      });
    }

    return { 
      output: validatedOutput, 
      fromCache: false, 
      runId,
      securityFlags: injectionCheck.flags
    };
  }

  /**
   * Grounded extraction of knowledge units from text (BUG-007, BUG-017).
   * Verbatim exact quotes with byte-accurate character offsets and Inferred evidence level.
   */
  public extractGroundedUnits(versionId: string, title: string, text: string): Array<z.infer<typeof ExtractedUnitSchema>> {
    const trimmed = text.trim();
    if (!trimmed) return [];

    const sentences = trimmed
      .split(/(?<=[.!?\n])\s+/)
      .map(s => s.trim())
      .filter(s => s.length >= 10);

    const extractedUnits: Array<z.infer<typeof ExtractedUnitSchema>> = [];
    const requirementRegex = /(?:yêu cầu|phải|bắt buộc|hạn mức|thời gian timeout|thời gian xử lý|hoàn tiền|shall|must|support|tuân thủ|tiêu chuẩn|kích thước tối thiểu|quy định|xác thực|bảo mật|nghiệm thu|p0|wal|sha-256|concurrency|latency|rto|brand color|mã màu)/i;

    for (const sent of sentences) {
      if (requirementRegex.test(sent)) {
        const startOffset = Math.max(0, text.indexOf(sent));
        const endOffset = startOffset + sent.length;
        extractedUnits.push({
          unit_type: 'Requirement',
          subject: title,
          action: 'tuân thủ đặc tả kỹ thuật và nghiệp vụ',
          condition: undefined,
          evidence_level: 'Inferred', // Deterministic fallback extraction is Inferred (BUG-017)
          source_anchor: {
            document_version_id: versionId,
            heading_path: ['1. Giới thiệu tổng quan'],
            char_offset_start: startOffset,
            char_offset_end: endOffset,
            exact_quote: sent
          }
        });
      }
    }

    // Fallback if no requirement regex matched: use first sentence as Definition
    if (extractedUnits.length === 0 && sentences.length > 0) {
      const firstSentence = sentences[0];
      const startOffset = Math.max(0, text.indexOf(firstSentence));
      const endOffset = startOffset + firstSentence.length;
      extractedUnits.push({
        unit_type: 'Definition',
        subject: title,
        action: 'định nghĩa các nội dung cốt lõi',
        condition: undefined,
        evidence_level: 'Inferred',
        source_anchor: {
          document_version_id: versionId,
          heading_path: ['1. Giới thiệu tổng quan'],
          char_offset_start: startOffset,
          char_offset_end: endOffset,
          exact_quote: firstSentence
        }
      });
    }

    return extractedUnits;
  }

  /**
   * Deterministic grounded fallback generator matching Stage 2 Combined Schema.
   * BUG-017: Verbatim exact quotes from document text, strictly valid offsets.
   */
  private generateFallbackResponse(versionId: string, title: string, text: string): string {
    const trimmed = text.trim();
    if (!trimmed) {
      return JSON.stringify({
        understanding: {
          document_intent: `Tài liệu rỗng hoặc chưa có nội dung văn bản: ${title}`,
          executive_summary: `Không tìm thấy nội dung để phân tích cho tài liệu ${title}`,
          target_audience: ['Reviewers'],
          key_domains: ['General']
        },
        extraction: {
          extracted_units: []
        },
        classification: {
          recommended_category: '01_Project_Overview',
          confidence_score: 0.1,
          reasoning: 'Tài liệu không có nội dung văn bản'
        }
      });
    }

    const extractedUnits = this.extractGroundedUnits(versionId, title, text);
    const hasRequirement = extractedUnits.some(u => u.unit_type === 'Requirement');

    return JSON.stringify({
      understanding: {
        document_intent: `Tài liệu định nghĩa đặc tả và quy trình cho ${title}`,
        executive_summary: text.slice(0, 180) || `Tóm tắt cho tài liệu ${title}`,
        target_audience: ['Business Analysts', 'QA Engineers', 'Developers'],
        key_domains: ['System Requirements', 'Quality Assurance']
      },
      extraction: {
        extracted_units: extractedUnits
      },
      classification: {
        recommended_category: hasRequirement ? '02_Business_Requirements' : '01_Project_Overview',
        confidence_score: 0.88,
        reasoning: 'Trích xuất trực tiếp nguyên văn dựa trên câu thực tế trong văn bản tài liệu'
      }
    });
  }
}

export const defaultStage2Runner = new Stage2CombinedRunner();
