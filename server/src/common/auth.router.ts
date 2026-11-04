import { Router, Request, Response } from 'express';
import { signUserSession, verifyUserSession, verifyPassword, normalizeRole, VALID_ROLES, AuthUser } from './auth.js';
import { sendSuccess, sendError } from './response.js';
import { dbRepository } from '../database/db.js';

export const authRouter = Router();

/**
 * POST /api/v1/auth/login
 * Verifies credentials against the server-side users database and returns a signed token (R2-01).
 * The user's role is strictly resolved from the database/project_members, NEVER from client input.
 */
authRouter.post('/login', (req: Request, res: Response) => {
  const { username, password, projectId } = req.body || {};

  if (!username || !password) {
    return sendError(res, 'Vui lòng cung cấp đầy đủ tên đăng nhập và mật khẩu.', 400);
  }

  const dbUser = dbRepository.users.getByUsername(String(username).trim().toLowerCase());
  if (!dbUser) {
    return sendError(res, 'Thông tin đăng nhập không hợp lệ.', 401);
  }

  const isValidPassword = verifyPassword(String(password), dbUser.passwordHash, dbUser.passwordSalt);
  if (!isValidPassword) {
    return sendError(res, 'Thông tin đăng nhập không hợp lệ.', 401);
  }

  // Resolve role from project_members if projectId is specified (R2-01)
  let resolvedRole = dbUser.role;
  const targetProject = projectId || 'PRJ-01';
  const memberRole = dbRepository.projectMembers.getRole(targetProject, dbUser.id);
  if (memberRole) {
    resolvedRole = memberRole;
  }

  const canonicalRole = normalizeRole(resolvedRole) || 'QA';

  const user: AuthUser = {
    id: dbUser.id,
    username: dbUser.username,
    name: dbUser.name,
    role: canonicalRole,
    projectId: targetProject
  };

  const token = signUserSession(user);
  sendSuccess(res, { token, user }, 'Đăng nhập thành công');
});

/**
 * POST /api/v1/auth/session
 * Generates or switches a cryptographic session token with verified server-side credentials (R2-01).
 * Strictly requires either username+password or role+password matching the database.
 * Arbitrary role declaration without valid credentials is rejected with 401.
 */
authRouter.post('/session', (req: Request, res: Response) => {
  const { role, username, password, credential, projectId } = req.body || {};

  // Case 1: Standard login via username and password
  const targetUsername = (username || role || '').toString().trim().toLowerCase();
  const targetPassword = password || credential;

  if (!targetPassword) {
    // If request contains an existing Authorization token, allow role switch if user has Project Admin privileges
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const verified = verifyUserSession(authHeader.slice(7).trim());
      if (verified && verified.role === 'Project Admin' && role) {
        const normalizedTargetRole = normalizeRole(role);
        if (normalizedTargetRole) {
          const switchedUser: AuthUser = {
            id: verified.id,
            username: verified.username,
            name: verified.name,
            role: normalizedTargetRole,
            projectId: projectId || verified.projectId || 'PRJ-01'
          };
          const token = signUserSession(switchedUser);
          return sendSuccess(res, { token, user: switchedUser }, 'Chuyển vai trò quản trị thành công');
        }
      }
    }

    return sendError(
      res,
      'Yêu cầu xác thực: Vui lòng cung cấp mật khẩu/thông tin đăng nhập hợp lệ để cấp phiên làm việc (R2-01).',
      401
    );
  }

  // Find user by username or role alias in database
  let dbUser = dbRepository.users.getByUsername(targetUsername);
  if (!dbUser && role) {
    // Look up default seed user for this role
    const normalizedRole = normalizeRole(role);
    if (normalizedRole) {
      const roleMap: Record<string, string> = {
        'Project Admin': 'admin',
        'PM / Project Lead': 'pm',
        'BA': 'ba',
        'Tech Lead / DEV': 'dev',
        'QA': 'qa',
        'Reviewer / Approver': 'reviewer'
      };
      const userKey = roleMap[normalizedRole];
      if (userKey) {
        dbUser = dbRepository.users.getByUsername(userKey);
      }
    }
  }

  if (!dbUser) {
    return sendError(res, 'Người dùng không tồn tại trong hệ thống.', 401);
  }

  const isValidPassword = verifyPassword(String(targetPassword), dbUser.passwordHash, dbUser.passwordSalt);
  if (!isValidPassword) {
    return sendError(res, 'Mật khẩu xác thực vai trò không chính xác.', 401);
  }

  const targetProject = projectId || 'PRJ-01';
  let resolvedRole = dbUser.role;
  const memberRole = dbRepository.projectMembers.getRole(targetProject, dbUser.id);
  if (memberRole) {
    resolvedRole = memberRole;
  }

  const canonicalRole = normalizeRole(resolvedRole) || 'QA';

  const user: AuthUser = {
    id: dbUser.id,
    username: dbUser.username,
    name: dbUser.name,
    role: canonicalRole,
    projectId: targetProject
  };

  const token = signUserSession(user);
  sendSuccess(res, { token, user }, 'Xác thực phiên làm việc thành công');
});

/**
 * GET /api/v1/auth/me
 * Returns currently authenticated user details
 */
authRouter.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'Chưa đăng nhập.', 401);
  }

  const verified = verifyUserSession(authHeader.slice(7).trim());
  if (!verified) {
    return sendError(res, 'Phiên làm việc hết hạn hoặc không hợp lệ.', 401);
  }

  sendSuccess(res, verified);
});
