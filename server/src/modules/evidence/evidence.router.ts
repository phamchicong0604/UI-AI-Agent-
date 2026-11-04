import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response.js';
import { computeSha256 } from '../../common/crypto.js';
import { EvidenceItem } from '../../common/types.js';
import { dbRepository } from '../../database/db.js';
import { authenticateUser, requireAuth, checkProjectAccess } from '../../common/auth.js';

export const evidenceRouter = Router();

evidenceRouter.get('/', authenticateUser, (req: Request, res: Response) => {
  const { type, environment, projectId } = req.query;
  const targetProjectId = (projectId as string) || (req.user as any)?.projectId;

  if (req.user && targetProjectId && !checkProjectAccess(req.user, targetProjectId)) {
    return sendError(res, `Bạn không có quyền truy cập minh chứng của dự án "${targetProjectId}".`, 403);
  }

  let result = dbRepository.evidence.getAll();
  if (targetProjectId) {
    result = result.filter(e => (e as any).projectId === targetProjectId || (e as any).project_id === targetProjectId);
  }

  if (type && type !== 'ALL') result = result.filter(e => e.type === type);
  if (environment && environment !== 'ALL') result = result.filter(e => e.environment === environment);
  sendSuccess(res, result);
});

evidenceRouter.get('/:id', authenticateUser, (req: Request, res: Response) => {
  const evd = dbRepository.evidence.getById(req.params.id);
  if (!evd) return sendError(res, 'Evidence not found', 404);
  if (req.user && (evd as any).projectId && !checkProjectAccess(req.user, (evd as any).projectId)) {
    return sendError(res, `Bạn không có quyền truy cập minh chứng thuộc dự án "${(evd as any).projectId}".`, 403);
  }
  sendSuccess(res, evd);
});

evidenceRouter.post('/', authenticateUser, requireAuth, (req: Request, res: Response) => {
  const { title, description, type, environment, buildVersion, logPayload, links, createdBy, projectId } = req.body;
  if (!title) return sendError(res, 'Title is required', 400);

  const projId = projectId || (req.user as any)?.projectId || 'PRJ-01';
  if (req.user && !checkProjectAccess(req.user, projId)) {
    return sendError(res, `Bạn không có quyền tải minh chứng lên dự án "${projId}".`, 403);
  }

  const existing = dbRepository.evidence.getAll();
  const id = `EVD-00${existing.length + 1}`;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const storageRef = `s3://docqa-evidence/${(environment || 'qa').toLowerCase()}/${id}.dat`;
  
  // Real SHA-256 Checksum computation of payload & metadata
  const storageChecksum = `sha256:${computeSha256(`${title}|${type}|${environment}|${buildVersion}|${logPayload || ''}|${timestamp}`)}`;

  const newEvd: EvidenceItem & { projectId?: string } = {
    id,
    projectId: projId,
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
    createdBy: createdBy || req.user?.name || 'QA Engineer',
    createdAt: timestamp,
    links: Array.isArray(links) ? links : []
  };

  dbRepository.evidence.upsert(newEvd as any);
  sendSuccess(res, newEvd, 'Evidence registered and persisted to SQLite with SHA-256 checksum', 201);
});

evidenceRouter.patch('/:id/verify', authenticateUser, requireAuth, (req: Request, res: Response) => {
  const { verifiedBy } = req.body;
  const evd = dbRepository.evidence.getById(req.params.id);
  if (!evd) return sendError(res, 'Evidence not found', 404);

  if (req.user && (evd as any).projectId && !checkProjectAccess(req.user, (evd as any).projectId)) {
    return sendError(res, `Bạn không có quyền xác minh minh chứng thuộc dự án "${(evd as any).projectId}".`, 403);
  }

  evd.status = 'Verified';
  evd.verifiedBy = verifiedBy || req.user?.name || 'Tech Lead';
  evd.verifiedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);

  dbRepository.evidence.upsert(evd);
  sendSuccess(res, evd, 'Evidence verified');
});
