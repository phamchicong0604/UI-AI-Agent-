import { Router, Request, Response } from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import path from 'path';
import { sendSuccess, sendError } from '../../common/response.js';
import { computeSha256 } from '../../common/crypto.js';
import { defaultFileStore } from '../../common/fileStore.js';
import { 
  DocumentCategory, 
  DocumentItem, 
  UploadBatchRecord, 
  UploadBatchItemDetail, 
  UploadBatchStatus 
} from '../../common/types.js';
import { db, dbRepository } from '../../database/db.js';
import { validateFileContent, validateZipArchive } from './uploadSecurity.js';
import { documentParserManager } from './parsers/index.js';
import { SemanticRiskScorer } from '../knowledge/semanticValidator.js';

export const documentsRouter = Router();

// Configure multer for in-memory file handling (up to 50MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

const CATEGORY_MAP: Record<string, DocumentCategory> = {
  '01': '01_Project_Overview',
  '02': '02_Business_Requirements',
  '03': '03_System_Requirements',
  '04': '04_UI_UX',
  '05': '05_Technical_Documents',
  '06': '06_QA',
  '07': '07_EVD_Evidence',
  '08': '08_Change_History'
};

function detectCategory(pathOrName: string, defaultCategory?: string): DocumentCategory {
  if (defaultCategory && defaultCategory !== 'AUTO' && Object.values(CATEGORY_MAP).includes(defaultCategory as DocumentCategory)) {
    return defaultCategory as DocumentCategory;
  }
  const lower = pathOrName.toLowerCase();
  for (const [prefix, cat] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(cat.toLowerCase()) || lower.startsWith(prefix) || lower.includes(`/${prefix}`) || lower.includes(`\\${prefix}`)) {
      return cat;
    }
  }
  if (lower.includes('overview') || lower.includes('charter') || lower.includes('intro') || lower.includes('vision')) return '01_Project_Overview';
  if (lower.includes('brd') || lower.includes('business') || lower.includes('nghiepv') || lower.includes('biz')) return '02_Business_Requirements';
  if (lower.includes('srs') || lower.includes('system') || lower.includes('spec') || lower.includes('hethong')) return '03_System_Requirements';
  if (lower.includes('ui') || lower.includes('ux') || lower.includes('design') || lower.includes('wireframe') || lower.includes('figma')) return '04_UI_UX';
  if (lower.includes('tech') || lower.includes('api') || lower.includes('database') || lower.includes('db') || lower.includes('schema') || lower.includes('architecture')) return '05_Technical_Documents';
  if (lower.includes('qa') || lower.includes('test') || lower.includes('kiemthu') || lower.includes('plan')) return '06_QA';
  if (lower.includes('evidence') || lower.includes('evd') || lower.includes('minhchung') || lower.includes('proof')) return '07_EVD_Evidence';
  if (lower.includes('history') || lower.includes('change') || lower.includes('release') || lower.includes('changelog') || lower.includes('version')) return '08_Change_History';
  return '01_Project_Overview';
}

function parseMarkdownContent(filename: string, rawText: string) {
  const lines = rawText.split('\n');
  let title = '';
  let description = '';

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!title && trimmed.startsWith('# ')) {
      title = trimmed.replace(/^#+\s*/, '').trim();
    } else if (title && !description && trimmed.length > 0 && !trimmed.startsWith('#')) {
      description = trimmed.slice(0, 240);
    }
    if (title && description) break;
  }

  if (!title) {
    title = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    title = title.replace(/\b\w/g, c => c.toUpperCase());
  }

  if (!description) {
    description = `Tài liệu tải lên từ file ${filename} (${rawText.length} ký tự).`;
  }

  return { title, description };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function generateDocId(): string {
  const allDocs = dbRepository.documents.getAll();
  const existingIds = new Set(allDocs.map(d => d.id));
  try {
    const versionDocIds = db.prepare('SELECT DISTINCT document_id FROM document_versions').all() as { document_id: string }[];
    versionDocIds.forEach(v => existingIds.add(v.document_id));
  } catch {}

  let index = existingIds.size + 1;
  let candidate = `DOC-${String(index).padStart(2, '0')}`;
  while (existingIds.has(candidate)) {
    index++;
    candidate = `DOC-${String(index).padStart(2, '0')}`;
  }
  return candidate;
}

