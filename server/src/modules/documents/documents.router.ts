import { Router, Request, Response } from 'express';
import crypto, { randomUUID } from 'crypto';
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
  UploadBatchStatus,
  StatusLifecycle
} from '../../common/types.js';
import { db, dbRepository } from '../../database/db.js';
import { validateFileContent, validateZipArchive } from './uploadSecurity.js';
import { documentParserManager } from './parsers/index.js';
import { SemanticRiskScorer } from '../knowledge/semanticValidator.js';
import { authenticateUser, requireRole } from '../../common/auth.js';
import { defaultJobQueue } from '../workflow/jobQueue.js';
import { defaultWorkflowEngine } from '../workflow/workflowEngine.js';

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
 * Manual creation of a single document (BUG-030: Byte-for-byte SHA-256 and stored file integration)
 */
documentsRouter.post('/', async (req: Request, res: Response) => {
  const { title, category, currentVersion, description, tags, author, content, contentMarkdown, projectId } = req.body;
  if (!title || !category) {
    return sendError(res, 'Title and category are required', 400);
  }

  const projId = projectId || 'PRJ-01';
  // Validate project existence
  const proj = dbRepository.projects.getById(projId);
  if (!proj) {
    return sendError(res, `Project "${projId}" does not exist`, 400);
  }

  const id = generateDocId();
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const isoNow = new Date().toISOString();
  const version = currentVersion || 'v1.0';
  const mdContent = contentMarkdown || content || description || '';
  const contentBuf = Buffer.from(mdContent, 'utf-8');

  // Compute real SHA-256 Checksum on content bytes (BUG-030)
  const fileSha256 = crypto.createHash('sha256').update(contentBuf).digest('hex');
  const checksum = `sha256:${fileSha256}`;
  const fileId = `file-${randomUUID()}`;
  const fileName = `${id}.md`;
  const storageKey = `projects/${projId}/${id}/${fileName}`;

  try {
    await defaultFileStore.put(fileName, contentBuf, storageKey);
  } catch (storeErr: any) {
    return sendError(res, `Lỗi lưu trữ tệp tin: ${storeErr.message}`, 500);
  }

  const newDoc: DocumentItem = {
    id,
    projectId: projId,
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
        fileSize: formatBytes(contentBuf.length),
        checksum
      }
    ]
  };

  try {
    const tx = db.transaction(() => {
      dbRepository.storedFiles.upsert({
        id: fileId,
        storageKey,
        originalName: fileName,
        mimeType: 'text/markdown',
        sizeBytes: contentBuf.length,
        sha256: checksum,
        createdAt: isoNow
      });

      dbRepository.documents.upsert(newDoc);

      dbRepository.documentVersions.upsert({
        id: `${id}-${version}`,
        documentId: id,
        versionNo: version,
        fileId,
        extractedContent: mdContent,
        status: 'UPLOADED',
        changeSummary: 'Manual document creation with byte-accurate SHA-256',
        createdBy: author || 'System User',
        createdAt: isoNow
      });

      // Enqueue pipeline worker inside atomic transaction (NEW-08, NEW-12)
      defaultJobQueue.enqueue('PIPELINE_RUN', {
        documentId: id,
        documentVersionId: `${id}-${version}`,
        projectId: projId,
        documentTitle: title
      });
    });

    tx.immediate();

    // Supersede previous versions through state machine (BUG-018)
    await defaultWorkflowEngine.supersedePreviousVersions(id, version, author || 'System User').catch(() => {});

    sendSuccess(res, newDoc, 'Document created and persisted to SQLite with SHA-256 signature', 201);
  } catch (dbErr: any) {
    await defaultFileStore.delete(storageKey).catch(() => {});
    return sendError(res, `Lỗi ghi cơ sở dữ liệu: ${dbErr.message}`, 500);
  }
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
    // Validate project existence immediately (BUG-021)
    const projectRow = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId) as { id: string } | undefined;
    if (!projectRow) {
      return sendError(res, `Dự án "${projectId}" không tồn tại. Vui lòng chọn một dự án hợp lệ trước khi tải lên.`, 400);
    }
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

      // 5. Build tags including warnings like NEEDS_OCR
      const extTag = path.extname(name).replace('.', '').toUpperCase() || 'DOC';
      const docTags = [extTag, detectedCat.split('_')[1] || 'Doc'];
      if (parseResult.warnings && parseResult.warnings.includes('NEEDS_OCR')) {
        docTags.push('NEEDS_OCR');
      }

      const versionChangeSummary = isZipMember 
        ? `Trích xuất từ file nén (${name})`
        : `Tải lên trực tiếp từ ${name}`;

      // 6. Build document item
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

      // 7. Atomic database transaction for stored file, document and version (BUG-021)
      try {
        const itemTx = db.transaction(() => {
          dbRepository.storedFiles.upsert({
            id: fileId,
            storageKey,
            originalName: name,
            mimeType: mimeType || (name.toLowerCase().endsWith('.md') ? 'text/markdown' : 'text/plain'),
            sizeBytes: buffer.length,
            sha256: fileSha256,
            createdAt: timestamp
          });

          dbRepository.documents.upsert(doc);

          dbRepository.documentVersions.upsert({
            id: `${docId}-v1.0`,
            documentId: docId,
            versionNo: 'v1.0',
            fileId,
            extractedContent: rawText,
            status: 'UPLOADED',
            changeSummary: versionChangeSummary,
            createdBy: author,
            createdAt: timestamp
          });

          // Enqueue background processing job atomically (BUG-010, NEW-08, NEW-12)
          defaultJobQueue.enqueue('PIPELINE_RUN', {
            documentId: doc.id,
            documentVersionId: `${docId}-v1.0`,
            projectId,
            documentTitle: doc.title
          });
        });

        itemTx.immediate();

        // Supersede previous versions if updating an existing document (BUG-018)
        await defaultWorkflowEngine.supersedePreviousVersions(doc.id, 'v1.0', author).catch(() => {});
      } catch (dbErr: any) {
        await defaultFileStore.delete(storageKey).catch(() => {});
        return { success: false, error: `Lỗi lưu trữ tài liệu: ${dbErr.message}`, statusCode: 500 };
      }

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
 * Remove a document, cleans up child records and disk files (BUG-023)
 */
