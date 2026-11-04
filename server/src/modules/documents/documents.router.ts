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
import { validateFileContent, validateZipArchive, UPLOAD_LIMITS } from './uploadSecurity.js';
import { documentParserManager } from './parsers/index.js';
import { SemanticRiskScorer } from '../knowledge/semanticValidator.js';
import { authenticateUser, requireRole, requireAuth, checkProjectAccess, getUserRoleInProject } from '../../common/auth.js';
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
 * List all documents, optionally filtered by projectId, category, status, enforcing project access
 */
documentsRouter.get('/', authenticateUser, (req: Request, res: Response) => {
  const { category, status } = req.query;
  const reqProjId = (req.query.projectId as string) || (req.user as any)?.projectId;

  if (req.user && reqProjId && !checkProjectAccess(req.user, reqProjId)) {
    return sendError(res, `Bạn không có quyền truy cập tài liệu của dự án "${reqProjId}".`, 403);
  }

  let result = dbRepository.documents.getAll(reqProjId || undefined);

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
documentsRouter.get('/batches/:id', authenticateUser, (req: Request, res: Response) => {
  const batch = dbRepository.uploadBatches.getById(req.params.id);
  if (!batch) return sendError(res, 'Upload batch not found', 404);
  if (req.user && !checkProjectAccess(req.user, batch.projectId)) {
    return sendError(res, `Bạn không có quyền truy cập gói tải lên của dự án "${batch.projectId}".`, 403);
  }
  sendSuccess(res, {
    ...batch,
    batchDetails: batch.batchDetails ? JSON.parse(batch.batchDetails) : []
  });
});

/**
 * GET /api/v1/documents/batches/project/:projectId
 * Retrieve upload batches for a specific project
 */
documentsRouter.get('/batches/project/:projectId', authenticateUser, (req: Request, res: Response) => {
  if (req.user && !checkProjectAccess(req.user, req.params.projectId)) {
    return sendError(res, `Bạn không có quyền truy cập gói tải lên của dự án "${req.params.projectId}".`, 403);
  }
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
documentsRouter.get('/review-queue', authenticateUser, (req: Request, res: Response) => {
  const projectId = (req.query.projectId as string) || (req.user as any)?.projectId;
  if (req.user && projectId && !checkProjectAccess(req.user, projectId)) {
    return sendError(res, `Bạn không có quyền truy cập hàng đợi thẩm định của dự án "${projectId}".`, 403);
  }
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
    const rawUnits = latestDbVer 
      ? dbRepository.knowledgeUnits.getByDocumentVersion(latestDbVer.id) 
      : (dbRepository.knowledgeUnits.getByProject(projId) as any[]);

    // Enrich units with anchor details and top source for UI reader highlighting (BUG-028)
    const units = rawUnits.map(u => {
      const src = (u as any).sources?.[0] || dbRepository.knowledgeSources.getByUnitId(u.id)?.[0];
      return {
        ...u,
        headingPath: u.headingPath || src?.headingPath,
        charOffsetStart: u.charOffsetStart !== undefined && u.charOffsetStart !== null ? u.charOffsetStart : src?.charOffsetStart,
        charOffsetEnd: u.charOffsetEnd !== undefined && u.charOffsetEnd !== null ? u.charOffsetEnd : src?.charOffsetEnd,
        exactQuote: u.exactQuote || src?.exactQuote,
        sources: (u as any).sources || (src ? [src] : [])
      };
    });

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
 * Retrieve a single document by ID, verifying user access
 */
documentsRouter.get('/:id', authenticateUser, (req: Request, res: Response) => {
  const doc = dbRepository.documents.getById(req.params.id);
  if (!doc) return sendError(res, 'Document not found', 404);

  if (req.user && !checkProjectAccess(req.user, doc.projectId)) {
    return sendError(res, `Bạn không có quyền truy cập tài liệu thuộc dự án "${doc.projectId}".`, 403);
  }
  sendSuccess(res, doc);
});

export function getSafeMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const SAFE_MIME_MAP: Record<string, string> = {
    '.md': 'text/markdown; charset=utf-8',
    '.markdown': 'text/markdown; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.zip': 'application/zip',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg'
  };

  return SAFE_MIME_MAP[ext] || 'application/octet-stream';
}

/**
 * GET /api/v1/documents/:id/file
 * Download/retrieve byte-for-byte original stored file with verified Content-Type (BUG-031, R3-06, BUG-019, R4-10, R4-16)
 */
documentsRouter.get('/:id/file', authenticateUser, async (req: Request, res: Response) => {
  const doc = dbRepository.documents.getById(req.params.id);
  if (!doc) return sendError(res, 'Document not found', 404);

  if (req.user && !checkProjectAccess(req.user, doc.projectId)) {
    return sendError(res, `Bạn không có quyền tải tệp tin từ dự án "${doc.projectId}".`, 403);
  }

  const versions = dbRepository.documentVersions.getByDocumentId(doc.id);
  const targetVersionNo = (req.query.version as string) || (req.query.versionNo as string) || doc.currentVersion;
  const targetVersion = (targetVersionNo ? versions.find(v => v.versionNo === targetVersionNo) : null) || versions[versions.length - 1];
  
  if (targetVersion && targetVersion.fileId) {
    const stored = dbRepository.storedFiles.getById(targetVersion.fileId);
    if (stored) {
      try {
        const buffer = await defaultFileStore.get(stored.storageKey);
        const safeMime = getSafeMimeType(stored.originalName);
        const safeFilename = path.basename(stored.originalName).replace(/["\r\n\\]/g, '_');
        const encodedFilename = encodeURIComponent(path.basename(stored.originalName));
        res.setHeader('Content-Type', safeMime);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`);
        res.setHeader('X-Checksum-SHA256', stored.sha256);
        return res.send(buffer);
      } catch {}
    }
  }

  // Fallback if raw stored file missing (BUG-019: prefer target version's extracted content over doc.contentMarkdown)
  const versionText = targetVersion?.extractedContent || doc.contentMarkdown;
  if (versionText) {
    const safeDocName = `${doc.id}.md`.replace(/["\r\n\\]/g, '_');
    const encodedDocName = encodeURIComponent(`${doc.id}.md`);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${safeDocName}"; filename*=UTF-8''${encodedDocName}`);
    return res.send(versionText);
  }

  return sendError(res, 'Stored file not available for this document', 404);
});

/**
 * POST /api/v1/documents
 * Manual creation of a single document (BUG-030: Byte-for-byte SHA-256 and stored file integration)
 */
documentsRouter.post('/', authenticateUser, requireAuth, async (req: Request, res: Response) => {
  const { title, category, currentVersion, description, tags, author, content, contentMarkdown, projectId } = req.body;
  if (!title || !category) {
    return sendError(res, 'Title and category are required', 400);
  }

  const projId = projectId || (req.user as any)?.projectId || 'PRJ-01';
  if (req.user && !checkProjectAccess(req.user, projId)) {
    return sendError(res, `Bạn không có quyền tạo tài liệu trong dự án "${projId}".`, 403);
  }

  // Validate project existence
  const proj = dbRepository.projects.getById(projId);
  if (!proj) {
    return sendError(res, `Project "${projId}" does not exist`, 400);
  }

  if (req.body.id) {
    const existingDoc = dbRepository.documents.getById(req.body.id);
    if (existingDoc && existingDoc.projectId !== projId) {
      return sendError(res, 'Tài liệu thuộc dự án khác. Không được phép ghi đè chéo dự án (R4-03).', 403);
    }
  }

  const isExistingDoc = Boolean(req.body.id && dbRepository.documents.getById(req.body.id));
  const id = isExistingDoc ? req.body.id : generateDocId();
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

    // Supersede previous versions through state machine for existing documents (BUG-018, R2-12)
    if (isExistingDoc) {
      await defaultWorkflowEngine.supersedePreviousVersions(id, version, author || 'System User').catch(() => {});
    }

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
documentsRouter.post('/upload', authenticateUser, requireAuth, upload.array('files'), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      return sendError(res, 'No files were uploaded', 400);
    }

    const projectId = (req.body.projectId as string) || (req.user as any)?.projectId || 'PRJ-01';
    // Validate project existence immediately (BUG-021)
    const projectRow = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId) as { id: string } | undefined;
    if (!projectRow) {
      return sendError(res, `Dự án "${projectId}" không tồn tại. Vui lòng chọn một dự án hợp lệ trước khi tải lên.`, 400);
    }
    if (req.user && !checkProjectAccess(req.user, projectId)) {
      return sendError(res, `Bạn không có quyền tải tài liệu lên dự án "${projectId}".`, 403);
    }
    const categoryOverride = (req.body.category as string) || 'AUTO';
    const author = req.user?.name || (req.body.author as string) || 'System User';
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
            mimeType: getSafeMimeType(name),
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
            if (entryBuffer.length > UPLOAD_LIMITS.MAX_ZIP_TOTAL_UNCOMPRESSED) {
              failedFiles++;
              batchDetails.push({
                filename: entryName,
                status: 'FAILED',
                error: `Tệp con "${entryName}" vượt quá dung lượng giải nén an toàn (${(UPLOAD_LIMITS.MAX_ZIP_TOTAL_UNCOMPRESSED / (1024 * 1024)).toFixed(0)}MB).`,
                sizeBytes: entryBuffer.length
              });
              continue;
            }
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

    if (req.user && !checkProjectAccess(req.user, doc.projectId)) {
      return sendError(res, `Bạn không có quyền xóa tài liệu thuộc dự án "${doc.projectId}".`, 403);
    }

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
documentsRouter.patch('/:id/status', authenticateUser, requireAuth, (req: Request, res: Response) => {
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

  if (req.user && !checkProjectAccess(req.user, doc.projectId)) {
    return sendError(res, `Bạn không có quyền chuyển đổi trạng thái tài liệu thuộc dự án "${doc.projectId}".`, 403);
  }

  // Enforce rule BR-AUTH-01: Approver/Admin role required in this specific project for governed transitions (Condition 3, BUG-006, R2-10)
  const targetDocProj = doc.projectId || 'PRJ-01';
  const effectiveRole = req.user ? (getUserRoleInProject(req.user.id, targetDocProj) || req.user.role) : null;
  if (['Approved', 'Rejected', 'Deprecated'].includes(status) || doc.status === 'Approved') {
    if (!effectiveRole || !['Project Admin', 'Reviewer / Approver', 'PM / Project Lead'].includes(effectiveRole)) {
      return sendError(res, `Permission denied: Vai trò "${effectiveRole || 'QA'}" trong dự án "${doc.projectId}" không có quyền phê duyệt/chuyển trạng thái tài liệu (Condition 3).`, 403);
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

/**
 * POST /api/v1/documents/:id/versions
 * Upload a new version for an existing document, superseding previous versions (BUG-018, R2-12)
 */
documentsRouter.post('/:id/versions', authenticateUser, requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  const doc = dbRepository.documents.getById(req.params.id);
  if (!doc) return sendError(res, 'Document not found', 404);

  if (req.user && !checkProjectAccess(req.user, doc.projectId)) {
    return sendError(res, `Bạn không có quyền tải phiên bản mới cho tài liệu thuộc dự án "${doc.projectId}".`, 403);
  }

  const file = req.file;
  const contentBody = req.body.content || req.body.contentMarkdown;
  if (!file && !contentBody) {
    return sendError(res, 'Either a file or contentMarkdown is required', 400);
  }

  const currentVersions = dbRepository.documentVersions.getByDocumentId(doc.id);
  if (req.body.versionNo && currentVersions.some(v => v.versionNo === req.body.versionNo)) {
    return sendError(res, `Phiên bản "${req.body.versionNo}" đã tồn tại cho tài liệu này. Không được ghi đè phiên bản cũ.`, 409);
  }

  const author = req.user?.name || req.body.author || 'System User';
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const isoNow = new Date().toISOString();

  let buffer: Buffer;
  let fileName: string;
  let mimeType: string;

  if (file) {
    buffer = file.buffer;
    fileName = file.originalname;
    mimeType = file.mimetype;
  } else {
    buffer = Buffer.from(contentBody, 'utf-8');
    fileName = `${doc.id}.md`;
    mimeType = 'text/markdown';
  }

  // Security check
  const sec = validateFileContent(fileName, buffer);
  if (!sec.isValid) {
    return sendError(res, sec.error || 'Invalid file content', sec.statusCode || 400);
  }

  const parseResult = await documentParserManager.parse(buffer, fileName, mimeType);
  const rawText = parseResult.markdownText || parseResult.rawText || '';

  let maxMinor = -1;
  for (const v of currentVersions) {
    const match = v.versionNo.match(/^v?1\.(\d+)$/);
    if (match) {
      const minor = parseInt(match[1], 10);
      if (minor > maxMinor) maxMinor = minor;
    }
  }

  let nextVersionNo = req.body.versionNo;
  if (!nextVersionNo) {
    nextVersionNo = maxMinor >= 0 ? `v1.${maxMinor + 1}` : `v1.${currentVersions.length}`;
    while (currentVersions.some(v => v.versionNo === nextVersionNo)) {
      maxMinor++;
      nextVersionNo = `v1.${maxMinor + 1}`;
    }
  }

  if (currentVersions.some(v => v.versionNo === nextVersionNo)) {
    return sendError(res, `Phiên bản "${nextVersionNo}" đã tồn tại cho tài liệu này. Không được ghi đè phiên bản cũ.`, 409);
  }
  const versionId = `${doc.id}-${nextVersionNo}`;

  const fileSha256 = `sha256:${computeSha256(buffer)}`;
  const fileId = `file-${randomUUID()}`;
  const storageKey = `projects/${doc.projectId}/${doc.id}/${Date.now()}-${fileName}`;

  try {
    await defaultFileStore.put(fileName, buffer, storageKey);

    const tx = db.transaction(() => {
      dbRepository.storedFiles.upsert({
        id: fileId,
        storageKey,
        originalName: fileName,
        mimeType: getSafeMimeType(fileName),
        sizeBytes: buffer.length,
        sha256: fileSha256,
        createdAt: isoNow
      });

      dbRepository.documentVersions.upsert({
        id: versionId,
        documentId: doc.id,
        versionNo: nextVersionNo,
        fileId,
        extractedContent: rawText,
        status: 'UPLOADED',
        changeSummary: req.body.changeSummary || `Uploaded version ${nextVersionNo}`,
        createdBy: author,
        createdAt: isoNow
      });

      doc.currentVersion = nextVersionNo;
      doc.updatedAt = timestamp;
      doc.versions = [
        {
          version: nextVersionNo,
          updatedAt: timestamp,
          author,
          status: 'Draft',
          changeSummary: req.body.changeSummary || `Uploaded version ${nextVersionNo}`,
          fileSize: formatBytes(buffer.length),
          checksum: fileSha256
        },
        ...(doc.versions || [])
      ];
      dbRepository.documents.upsert(doc);

      defaultJobQueue.enqueue('PIPELINE_RUN', {
        documentId: doc.id,
        documentVersionId: versionId,
        projectId: doc.projectId,
        documentTitle: doc.title
      });
    });

    tx.immediate();

    // Supersede previous versions via workflow engine (BUG-018, R2-12)
    const supersededCount = await defaultWorkflowEngine.supersedePreviousVersions(doc.id, nextVersionNo, author);

    sendSuccess(res, {
      documentId: doc.id,
      versionNo: nextVersionNo,
      supersededCount,
      versionId
    }, `Đã tạo phiên bản mới ${nextVersionNo} và thay thế các phiên bản trước đó thành công`, 201);
  } catch (err: any) {
    await defaultFileStore.delete(storageKey).catch(() => {});
    return sendError(res, `Lỗi tạo phiên bản mới: ${err.message}`, 500);
  }
});