/**
 * Check if a file with identical sha256 already exists in this project (E2-T2)
 */
function findDuplicateDoc(sha256: string, projectId: string): { id: string; title: string } | null {
  // 1. Check via stored_files linkage to document_versions
  const existingStored = dbRepository.storedFiles.getBySha256(sha256);
  if (existingStored) {
    const row = db.prepare(`
      SELECT d.id, d.data
      FROM documents d
      JOIN document_versions dv ON dv.document_id = d.id
      WHERE dv.file_id = ? AND d.project_id = ?
      LIMIT 1
    `).get(existingStored.id, projectId) as { id: string; data: string } | undefined;
    if (row) {
      try {
        const parsed = JSON.parse(row.data);
        return { id: row.id, title: parsed.title || row.id };
      } catch {
        return { id: row.id, title: row.id };
      }
    }
  }

  // 2. Also check if any document in the project has a version matching this checksum
  const allDocs = dbRepository.documents.getAll(projectId);
  for (const doc of allDocs) {
    if (doc.versions && doc.versions.some(v => v.checksum === sha256 || v.checksum === `sha256:${sha256}`)) {
      return { id: doc.id, title: doc.title };
    }
  }

  return null;
}

/**
 * GET /api/v1/documents
 * List all documents, optionally filtered by projectId, category, status
 */
documentsRouter.get('/', (req: Request, res: Response) => {
  const { category, status, projectId } = req.query;
  let result = dbRepository.documents.getAll(projectId ? String(projectId) : undefined);

  if (category && category !== 'ALL') {
    result = result.filter(d => d.category === category);
  }
  if (status && status !== 'ALL') {
    result = result.filter(d => d.status === status);
  }

  sendSuccess(res, result);
});

/**
 * GET /api/v1/documents/batches/:id
 * Retrieve upload batch processing status and per-file details (E2-T2)
 */
documentsRouter.get('/batches/:id', (req: Request, res: Response) => {
  const batch = dbRepository.uploadBatches.getById(req.params.id);
  if (!batch) return sendError(res, 'Upload batch not found', 404);
  sendSuccess(res, {
    ...batch,
    batchDetails: batch.batchDetails ? JSON.parse(batch.batchDetails) : []
  });
});

/**
 * GET /api/v1/documents/batches/project/:projectId
 * Retrieve upload batches for a specific project
 */
documentsRouter.get('/batches/project/:projectId', (req: Request, res: Response) => {
  const batches = dbRepository.uploadBatches.getByProjectId(req.params.projectId);
  const formatted = batches.map(b => ({
    ...b,
    batchDetails: b.batchDetails ? JSON.parse(b.batchDetails) : []
  }));
  sendSuccess(res, formatted);
});

/**
 * GET /api/v1/documents/review-queue
 * Prioritized Human Review Queue sorted descending by Risk Score (E8-T1, E8-T2)
 */