documentsRouter.delete(
  '/:id',
  authenticateUser,
  requireRole(['Project Admin', 'PM / Project Lead']),
  async (req: Request, res: Response) => {
    const docId = req.params.id;
    const doc = dbRepository.documents.getById(docId);
    if (!doc) return sendError(res, 'Document not found', 404);

    // Track stored file keys to clean up from disk
    const versionRows = db.prepare(`
      SELECT dv.id as version_id, dv.file_id, sf.storage_key
      FROM document_versions dv
      LEFT JOIN stored_files sf ON sf.id = dv.file_id
      WHERE dv.document_id = ?
    `).all(docId) as Array<{ version_id: string; file_id: string | null; storage_key: string | null }>;

    const fileKeysToClean: string[] = [];

    // Atomic database transaction for document, versions, relationships and stored_files (BUG-023)
    const deleteTx = db.transaction(() => {
      // 1. Delete review_decisions
      db.prepare(`
        DELETE FROM review_decisions
        WHERE target_id IN (SELECT id FROM document_versions WHERE document_id = ?)
      `).run(docId);

      // 2. Delete document_relationships
      db.prepare(`
        DELETE FROM document_relationships
        WHERE source_doc_id = ? OR target_doc_id = ?
      `).run(docId, docId);

      // 3. Delete document_versions
      db.prepare('DELETE FROM document_versions WHERE document_id = ?').run(docId);

      // 4. Delete stored_files if no other version references it
      for (const v of versionRows) {
        if (v.file_id) {
          const ref = db.prepare('SELECT COUNT(*) as count FROM document_versions WHERE file_id = ?').get(v.file_id) as { count: number };
          if (ref.count === 0) {
            db.prepare('DELETE FROM stored_files WHERE id = ?').run(v.file_id);
            if (v.storage_key) {
              fileKeysToClean.push(v.storage_key);
            }
          }
        }
      }

      // 5. Delete documents
      return dbRepository.documents.delete(docId);
    });

    const deleted = deleteTx.immediate();
    if (deleted) {
      // Physically delete from disk only after DB commit, and only if no other stored_files row references the key (BUG-020, BUG-022)
      for (const storageKey of fileKeysToClean) {
        const remaining = db.prepare('SELECT COUNT(*) as count FROM stored_files WHERE storage_key = ?').get(storageKey) as { count: number };
        if (remaining.count === 0) {
          await defaultFileStore.delete(storageKey).catch(() => {});
        }
      }
      sendSuccess(res, { id: docId }, 'Tài liệu đã được xóa thành công');
    } else {
      sendError(res, 'Could not delete document', 500);
    }
  }
);

const VALID_LIFECYCLE_STATUSES: StatusLifecycle[] = ['Draft', 'In Review', 'Approved', 'Rejected', 'Deprecated'];

/**
 * PATCH /api/v1/documents/:id/status
 * Transition document lifecycle status (Draft -> In Review -> Approved, etc.)
 * Strictly validates status and checks approver permissions (BUG-006)
 */
documentsRouter.patch('/:id/status', authenticateUser, (req: Request, res: Response) => {
  const { status } = req.body;
  if (!status || !VALID_LIFECYCLE_STATUSES.includes(status)) {
    return sendError(
      res,
      `Trạng thái tài liệu không hợp lệ. Cho phép: ${VALID_LIFECYCLE_STATUSES.join(', ')}`,
      400
    );
  }

  const doc = dbRepository.documents.getById(req.params.id);
  if (!doc) return sendError(res, 'Document not found', 404);

  // Enforce rule BR-AUTH-01: Approver/Admin role required for terminal/governed transitions (BUG-006)
  if (['Approved', 'Rejected', 'Deprecated'].includes(status)) {
    const userRole = req.user?.role;
    if (!userRole) {
      return sendError(res, `Authentication required: User role must be specified to transition document to ${status}`, 401);
    }
    if (!['Project Admin', 'Reviewer / Approver', 'PM / Project Lead'].includes(userRole)) {
      return sendError(res, `Permission denied: Approver or Admin role required to transition document to ${status}`, 403);
    }
  }

  // Enforce valid lifecycle sequence (BUG-006)
  const currentStatus = doc.status;
  if (currentStatus !== status) {
    const validMoves: Record<string, string[]> = {
      'Draft': ['In Review', 'Rejected', 'Deprecated'],
      'In Review': ['Approved', 'Rejected', 'Draft'],
      'Approved': ['Deprecated', 'In Review'],
      'Rejected': ['Draft', 'In Review'],
      'Deprecated': ['In Review']
    };
    const allowed = validMoves[currentStatus] || [];
    if (!allowed.includes(status)) {
      return sendError(res, `Không thể chuyển trạng thái từ "${currentStatus}" sang "${status}". Thứ tự vòng đời không hợp lệ.`, 400);
    }
  }

  doc.status = status;
  doc.updatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
  dbRepository.documents.upsert(doc);
  sendSuccess(res, doc, `Document transitioned to ${status}`);
});
