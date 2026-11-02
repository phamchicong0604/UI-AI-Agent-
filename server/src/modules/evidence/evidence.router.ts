import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response.js';
import { computeSha256 } from '../../common/crypto.js';
import { EvidenceItem } from '../../common/types.js';
import { dbRepository } from '../../database/db.js';

export const evidenceRouter = Router();

evidenceRouter.get('/', (req: Request, res: Response) => {
  const { type, environment } = req.query;
  let result = dbRepository.evidence.getAll();
  if (type && type !== 'ALL') result = result.filter(e => e.type === type);
  if (environment && environment !== 'ALL') result = result.filter(e => e.environment === environment);
  sendSuccess(res, result);
});

evidenceRouter.get('/:id', (req: Request, res: Response) => {
  const evd = dbRepository.evidence.getById(req.params.id);
  if (!evd) return sendError(res, 'Evidence not found', 404);
  sendSuccess(res, evd);
});

evidenceRouter.post('/', (req: Request, res: Response) => {
  const { title, description, type, environment, buildVersion, logPayload, links, createdBy } = req.body;
  if (!title) return sendError(res, 'Title is required', 400);

  const existing = dbRepository.evidence.getAll();
  const id = `EVD-00${existing.length + 1}`;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const storageRef = `s3://docqa-evidence/${(environment || 'qa').toLowerCase()}/${id}.dat`;
  
  // Real SHA-256 Checksum computation of payload & metadata
  const storageChecksum = `sha256:${computeSha256(`${title}|${type}|${environment}|${buildVersion}|${logPayload || ''}|${timestamp}`)}`;

  const newEvd: EvidenceItem = {
    id,
    title,
    description: description || '',
    type: type || 'Screenshot',
    environment: environment || 'QA',
    buildVersion: buildVersion || 'build-1048',
    status: 'Submitted',
    storageRef,
    storageChecksum,
    fileSize: logPayload ? `${(logPayload.length / 1024).toFixed(1)} KB` : '350 KB',
    logPayload: logPayload || undefined,
    createdBy: createdBy || 'QA Engineer',
    createdAt: timestamp,
    links: Array.isArray(links) ? links : []
  };

  dbRepository.evidence.upsert(newEvd);
  sendSuccess(res, newEvd, 'Evidence registered and persisted to SQLite with SHA-256 checksum', 201);
});

evidenceRouter.patch('/:id/verify', (req: Request, res: Response) => {
  const { verifiedBy } = req.body;
  const evd = dbRepository.evidence.getById(req.params.id);
  if (!evd) return sendError(res, 'Evidence not found', 404);

  evd.status = 'Verified';
  evd.verifiedBy = verifiedBy || 'Tech Lead';
  evd.verifiedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);

  dbRepository.evidence.upsert(evd);
  sendSuccess(res, evd, 'Evidence verified');
});
