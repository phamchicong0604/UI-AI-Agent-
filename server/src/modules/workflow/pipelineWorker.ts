import { defaultJobQueue } from './jobQueue.js';
import { defaultWorkflowEngine } from './workflowEngine.js';
import { defaultStage2Runner } from '../ai/stage2Runner.js';
import { db, dbRepository } from '../../database/db.js';
import crypto from 'crypto';
import { ClassificationScorer } from '../documents/classificationScorer.js';
import { DocumentCategory } from '../../common/types.js';

const SECONDARY_CATEGORY_THRESHOLD = 0.5;
const AMBIGUOUS_PROVISIONAL_CATEGORY: DocumentCategory = '01_Project_Overview';

/**
 * Run the deterministic ClassificationScorer and store its result on the document (M0-T2).
 * Offline only: no LLM or external call. Returns null when the document no longer exists.
 */
async function classifyDocument(documentId: string, versionNo: string, documentTitle: string, documentText: string) {
  const doc = dbRepository.documents.getById(documentId);
  if (!doc) return null;

  const headings = documentText
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^#{1,2}\s+/.test(line))
    .map(line => line.replace(/^#+\s*/, '').trim());

  // The title counts as a heading unless it is already one, or it was merely derived from the file name
  // (the file name is scored separately as the path signal).
  const title = (documentTitle || '').trim();
  const fileStem = (doc.sourcePath || '').split(/[\\/]/).pop()!.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  if (title && title.toLowerCase() !== fileStem.toLowerCase() && !headings.some(h => h.toLowerCase() === title.toLowerCase())) {
    headings.unshift(title);
  }

  const result = ClassificationScorer.score({
    filePath: doc.sourcePath || '',
    headings,
    content: documentText,
    projectId: doc.projectId
  });

  const secondaryCategories = Object.values(result.allScores)
    .filter(s => s.category !== result.primaryCategory && s.score >= SECONDARY_CATEGORY_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .map(s => s.category);

  // Only documents uploaded with AUTO follow the scorer; an explicit (or legacy/unknown) choice is kept.
  const isAuto = doc.categorySource === 'AUTO';
  // Suggest only, do not file (M0-T5): a winner backed by content keywords alone, with no support from the
  // file path or the headings, is handled like an Ambiguous result and waits for a person to confirm it.
  const suggestOnly = result.isAmbiguous || result.isKeywordOnly;
  const targetCategory: DocumentCategory = !isAuto
    ? doc.category
    : suggestOnly ? AMBIGUOUS_PROVISIONAL_CATEGORY : result.primaryCategory;

  doc.classification = {
    suggestedCategory: result.primaryCategory,
    score: result.primaryScore,
    isAmbiguous: result.isAmbiguous,
    versionNo,
    classifiedAt: new Date().toISOString()
  };
  doc.secondaryCategories = secondaryCategories;
  doc.needsHumanReview = isAuto && suggestOnly;
  dbRepository.documents.upsert(doc);

  if (targetCategory !== doc.category) {
    // Existing category-change path: writes the CATEGORY_RECLASSIFIED audit event and never enqueues a job
    await defaultWorkflowEngine.updateDocumentCategory(documentId, targetCategory, 'System Worker', {
      source: 'AUTO',
      role: 'System Worker',
      details: { score: result.primaryScore, isAmbiguous: result.isAmbiguous, isKeywordOnly: result.isKeywordOnly, secondaryCategories }
    });
  }

  return {
    category: targetCategory,
    suggestedCategory: result.primaryCategory,
    score: result.primaryScore,
    isAmbiguous: result.isAmbiguous,
    isKeywordOnly: result.isKeywordOnly,
    secondaryCategories,
    needsHumanReview: doc.needsHumanReview
  };
}

export interface PipelineRunJobPayload {
  documentId: string;
  documentVersionId: string;
  projectId: string;
  documentTitle: string;
  documentText?: string;
}

export function registerPipelineHandlers(): void {
  defaultJobQueue.registerHandler<PipelineRunJobPayload>('PIPELINE_RUN', async (payload, job, signal) => {
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

    const isTerminated = () => {
      const s = getLatestStatus();
      return s === 'SUPERSEDED' || s === 'CANCELLED';
    };

    if (isTerminated()) {
      console.log(`[PipelineWorker] Version ${documentVersionId} is already ${getLatestStatus()}. Aborting pipeline execution.`);
      return { documentId, finalState: getLatestStatus(), skipped: true };
    }

    try {
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
      if (isTerminated()) return { documentId, finalState: getLatestStatus(), skipped: true };

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
      if (isTerminated()) return { documentId, finalState: getLatestStatus(), skipped: true };

      // 3. Execute Stage 2 combined runner with signal-forwarding LLM caller (R4-09)
      const llmCaller = async (prompt: string, callSignal?: AbortSignal): Promise<string> => {
        if (callSignal?.aborted || signal?.aborted) {
          throw new Error('Pipeline job cancelled before LLM invocation');
        }
        return defaultStage2Runner.generateFallbackResponse(documentVersionId, documentTitle, documentText);
      };

      const stage2Result = await defaultStage2Runner.execute({
        projectId,
        documentVersionId,
        documentTitle,
        documentText,
        signal,
        llmCaller
      });

      if (signal?.aborted) throw new Error('Pipeline job cancelled after Stage 2 analysis');
      if (isTerminated()) return { documentId, finalState: getLatestStatus(), skipped: true };

      // 4. Save extracted knowledge units and anchor sources with deterministic quote-anchored idempotency keys (NEW-04)
      const extractedUnits = stage2Result.output.extraction?.extracted_units || [];
      db.transaction(() => {
        for (const unit of extractedUnits) {
          const quote = (unit.source_anchor?.exact_quote || '').trim();
          const startOffset = unit.source_anchor?.char_offset_start ?? '';
          const endOffset = unit.source_anchor?.char_offset_end ?? '';
          const anchorSig = quote ? `${quote}:${startOffset}:${endOffset}` : `${unit.subject}:${unit.action}:${unit.condition || ''}`;
          const unitSignature = `${documentVersionId}:${unit.unit_type}:${anchorSig}`;
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

      if (isTerminated()) return { documentId, finalState: getLatestStatus(), skipped: true };

      // 4.5 Deterministic taxonomy classification; never reached for SUPERSEDED / CANCELLED versions (M0-T2)
      const classification = await classifyDocument(documentId, versionNo, documentTitle, documentText);

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
      if (isTerminated()) return { documentId, finalState: getLatestStatus(), skipped: true };

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
        category: classification?.category ?? stage2Result.output.classification?.recommended_category,
        classification,
        finalState: 'REVIEW_REQUIRED'
      };
    } catch (err: any) {
      const isTimeout = err?.name === 'TimeoutError' ||
                        err?.message?.toLowerCase().includes('timeout') ||
                        String(signal?.reason)?.toLowerCase().includes('timeout');
      const isCancelled = !isTimeout && (signal?.aborted || err?.message?.toLowerCase().includes('cancel'));
      const curStatus = getLatestStatus();

      if (isCancelled) {
        if (['UPLOADED', 'FILE_PROCESSING', 'AI_ANALYSIS', 'VALIDATION'].includes(curStatus)) {
          await defaultWorkflowEngine.transition({
            documentId,
            versionNo,
            fromState: curStatus as any,
            toState: 'CANCELLED',
            actor: 'System Worker',
            role: 'System Worker',
            reason: `Pipeline bị hủy: ${err.message}`
          }).catch(() => {});
        }
      } else if (isTimeout || (job.attempts + 1 >= job.maxAttempts)) {
        if (['UPLOADED', 'FILE_PROCESSING', 'AI_ANALYSIS', 'VALIDATION'].includes(curStatus)) {
          await defaultWorkflowEngine.transition({
            documentId,
            versionNo,
            fromState: curStatus as any,
            toState: 'FAILED',
            actor: 'System Worker',
            role: 'System Worker',
            reason: isTimeout ? `Pipeline timeout: ${err.message}` : `Pipeline thất bại sau ${job.maxAttempts} lần thử: ${err.message}`
          }).catch(() => {});
        }
      }
      throw err;
    }
  });
}

export function initializePipelineWorkers(): void {
  registerPipelineHandlers();
  defaultJobQueue.start(1000);
}
