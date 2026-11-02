import crypto from 'node:crypto';

/**
 * Computes standard SHA-256 hash string (hex encoded) using Node.js crypto
 */
export function computeSha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Formats a SHA-256 hash for UI display (shortened with prefix)
 */
export function formatHashCode(hash: string, short = true): string {
  if (!hash) return 'sha256:00000000...';
  const clean = hash.startsWith('sha256:') ? hash.slice(7) : hash;
  if (short) {
    return `sha256:${clean.slice(0, 10)}...${clean.slice(-4)}`;
  }
  return `sha256:${clean}`;
}

/**
 * Chained block hash calculation for tamper-evident audit logging
 */
export function computeAuditEventHash(
  previousHash: string,
  eventId: string,
  user: string,
  role: string,
  action: string,
  entityType: string,
  entityId: string,
  timestamp: string
): string {
  const payload = `${previousHash}|${eventId}|${user}|${role}|${action}|${entityType}|${entityId}|${timestamp}`;
  return `sha256:${computeSha256(payload)}`;
}
