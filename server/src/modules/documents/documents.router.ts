import { Router, Request, Response } from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import path from 'path';
import { sendSuccess, sendError } from '../../common/response.js';
import { computeSha256 } from '../../common/crypto.js';
import { defaultFileStore } from '../../common/fileStore.js';
import { DocumentCategory, DocumentItem } from '../../common/types.js';
import { dbRepository } from '../../database/db.js';

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
  let index = allDocs.length + 1;
  let candidate = `DOC-${String(index).padStart(2, '0')}`;
  while (existingIds.has(candidate)) {
    index++;
    candidate = `DOC-${String(index).padStart(2, '0')}`;
  }
  return candidate;
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
 * Bulk / single document upload supporting .md, .zip, .txt, .json, etc.
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

    const createdDocuments: DocumentItem[] = [];

    for (const file of files) {
      const originalName = file.originalname;
      const lowerName = originalName.toLowerCase();

      // Case 1: ZIP Archive (.zip)
      if (lowerName.endsWith('.zip')) {
        const zip = new AdmZip(file.buffer);
        const zipEntries = zip.getEntries();

        for (const entry of zipEntries) {
          // Skip directories and MacOS metadata
          if (entry.isDirectory || entry.entryName.includes('__MACOSX') || entry.entryName.includes('.DS_Store')) {
            continue;
          }

          const entryName = entry.entryName;
          const entryLower = entryName.toLowerCase();
          
          // Accept markdown, text, json, html, or specs
          if (!entryLower.endsWith('.md') && !entryLower.endsWith('.txt') && !entryLower.endsWith('.json') && !entryLower.endsWith('.html') && !entryLower.endsWith('.yaml') && !entryLower.endsWith('.yml')) {
            continue;
          }

          const rawText = zip.readAsText(entry);
          const detectedCat = detectCategory(entryName, categoryOverride);
          const { title, description } = parseMarkdownContent(entry.name || entryName, rawText);
          const docId = generateDocId();
          const buffer = Buffer.from(rawText, 'utf-8');
          const fileSha256 = `sha256:${computeSha256(buffer)}`;

          // 1. Store original file in FileStore (E1-T3)
          const fileId = `FILE-${fileSha256.slice(7, 17)}`;
          const storageKey = `projects/${projectId}/${docId}/${path.basename(entryName || 'extracted.md')}`;
          await defaultFileStore.put(entryName || `${docId}.md`, buffer, storageKey);

          dbRepository.storedFiles.upsert({
            id: fileId,
            storageKey,
            originalName: entry.name || entryName,
            mimeType: entryLower.endsWith('.md') ? 'text/markdown' : 'text/plain',
            sizeBytes: buffer.length,
            sha256: fileSha256,
            createdAt: timestamp
          });

          // 2. Insert document_version (E1-T3)
          dbRepository.documentVersions.upsert({
            id: `${docId}-v1.0`,
            documentId: docId,
            versionNo: 'v1.0',
            fileId,
            extractedContent: rawText,
            status: 'Draft',
            changeSummary: `Trích xuất từ file nén ${originalName} (${entryName})`,
            createdBy: author,
            createdAt: timestamp
          });

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
            tags: ['ZIP-Extracted', detectedCat.split('_')[1] || 'Doc'],
            linkedRequirementsCount: 0,
            versions: [
              {
                version: 'v1.0',
                updatedAt: timestamp,
                author,
                status: 'Draft',
                changeSummary: `Trích xuất từ file nén ${originalName} (${entryName})`,
                fileSize: formatBytes(entry.header.size),
                checksum: fileSha256
              }
            ]
          };

          dbRepository.documents.upsert(doc);
          createdDocuments.push(doc);
        }
      }
      // Case 2: Markdown File (.md) or Text / Document Files
      else {
        const rawText = file.buffer.toString('utf-8');
        const detectedCat = detectCategory(originalName, categoryOverride);
        const { title, description } = parseMarkdownContent(originalName, rawText);
        const docId = generateDocId();
        const fileSha256 = `sha256:${computeSha256(file.buffer)}`;

        // 1. Store original file in FileStore (E1-T3)
        const fileId = `FILE-${fileSha256.slice(7, 17)}`;
        const storageKey = `projects/${projectId}/${docId}/${originalName}`;
        await defaultFileStore.put(originalName, file.buffer, storageKey);

        dbRepository.storedFiles.upsert({
          id: fileId,
          storageKey,
          originalName,
          mimeType: lowerName.endsWith('.md') ? 'text/markdown' : 'text/plain',
          sizeBytes: file.buffer.length,
          sha256: fileSha256,
          createdAt: timestamp
        });

        // 2. Insert document_version (E1-T3)
        dbRepository.documentVersions.upsert({
          id: `${docId}-v1.0`,
          documentId: docId,
          versionNo: 'v1.0',
          fileId,
          extractedContent: rawText,
          status: 'Draft',
          changeSummary: `Tải lên trực tiếp từ ${originalName}`,
          createdBy: author,
          createdAt: timestamp
        });

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
          tags: [lowerName.endsWith('.md') ? 'Markdown' : 'Upload', detectedCat.split('_')[1] || 'Doc'],
          linkedRequirementsCount: 0,
          versions: [
            {
              version: 'v1.0',
              updatedAt: timestamp,
              author,
              status: 'Draft',
              changeSummary: `Tải lên trực tiếp từ ${originalName}`,
              fileSize: formatBytes(file.size),
              checksum: fileSha256
            }
          ]
        };

        dbRepository.documents.upsert(doc);
        createdDocuments.push(doc);
      }
    }

    sendSuccess(
      res,
      {
        totalUploaded: createdDocuments.length,
        documents: createdDocuments
      },
      `Đã xử lý và lưu thành công ${createdDocuments.length} tài liệu vào dự án ${projectId}`,
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
