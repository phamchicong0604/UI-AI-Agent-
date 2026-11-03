import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { UserRole } from './types.js';
import { sendError } from './response.js';

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
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

const AUTH_SECRET = process.env.AUTH_SECRET || 'docqa-enterprise-session-secret-key-2026';

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
  if (/^qa\s*lead$/i.test(trimmed)) return 'Reviewer / Approver'; // QA Lead has approval privileges, standard QA does not
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
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    name: user.name,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 7 // 7 days
  })).toString('base64url');

  const signature = crypto.createHmac('sha256', AUTH_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * Verifies and decodes a signed session token. Returns verified AuthUser or null if invalid/tampered.
 */
export function verifyUserSession(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;

    const expectedSig = crypto.createHmac('sha256', AUTH_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (signature !== expectedSig) return null;

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;

    const role = normalizeRole(decoded.role);
    if (!role) return null;

    return {
      id: decoded.id || `USER-${role.replace(/\s+/g, '-').toUpperCase()}`,
      name: decoded.name || role,
      role
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
