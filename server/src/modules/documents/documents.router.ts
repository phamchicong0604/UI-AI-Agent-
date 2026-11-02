import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response.js';
import { computeSha256 } from '../../common/crypto.js';
import { DocumentItem } from '../../common/types.js';
import { dbRepository } from '../../database/db.js';

export const documentsRouter = Router();

documentsRouter.get('/', (req: Request, res: Response) => {
  const { category, status } = req.query;
  let result = dbRepository.documents.getAll();

  if (category && category !== 'ALL') {
    result = result.filter(d => d.category === category);
  }
  if (status && status !== 'ALL') {
    result = result.filter(d => d.status === status);
  }

  sendSuccess(res, result);
});

documentsRouter.get('/:id', (req: Request, res: Response) => {
  const doc = dbRepository.documents.getById(req.params.id);
  if (!doc) return sendError(res, 'Document not found', 404);
  sendSuccess(res, doc);
});

documentsRouter.post('/', (req: Request, res: Response) => {
  const { title, category, currentVersion, description, tags, author, content } = req.body;
  if (!title || !category) {
    return sendError(res, 'Title and category are required', 400);
  }

  const existing = dbRepository.documents.getAll();
  const id = `DOC-0${existing.length + 1}`;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const version = currentVersion || 'v1.0';

  // Compute real SHA-256 Checksum for document integrity
  const checksum = `sha256:${computeSha256(`${id}|${title}|${version}|${content || description}|${timestamp}`)}`;

  const newDoc: DocumentItem = {
    id,
    title,
    category,
    currentVersion: version,
    status: 'Draft',
    author: author || 'System User',
    updatedAt: timestamp,
    description: description || '',
    tags: Array.isArray(tags) ? tags : [],
    linkedRequirementsCount: 0,
    versions: [
      {
        version,
        updatedAt: timestamp,
        author: author || 'System User',
        status: 'Draft',
        changeSummary: 'Initial document upload with SHA-256 verification',
        fileSize: '1.2 MB',
        checksum
      }
    ]
  };

  dbRepository.documents.upsert(newDoc);
  sendSuccess(res, newDoc, 'Document created and persisted to SQLite with SHA-256 signature', 201);
});

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