documentsRouter.get('/review-queue', (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  const riskFilter = req.query.riskLevel as string | undefined;
  const categoryFilter = req.query.category as string | undefined;

  let docs = dbRepository.documents.getAll(projectId);
  // Target documents needing human review or in draft state
  docs = docs.filter(d => d.status === 'Draft' || d.status === 'In Review' || (d as any).workflowState === 'REVIEW_REQUIRED');

  if (categoryFilter && categoryFilter !== 'ALL') {
    docs = docs.filter(d => d.category === categoryFilter);
  }

  const reviewItems = docs.map(doc => {
    const projId = doc.projectId || 'PRJ-01';
    const dbVersions = dbRepository.documentVersions.getByDocumentId(doc.id);
    const latestDbVer = dbVersions.length > 0 ? dbVersions[0] : null;
    const units = latestDbVer 
      ? dbRepository.knowledgeUnits.getByDocumentVersion(latestDbVer.id) 
      : (dbRepository.knowledgeUnits.getByProject(projId) as any[]);

    const explicitCount = units.filter(u => u.evidenceLevel === 'Explicit').length;
    const inferredCount = units.filter(u => u.evidenceLevel === 'Inferred' || u.evidenceLevel === 'Assumed').length;
    const unknownCount = units.filter(u => u.evidenceLevel === 'Unknown' || u.evidenceLevel === 'Not Specified').length;

    const allConflicts = dbRepository.conflicts.getUnresolvedByProject(projId);
    const unitIds = new Set(units.map(u => u.id));
    const docConflicts = allConflicts.filter(c => unitIds.has(c.unitAId) || unitIds.has(c.unitBId));
    const criticalConflicts = docConflicts.filter(c => c.severity === 'Critical');

    const riskResult = SemanticRiskScorer.calculate({
      criticalConflictsCount: criticalConflicts.length,
      ambiguitiesCount: docConflicts.filter(c => c.conflictType === 'Ambiguity').length + unknownCount,
      unknownTermsCount: unknownCount,
      unsupportedInferencesCount: inferredCount
    });

    return {
      document: doc,
      latestVersion: latestDbVer,
      riskResult,
      unitsCount: units.length,
      explicitCount,
      inferredCount,
      conflictsCount: docConflicts.length,
      criticalConflictsCount: criticalConflicts.length,
      units,
      conflicts: docConflicts
    };
  });

  // AC-E8-1: Sort strictly descending by riskScore (highest risk first)
  reviewItems.sort((a, b) => b.riskResult.riskScore - a.riskResult.riskScore);

  let filtered = reviewItems;
  if (riskFilter && riskFilter !== 'ALL') {
    filtered = reviewItems.filter(item => item.riskResult.riskLevel === riskFilter);
  }

  sendSuccess(res, filtered);
});

/**
 * GET /api/v1/documents/:id
 * Retrieve a single document by ID
 */
documentsRouter.get('/:id', (req: Request, res: Response) => {
  const doc = dbRepository.documents.getById(req.params.id);
  if (!doc) return sendError(res, 'Document not found', 404);
  sendSuccess(res, doc);
});

/**
 * GET /api/v1/documents/:id/file
 * Download/retrieve byte-for-byte original stored file (E1-T3)
 */
documentsRouter.get('/:id/file', async (req: Request, res: Response) => {
  const doc = dbRepository.documents.getById(req.params.id);
  if (!doc) return sendError(res, 'Document not found', 404);

  const versions = dbRepository.documentVersions.getByDocumentId(doc.id);
  const latestVersion = versions[versions.length - 1];
  
  if (latestVersion && latestVersion.fileId) {
    const stored = dbRepository.storedFiles.getById(latestVersion.fileId);
    if (stored) {
      try {
        const buffer = await defaultFileStore.get(stored.storageKey);
        res.setHeader('Content-Type', stored.mimeType || 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${stored.originalName}"`);
        res.setHeader('X-Checksum-SHA256', stored.sha256);
        return res.send(buffer);
      } catch {}
    }
  }

  // Fallback if raw stored file missing
  if (doc.contentMarkdown) {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.id}.md"`);
    return res.send(doc.contentMarkdown);
  }

  return sendError(res, 'Stored file not available for this document', 404);
});

/**
 * POST /api/v1/documents
 * Manual creation of a single document
 */
documentsRouter.post('/', (req: Request, res: Response) => {
  const { title, category, currentVersion, description, tags, author, content, contentMarkdown, projectId } = req.body;
  if (!title || !category) {
    return sendError(res, 'Title and category are required', 400);
  }

  const id = generateDocId();
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const version = currentVersion || 'v1.0';
  const mdContent = contentMarkdown || content || description || '';

  // Compute real SHA-256 Checksum for document integrity
  const checksum = `sha256:${computeSha256(`${id}|${title}|${version}|${mdContent}|${timestamp}`)}`;

  const newDoc: DocumentItem = {
    id,
    projectId: projectId || 'PRJ-01',
    title,
    category,
    currentVersion: version,
    status: 'Draft',
    author: author || 'System User',
    updatedAt: timestamp,
    description: description || '',
    contentMarkdown: mdContent,
    tags: Array.isArray(tags) ? tags : [],
    linkedRequirementsCount: 0,
    versions: [
      {
        version,
        updatedAt: timestamp,
        author: author || 'System User',
        status: 'Draft',
        changeSummary: 'Initial document upload with SHA-256 verification',
        fileSize: formatBytes(Buffer.byteLength(mdContent, 'utf-8')),
        checksum
      }
    ]
  };

  dbRepository.documents.upsert(newDoc);
  sendSuccess(res, newDoc, 'Document created and persisted to SQLite with SHA-256 signature', 201);
});

