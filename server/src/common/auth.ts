import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { UserRole } from './types.js';
import { sendError } from './response.js';
import { dbRepository } from '../database/db.js';

export interface AuthUser {
  id: string;
  username?: string;
  name: string;
  role: UserRole;
  projectId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const VALID_ROLES: readonly UserRole[] = [
  'Project Admin',
  'PM / Project Lead',
  'BA',
  'Tech Lead / DEV',
  'QA',
  'Reviewer / Approver'
];

/**
 * Retrieves the cryptographic session secret.
 * Enforces fail-closed boot requirement: AUTH_SECRET must be set in production/runtime (R2-02).
 */
export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      return 'docqa-test-only-auth-secret-key-32chars-min!!';
    }
    throw new Error('[Security Error] AUTH_SECRET environment variable is strictly required. Server refused to start without a cryptographic secret (R2-02).');
  }
  return secret;
}

/**
 * PBKDF2 Password hashing with salt for enterprise credentials (R2-01)
 */
export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

/**
 * Constant-time password verification preventing timing analysis
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const computed = hashPassword(password, salt);
    const a = Buffer.from(computed, 'hex');
    const b = Buffer.from(hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Normalizes role string to canonical UserRole if compatible
 */
export function normalizeRole(roleInput?: string): UserRole | undefined {
  if (!roleInput) return undefined;
  const trimmed = roleInput.trim();

  if (VALID_ROLES.includes(trimmed as UserRole)) {
    return trimmed as UserRole;
  }

  // Common aliases
  if (/^lead\s*ba$/i.test(trimmed)) return 'BA';
  if (/^qa\s*lead$/i.test(trimmed)) return 'QA'; // BUG-003: QA Lead maps to QA, not Reviewer / Approver
  if (/^admin$/i.test(trimmed)) return 'Project Admin';
  if (/^pm$/i.test(trimmed)) return 'PM / Project Lead';
  if (/^dev$/i.test(trimmed)) return 'Tech Lead / DEV';
  if (/^reviewer$/i.test(trimmed)) return 'Reviewer / Approver';

  return undefined;
}

/**
 * Cryptographically signs a session token using HMAC-SHA256 (NEW-01).
 * Prevents client-side spoofing of roles and user identities in audit trails.
 */
export function signUserSession(user: AuthUser): string {
  const secret = getAuthSecret();
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    projectId: user.projectId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 7 // 7 days
  })).toString('base64url');

  const signature = crypto.createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * Verifies and decodes a signed session token using constant-time comparison (R2-02).
 */
export function verifyUserSession(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;

    const secret = getAuthSecret();
    const expectedSig = crypto.createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature, 'base64url');
    const expectedBuf = Buffer.from(expectedSig, 'base64url');
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;

    const role = normalizeRole(decoded.role);
    if (!role) return null;

    return {
      id: decoded.id || `USER-${role.replace(/\s+/g, '-').toUpperCase()}`,
      username: decoded.username,
      name: decoded.name || role,
      role,
      projectId: decoded.projectId
    };
  } catch {
    return null;
  }
}

/**
 * Middleware that authenticates incoming requests strictly via cryptographically signed session tokens (NEW-01).
 * Headers:
 *   Authorization: Bearer <signed_session_token>
 */
export function authenticateUser(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const verified = verifyUserSession(token);
    if (verified) {
      req.user = verified;
      return next();
    }
  }

  next();
}

/**
 * Guard middleware requiring an authenticated user. Returns 401 if not authenticated.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    sendError(res, 'Unauthorized: Missing or invalid authentication credentials (valid signed session required)', 401);
    return;
  }
  next();
}

/**
 * Guard middleware requiring specific role(s). Returns 401 if unauthenticated, 403 if unauthorized.
 */
export function requireRole(allowedRoles: Array<UserRole | string>) {
  const normalizedAllowed = new Set(
    allowedRoles.map(r => normalizeRole(r) || r)
  );

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Unauthorized: Authentication required (valid signed session required)', 401);
      return;
    }

    if (!normalizedAllowed.has(req.user.role)) {
      sendError(
        res,
        `Permission denied: Role "${req.user.role}" is not authorized for this operation. Required: ${allowedRoles.join(', ')}`,
        403
      );
      return;
    }

    next();
  };
}

/**
 * Verifies that the authenticated user has access to the target project (R3-05).
 * Project Admin has global access. Other roles must belong to the project.
 */
export function checkProjectAccess(user: AuthUser | undefined, targetProjectId: string | undefined): boolean {
  if (!user) return false;
  if (user.role === 'Project Admin') return true;
  if (!targetProjectId) return false;
  if (user.projectId === targetProjectId) return true;
  const memberRole = dbRepository.projectMembers.getRole(targetProjectId, user.id);
  return Boolean(memberRole);
}

/**
 * Middleware ensuring the authenticated user has permission to view/modify the requested project (R3-05).
 */
export function requireProjectAccess(getProjectId: (req: Request) => string | undefined) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Unauthorized: Authentication required (valid signed session required)', 401);
      return;
    }
    const targetProjectId = getProjectId(req);
    if (targetProjectId && !checkProjectAccess(req.user, targetProjectId)) {
      sendError(res, `Permission denied: Bạn không có quyền truy cập dữ liệu thuộc dự án "${targetProjectId}" (R3-05).`, 403);
      return;
    }
    next();
  };
}
