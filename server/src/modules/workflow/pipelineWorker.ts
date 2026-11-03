import { defaultJobQueue } from './jobQueue.js';
import { defaultWorkflowEngine } from './workflowEngine.js';
import { defaultStage2Runner } from '../ai/stage2Runner.js';
import { db, dbRepository } from '../../database/db.js';
import crypto from 'crypto';

export interface PipelineRunJobPayload {
  documentId: string;
  documentVersionId: string;
  projectId: string;
  documentTitle: string;
  documentText?: string;
}

export function registerPipelineHandlers(): void {
  defaultJobQueue.registerHandler<PipelineRunJobPayload>('PIPELINE_RUN', async (payload, _job, signal) => {
    const { documentId, documentVersionId, projectId, documentTitle } = payload;
    console.log(`[PipelineWorker] Processing PIPELINE_RUN for document ${documentId} (version: ${documentVersionId})`);

    if (signal?.aborted) {
      throw new Error('Pipeline job was cancelled before execution');
    }

    const versionRow = db.prepare(`
      SELECT status, version_no, extracted_content FROM document_versions WHERE id = ?
    `).get(documentVersionId) as { status: string; version_no: string; extracted_content?: string } | undefined;

    const getLatestStatus = (): string => {
      const row = db.prepare(`
        SELECT status FROM document_versions WHERE id = ?
      `).get(documentVersionId) as { status: string } | undefined;
      return row?.status || 'UPLOADED';
    };

    const versionNo = versionRow?.version_no || 'v1.0';
    // Load documentText from DB version row to avoid duplicating full text in jobs table (NEW-12)
    const documentText = payload.documentText || versionRow?.extracted_content || '';

    // 1. Transition UPLOADED -> FILE_PROCESSING (NEW-07: Do not swallow transition failures)
    let status = getLatestStatus();
    if (status === 'UPLOADED') {
      await defaultWorkflowEngine.transition({
        documentId,
        versionNo,
        fromState: 'UPLOADED',
        toState: 'FILE_PROCESSING',
        actor: 'System Worker',
        role: 'System Worker',
        reason: 'Bắt đầu xử lý giải mã tệp tài liệu'
      });
    }

    if (signal?.aborted) throw new Error('Pipeline job cancelled during FILE_PROCESSING');

    // 2. Transition FILE_PROCESSING -> AI_ANALYSIS
    status = getLatestStatus();
    if (status === 'FILE_PROCESSING') {
      await defaultWorkflowEngine.transition({
        documentId,
        versionNo,
        fromState: 'FILE_PROCESSING',
        toState: 'AI_ANALYSIS',
        actor: 'System Worker',
        role: 'System Worker',
        reason: 'Khởi động phân tích Stage 2 AI (Understanding, Extraction, Classification)'
      });
    }

    if (signal?.aborted) throw new Error('Pipeline job cancelled during AI_ANALYSIS');

    // 3. Execute Stage 2 combined runner
    const stage2Result = await defaultStage2Runner.execute({
      projectId,
      documentVersionId,
      documentTitle,
      documentText
    });

    if (signal?.aborted) throw new Error('Pipeline job cancelled after Stage 2 analysis');

    // 4. Save extracted knowledge units and anchor sources with deterministic idempotency keys (NEW-04)
    const extractedUnits = stage2Result.output.extraction?.extracted_units || [];
    db.transaction(() => {
      for (const unit of extractedUnits) {
        const unitSignature = `${documentVersionId}:${unit.subject}:${unit.action}:${unit.condition || ''}:${unit.unit_type}`;
        const unitHash = crypto.createHash('sha256').update(unitSignature).digest('hex').slice(0, 12);
        const unitId = `KU-${documentVersionId}-${unitHash}`;
        const now = new Date().toISOString().replace('T', ' ').slice(0, 16);

        dbRepository.knowledgeUnits.create({
          id: unitId,
          projectId,
          unitType: unit.unit_type,
          content: unit.source_anchor?.exact_quote || unit.action,
          subject: unit.subject,
          action: unit.action,
          condition: unit.condition || null,
          evidenceLevel: unit.evidence_level,
          status: 'Draft',
          createdAt: now,
          updatedAt: now
        });

        if (unit.source_anchor) {
          const srcId = `SRC-${unitId}`;
          dbRepository.knowledgeSources.create({
            id: srcId,
            unitId,
            documentVersionId,
            headingPath: JSON.stringify(unit.source_anchor.heading_path || ['Chung']),
            charOffsetStart: unit.source_anchor.char_offset_start || 0,
            charOffsetEnd: unit.source_anchor.char_offset_end || 0,
            pageNumber: 1,
            exactQuote: unit.source_anchor.exact_quote || '',
            createdAt: now
          });
        }
      }
    })();

    // 5. Transition AI_ANALYSIS -> VALIDATION
    status = getLatestStatus();
    if (status === 'AI_ANALYSIS') {
      await defaultWorkflowEngine.transition({
        documentId,
        versionNo,
        fromState: 'AI_ANALYSIS',
        toState: 'VALIDATION',
        actor: 'System Worker',
        role: 'System Worker',
        reason: 'Hoàn tất trích xuất, chuyển sang thẩm định ngữ nghĩa'
      });
    }

    if (signal?.aborted) throw new Error('Pipeline job cancelled during VALIDATION');

    // 6. Transition VALIDATION -> REVIEW_REQUIRED
    status = getLatestStatus();
    if (status === 'VALIDATION') {
      await defaultWorkflowEngine.transition({
        documentId,
        versionNo,
        fromState: 'VALIDATION',
        toState: 'REVIEW_REQUIRED',
        actor: 'System Worker',
        role: 'System Worker',
        reason: 'Sẵn sàng đưa vào hàng đợi phê duyệt Human Review'
      });
    }

    return {
      documentId,
      extractedUnitsCount: extractedUnits.length,
      category: stage2Result.output.classification?.recommended_category,
      finalState: 'REVIEW_REQUIRED'
    };
  });
}

export function initializePipelineWorkers(): void {
  registerPipelineHandlers();
  defaultJobQueue.start(1000);
}
