import { PipelineRunRecord } from '../../common/types.js';
import { defaultSkillRegistry } from './skillRegistry.js';
import { 
  Stage2CombinedOutputSchema, 
  Stage2CombinedOutput, 
  canAutoApproveUnit 
} from './skills/schemas.js';

export interface Stage2RunOptions {
  documentVersionId: string;
  documentTitle: string;
  documentText: string;
  modelId?: string;
  provider?: string;
  llmCaller?: (prompt: string) => Promise<string>;
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
   * Execute Stage 2 combined Understanding + Extraction + Classification with caching & schema validation
   */
  public async execute(options: Stage2RunOptions): Promise<{ output: Stage2CombinedOutput; fromCache: boolean; runId: string }> {
    const modelId = options.modelId || 'gemini-1.5-flash';
    const provider = options.provider || 'google';

    // 1. Register or retrieve Skill Version
    const skillVersion = defaultSkillRegistry.registerOrGetVersion({
      skillId: Stage2CombinedRunner.SKILL_ID,
      name: 'Stage 2 Combined Analysis',
      description: 'Single-call combined execution of Understanding, Extraction and Classification (E4-T4)',
      promptTemplate: Stage2CombinedRunner.PROMPT_TEMPLATE,
      inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      outputSchema: { type: 'object', required: ['understanding', 'extraction', 'classification'] },
      modelRecommended: modelId
    });

    // 2. Check Cache Hit (E4-T2.3)
    const cached = defaultSkillRegistry.getCachedOutput(options.documentVersionId, skillVersion.id, modelId);
    if (cached && cached.outputPayload) {
      try {
        const parsed = JSON.parse(cached.outputPayload);
        const validated = Stage2CombinedOutputSchema.parse(parsed);
        return { output: validated, fromCache: true, runId: cached.id };
      } catch {}
    }

    // 3. Prepare AI execution prompt
    const startTime = Date.now();
    const fullPrompt = `${Stage2CombinedRunner.PROMPT_TEMPLATE}\n\n=== DOCUMENT VERSION: ${options.documentVersionId} ===\n${options.documentText}`;

    const maxRetries = 2;
    let lastError: Error | null = null;
    let validatedOutput: Stage2CombinedOutput | null = null;
    let rawOutputStr = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (options.llmCaller) {
          rawOutputStr = await options.llmCaller(fullPrompt);
        } else {
          // Default deterministic mock response when no caller passed (for testing / offline fallback)
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

      throw new Error(`Stage 2 AI analysis failed schema validation: ${lastError?.message}`);
    }

    // 4. Record SUCCESS run in pipeline_runs (E4-T4.2)
    defaultSkillRegistry.saveRun({
      id: runId,
      documentVersionId: options.documentVersionId,
      skillVersionId: skillVersion.id,
      modelId,
      provider,
      status: 'SUCCESS',
      inputPayload: JSON.stringify({ textLength: options.documentText.length }),
      outputPayload: JSON.stringify(validatedOutput),
      tokensPrompt: Math.ceil(fullPrompt.length / 4),
      tokensCompletion: Math.ceil(rawOutputStr.length / 4),
      latencyMs,
      errorMessage: null,
      createdAt: new Date().toISOString()
    });

    return { output: validatedOutput, fromCache: false, runId };
  }

  /**
   * Deterministic fallback generator matching Stage 2 Combined Schema
   */
  private generateFallbackResponse(versionId: string, title: string, text: string): string {
    const isRequirement = text.toLowerCase().includes('yêu cầu') || text.toLowerCase().includes('phải') || text.toLowerCase().includes('requirement');

    return JSON.stringify({
      understanding: {
        document_intent: `Tài liệu định nghĩa đặc tả và quy trình cho ${title}`,
        executive_summary: text.slice(0, 180) || `Tóm tắt cho tài liệu ${title}`,
        target_audience: ['Business Analysts', 'QA Engineers', 'Developers'],
        key_domains: ['System Requirements', 'Quality Assurance']
      },
      extraction: {
        extracted_units: [
          {
            unit_type: isRequirement ? 'Requirement' : 'Definition',
            subject: 'Người dùng hệ thống',
            action: 'thực hiện thao tác tra cứu tài liệu và quy chuẩn',
            condition: 'khi đã đăng nhập vào phiên làm việc hợp lệ',
            evidence_level: 'Explicit',
            source_anchor: {
              document_version_id: versionId,
              heading_path: ['1. Giới thiệu tổng quan'],
              char_offset_start: 0,
              char_offset_end: Math.min(text.length, 120),
              exact_quote: text.slice(0, Math.min(text.length, 80)) || 'Nội dung trích dẫn'
            }
          }
        ]
      },
      classification: {
        recommended_category: '02_Business_Requirements',
        confidence_score: 0.92,
        reasoning: 'Tài liệu chứa các từ khóa đặc tả nghiệp vụ và tiêu chuẩn chấp thuận'
      }
    });
  }
}

export const defaultStage2Runner = new Stage2CombinedRunner();
