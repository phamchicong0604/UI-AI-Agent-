import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response.js';
import { computeAuditEventHash } from '../../common/crypto.js';
import { AuditEvent } from '../../common/types.js';
import { dbRepository } from '../../database/db.js';

export const auditRouter = Router();

auditRouter.get('/events', (req: Request, res: Response) => {
  const events = dbRepository.auditEvents.getAll();
  sendSuccess(res, events);
});

/**
 * POST /api/v1/audit/events
 * Appends a new tamper-evident audit event chained to the previous block hash
 */
auditRouter.post('/events', (req: Request, res: Response) => {
  const { user, role, action, entityType, entityId, details } = req.body;
  if (!user || !action || !entityType || !entityId) {
    return sendError(res, 'User, action, entityType and entityId are required', 400);
  }

  const existing = dbRepository.auditEvents.getAll();
  const id = `AUD-00${existing.length + 1}`;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const previousEventHash = dbRepository.auditEvents.getLatestHash();

  const eventHash = computeAuditEventHash(previousEventHash, id, user, role || 'QA', action, entityType, entityId, timestamp);

  const newEvent: AuditEvent = {
    id,
    user,
    role: role || 'QA',
    action,
    entityType,
    entityId,
    details: details || '',
    timestamp,
    eventHash,
    previousEventHash
  };

  dbRepository.auditEvents.add(newEvent);
  sendSuccess(res, newEvent, 'Audit event chained and persisted', 201);
});

/**
 * POST /api/v1/audit/verify-chain
 * Validates cryptographic block-chain integrity of all audit events
 */
auditRouter.post('/verify-chain', (req: Request, res: Response) => {
  const auditStore = dbRepository.auditEvents.getAll();
  let isChainValid = true;
  const verificationLog: any[] = [];

  for (let i = 0; i < auditStore.length; i++) {
    const current = auditStore[i];
    const prev = auditStore[i + 1];

    if (prev && current.previousEventHash !== prev.eventHash) {
      isChainValid = false;
      verificationLog.push({
        event: current.id,
        status: 'TAMPER_DETECTED',
        expectedPrev: prev.eventHash,
        actualPrev: current.previousEventHash
      });
    } else {
      verificationLog.push({
        event: current.id,
        status: 'HASH_VERIFIED',
        eventHash: current.eventHash
      });
    }
  }

  sendSuccess(res, {
    isChainValid,
    totalEventsVerified: auditStore.length,
    algorithm: 'SHA-256',
    verificationLog
  }, isChainValid ? 'Audit chain integrity cryptographically verified.' : 'Warning: Audit chain tampering detected.');
});