/**
 * POST /api/v1/documents/upload
 * Bulk / single document upload supporting .md, .zip, .txt, .docx, .pdf, .json (E2-T1, E2-T2, E2-T3)
 */
documentsRouter.post('/upload', upload.array('files'), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      return sendError(res, 'No files were uploaded', 400);
    }

    const projectId = (req.body.projectId as string) || 'PRJ-01';
    const categoryOverride = (req.body.category as string) || 'AUTO';
    const author = (req.body.author as string) || 'System User';
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);

    const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const batchFilename = files.length === 1 ? files[0].originalname : `${files.length} files upload package`;

    // Initialize Batch Record (E2-T2)
    let totalFiles = 0;
    let processedFiles = 0;
    let failedFiles = 0;
    const batchDetails: UploadBatchItemDetail[] = [];
    const createdDocuments: DocumentItem[] = [];

    // Helper: Process an individual content buffer (from file or zip)
    const processItemBuffer = async (
      name: string, 
      buffer: Buffer, 
      mimeType: string, 
      isZipMember = false
    ): Promise<{ success: boolean; document?: DocumentItem; duplicate?: boolean; duplicateOfId?: string; error?: string; statusCode?: number }> => {
      // 1. Security Check (E2-T1)
      const sec = validateFileContent(name, buffer);
      if (!sec.isValid) {
        return { success: false, error: sec.error, statusCode: sec.statusCode || 400 };
      }

      // 2. Duplicate Detection via SHA-256 in same project (E2-T2)
      const fileSha256 = `sha256:${computeSha256(buffer)}`;
      const duplicateDoc = findDuplicateDoc(fileSha256, projectId);
      if (duplicateDoc) {
        // Record relationship duplicate_of instead of creating duplicate document
        try {
          dbRepository.documentRelationships.upsert({
            id: `REL-DUP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            sourceDocId: duplicateDoc.id,
            targetDocId: duplicateDoc.id,
            relationshipType: 'duplicate_of',
            confidenceScore: 1.0,
            createdAt: timestamp
          });
        } catch {}

        return { 
          success: true, 
          duplicate: true, 
          duplicateOfId: duplicateDoc.id 
        };
      }

      // 3. Document Parsing (E2-T3: .md, .txt, .docx, .pdf, .json)
      const parseResult = await documentParserManager.parse(buffer, name, mimeType);
      const rawText = parseResult.markdownText || parseResult.rawText || '';
      const detectedCat = detectCategory(name, categoryOverride);
      const { title, description } = parseMarkdownContent(name, rawText);
      const docId = generateDocId();

      // 4. FileStore byte-for-byte storage (E1-T3)
      const fileId = `FILE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const storageKey = `projects/${projectId}/${docId}/${Date.now()}-${path.basename(name)}`;
      await defaultFileStore.put(name, buffer, storageKey);

      dbRepository.storedFiles.upsert({
        id: fileId,
        storageKey,
        originalName: name,
        mimeType: mimeType || (name.toLowerCase().endsWith('.md') ? 'text/markdown' : 'text/plain'),
        sizeBytes: buffer.length,
        sha256: fileSha256,
        createdAt: timestamp
      });

      // 5. Build tags including warnings like NEEDS_OCR
      const extTag = path.extname(name).replace('.', '').toUpperCase() || 'DOC';
      const docTags = [extTag, detectedCat.split('_')[1] || 'Doc'];
      if (parseResult.warnings && parseResult.warnings.includes('NEEDS_OCR')) {
        docTags.push('NEEDS_OCR');
      }

      const versionChangeSummary = isZipMember 
        ? `Trích xuất từ file nén (${name})`
        : `Tải lên trực tiếp từ ${name}`;

      // 6. Insert Document record first (to satisfy document_versions foreign key)
      const doc: DocumentItem = {
        id: docId,
        projectId,
        title,
        category: detectedCat,
        currentVersion: 'v1.0',
        status: 'Draft',
        author,
        updatedAt: timestamp,
        description,
        contentMarkdown: rawText,
        tags: docTags,
        linkedRequirementsCount: 0,
        versions: [
          {
            version: 'v1.0',
            updatedAt: timestamp,
            author,
            status: 'Draft',
            changeSummary: versionChangeSummary,
            fileSize: formatBytes(buffer.length),
            checksum: fileSha256
          }
        ]
      };

      dbRepository.documents.upsert(doc);

      // 7. Insert Document Version (E1-T3)
      dbRepository.documentVersions.upsert({
        id: `${docId}-v1.0`,
        documentId: docId,
        versionNo: 'v1.0',
        fileId,
        extractedContent: rawText,
        status: 'Draft',
        changeSummary: versionChangeSummary,
        createdBy: author,
        createdAt: timestamp
      });
      return { success: true, document: doc };
    };

    // Iterate through uploaded files
    for (const file of files) {
      const originalName = file.originalname;
      const lowerName = originalName.toLowerCase();

      // Case 1: ZIP Archive (.zip)
      if (lowerName.endsWith('.zip')) {
        // Validate archive safety (zip bombs, path traversal, entry limits)
        const zipSec = validateZipArchive(file.buffer);
        if (!zipSec.isValid) {
          if (files.length === 1) {
            return sendError(res, zipSec.error || 'Invalid ZIP archive', zipSec.statusCode || 400);
          }
          failedFiles++;
          batchDetails.push({
            filename: originalName,
            status: 'FAILED',
            error: zipSec.error,
            sizeBytes: file.size
          });
          continue;
        }

        let zip: AdmZip;
        try {
          zip = new AdmZip(file.buffer);
        } catch (err: any) {
          if (files.length === 1) {
            return sendError(res, `Không thể giải nén tệp ZIP: ${err.message}`, 400);
          }
          failedFiles++;
          batchDetails.push({
            filename: originalName,
            status: 'FAILED',
            error: `Lỗi đọc ZIP: ${err.message}`,
            sizeBytes: file.size
          });
          continue;
        }

        const entries = zip.getEntries();
        for (const entry of entries) {
          // Skip directories and MacOS metadata
          if (entry.isDirectory || entry.entryName.includes('__MACOSX') || entry.entryName.includes('.DS_Store')) {
            continue;
          }

          totalFiles++;
          const entryName = entry.name || path.basename(entry.entryName);

          try {
            const entryBuffer = entry.getData();
            const result = await processItemBuffer(entryName, entryBuffer, '', true);

            if (!result.success) {
              failedFiles++;
              batchDetails.push({
                filename: entryName,
                status: 'FAILED',
                error: result.error,
                sizeBytes: entryBuffer.length
              });
            } else if (result.duplicate) {
              batchDetails.push({
                filename: entryName,
                status: 'DUPLICATE',
                duplicateOfId: result.duplicateOfId,
                sizeBytes: entryBuffer.length
              });
            } else if (result.document) {
              processedFiles++;
              createdDocuments.push(result.document);
              batchDetails.push({
                filename: entryName,
                status: 'SUCCESS',
                documentId: result.document.id,
                sizeBytes: entryBuffer.length
              });
            }
          } catch (err: any) {
            failedFiles++;
            batchDetails.push({
              filename: entryName,
              status: 'FAILED',
              error: err.message
            });
          }
        }
      } 
      // Case 2: Standalone file (.md, .txt, .docx, .pdf, .json)
      else {
        totalFiles++;
        try {
          const result = await processItemBuffer(originalName, file.buffer, file.mimetype, false);

          if (!result.success) {
            if (files.length === 1) {
              return sendError(res, result.error || 'Lỗi kiểm tra tệp', result.statusCode || 400);
            }
            failedFiles++;
            batchDetails.push({
              filename: originalName,
              status: 'FAILED',
              error: result.error,
              sizeBytes: file.size
            });
          } else if (result.duplicate) {
            batchDetails.push({
              filename: originalName,
              status: 'DUPLICATE',
              duplicateOfId: result.duplicateOfId,
              sizeBytes: file.size
            });
          } else if (result.document) {
            processedFiles++;
            createdDocuments.push(result.document);
            batchDetails.push({
              filename: originalName,
              status: 'SUCCESS',
              documentId: result.document.id,
              sizeBytes: file.size
            });
          }
        } catch (err: any) {
          if (files.length === 1) {
            return sendError(res, `Lỗi xử lý tệp ${originalName}: ${err.message}`, 500);
          }
          failedFiles++;
          batchDetails.push({
            filename: originalName,
            status: 'FAILED',
            error: err.message,
            sizeBytes: file.size
          });
        }
      }
    }

    // Determine final batch status (E2-T2)
    let finalStatus: UploadBatchStatus = 'COMPLETED';
    const duplicateCount = batchDetails.filter(d => d.status === 'DUPLICATE').length;

    if (failedFiles > 0 && (processedFiles > 0 || duplicateCount > 0)) {
      finalStatus = 'PARTIAL';
    } else if (failedFiles > 0 && processedFiles === 0 && duplicateCount === 0) {
      finalStatus = 'FAILED';
    }

    const errorSummary = failedFiles > 0
      ? batchDetails.filter(d => d.status === 'FAILED').map(d => `${d.filename}: ${d.error}`).join('; ')
      : null;

    // Persist batch record to database (E2-T2)
    const batchRecord: UploadBatchRecord = {
      id: batchId,
      projectId,
      filename: batchFilename,
      totalFiles,
      processedFiles,
      failedFiles,
      status: finalStatus,
      errorSummary,
      batchDetails: JSON.stringify(batchDetails),
      createdAt: timestamp
    };
    dbRepository.uploadBatches.upsert(batchRecord);

    const message = finalStatus === 'PARTIAL'
      ? `Batch hoàn thành một phần (${processedFiles} thành công, ${failedFiles} lỗi, ${duplicateCount} trùng lặp).`
      : finalStatus === 'COMPLETED'
      ? `Đã xử lý và lưu thành công ${processedFiles} tài liệu (${duplicateCount} trùng lặp) vào dự án ${projectId}.`
      : `Batch xử lý thất bại: ${errorSummary}`;

    sendSuccess(
      res,
      {
        batchId,
        status: finalStatus,
        totalFiles,
        processedFiles,
        failedFiles,
        duplicateCount,
        batchDetails,
        documents: createdDocuments
      },
      message,
      201
    );
  } catch (err: any) {
    sendError(res, `Lỗi tải lên tài liệu: ${err.message}`, 500);
  }
});

/**
 * DELETE /api/v1/documents/:id
 * Remove a document
 */
documentsRouter.delete('/:id', (req: Request, res: Response) => {
  const doc = dbRepository.documents.getById(req.params.id);
  if (!doc) return sendError(res, 'Document not found', 404);

  const deleted = dbRepository.documents.delete(req.params.id);
  if (deleted) {
    sendSuccess(res, { id: req.params.id }, 'Tài liệu đã được xóa thành công');
  } else {
    sendError(res, 'Could not delete document', 500);
  }
});

/**
 * PATCH /api/v1/documents/:id/status
 * Transition document lifecycle status (Draft -> In Review -> Approved, etc.)
 */
documentsRouter.patch('/:id/status', (req: Request, res: Response) => {
  const { status, userRole } = req.body;
  const doc = dbRepository.documents.getById(req.params.id);
  if (!doc) return sendError(res, 'Document not found', 404);

  // Enforce rule BR-AUTH-01: Approver role required
  if (status === 'Approved' && userRole && !['Project Admin', 'Reviewer / Approver', 'PM / Project Lead'].includes(userRole)) {
    return sendError(res, 'Permission denied: Approver or Admin role required to approve document', 403);
  }

  doc.status = status;
  doc.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
  dbRepository.documents.upsert(doc);
  sendSuccess(res, doc, `Document transitioned to ${status}`);
});
