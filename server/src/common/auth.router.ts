import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { signUserSession, verifyUserSession, verifyPassword, normalizeRole, VALID_ROLES, AuthUser, authenticateUser, checkProjectAccess } from './auth.js';
import { sendSuccess, sendError } from './response.js';
import { computeAuditEventHash } from './crypto.js';
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

  // Resolve role from project_members for specified target project (R2-01, R3-05)
  const targetProject = projectId || 'PRJ-01';
  const memberRole = dbRepository.projectMembers.getRole(targetProject, dbUser.id);

  // Enforce project membership: non-admin users cannot log into projects they are not members of (R3-05)
  if (!memberRole && dbUser.role !== 'Project Admin') {
    return sendError(res, `Người dùng "${dbUser.username}" không có quyền truy cập dự án "${targetProject}".`, 403);
  }

  const resolvedRole = memberRole || dbUser.role;
  const canonicalRole = normalizeRole(resolvedRole) || 'QA';

  const user: AuthUser & { mustChangePassword?: boolean } = {
    id: dbUser.id,
    username: dbUser.username,
    name: dbUser.name,
    role: canonicalRole,
    projectId: targetProject,
    mustChangePassword: Boolean(dbUser.mustChangePassword)
  };

  const token = signUserSession(user);
  sendSuccess(res, {
    token,
    user,
    mustChangePassword: Boolean(dbUser.mustChangePassword)
  }, 'Đăng nhập thành công');
});

/**
 * POST /api/v1/auth/change-password
 * Enforces secure password change for authenticated users (R4-15, Condition 4).
 */
authRouter.post('/change-password', authenticateUser, (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return sendError(res, 'Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới.', 400);
  }

  const user = req.user;
  if (!user || !user.username) {
    return sendError(res, 'Unauthorized', 401);
  }

  const username = user.username;
  const dbUser = dbRepository.users.getByUsername(username);
  if (!dbUser) {
    return sendError(res, 'Không tìm thấy thông tin người dùng.', 404);
  }

  if (!verifyPassword(String(currentPassword), dbUser.passwordHash, dbUser.passwordSalt)) {
    return sendError(res, 'Mật khẩu hiện tại không chính xác.', 400);
  }

  if (String(newPassword).length < 8) {
    return sendError(res, 'Mật khẩu mới phải có tối thiểu 8 ký tự.', 400);
  }

  if (String(newPassword) === String(currentPassword)) {
    return sendError(res, 'Mật khẩu mới không được trùng với mật khẩu cũ.', 400);
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(newPassword), salt, 10000, 64, 'sha512').toString('hex');

  const updated = dbRepository.users.updatePassword(dbUser.id, hash, salt);
  if (!updated) {
    return sendError(res, 'Không thể cập nhật mật khẩu.', 500);
  }

  // Record audit trail
  try {
    const latestHash = dbRepository.auditEvents.getLatestHash();
    const eventId = `EVT-PASS-${Date.now()}`;
    const timestamp = new Date().toISOString();
    const action = 'USER_PASSWORD_CHANGE';
    const details = `User "${username}" changed their password.`;
    const eventHash = computeAuditEventHash(latestHash, eventId, username, user.role, action, 'User', user.id, timestamp);
    dbRepository.auditEvents.add({
      id: eventId,
      user: username,
      role: user.role,
      action,
      entityType: 'User',
      entityId: user.id,
      details,
      timestamp,
      previousEventHash: latestHash,
      eventHash
    });
  } catch {}

  return sendSuccess(res, { success: true }, 'Đổi mật khẩu thành công');
});

/**
 * POST /api/v1/auth/session
 * Swapping role / project context for authenticated Project Admin users (R4-06).
 * All standard logins MUST use POST /api/v1/auth/login.
 */
authRouter.post('/session', authenticateUser, (req: Request, res: Response) => {
  const verified = req.user;
  if (!verified) {
    return sendError(res, 'Unauthorized: Yêu cầu đăng nhập trước khi thao tác (R4-01).', 401);
  }

  // Look up user in DB to check genuine global system admin privilege (R5-02)
  const dbUser = dbRepository.users.getById(verified.id);
  const isGlobalAdmin = dbUser && normalizeRole(dbUser.role) === 'Project Admin';
  if (!isGlobalAdmin) {
    return sendError(res, 'Chỉ có Quản trị viên hệ thống (Project Admin) mới có quyền chuyển đổi vai trò phiên làm việc (R4-06, R5-02).', 403);
  }

  const { role, projectId } = req.body || {};
  const targetProject = projectId || verified.projectId || 'PRJ-01';
  if (targetProject && !checkProjectAccess(verified, targetProject)) {
    return sendError(res, `Bạn không có quyền chuyển phiên làm việc sang dự án "${targetProject}".`, 403);
  }
  const normalizedTargetRole = role ? normalizeRole(role) : verified.role;

  if (!normalizedTargetRole) {
    return sendError(res, 'Vai trò không hợp lệ.', 400);
  }

  const switchedUser: AuthUser = {
    id: verified.id,
    username: verified.username,
    name: verified.name,
    role: normalizedTargetRole,
    projectId: targetProject
  };

  // Record audit trail for role/project switch
  try {
    const adminUsername = verified.username || verified.name || 'Admin';
    const latestHash = dbRepository.auditEvents.getLatestHash();
    const eventId = `EVT-SWITCH-${Date.now()}`;
    const timestamp = new Date().toISOString();
    const action = 'ADMIN_ROLE_SWITCH';
    const details = `Admin "${adminUsername}" switched role to "${normalizedTargetRole}" in project "${targetProject}"`;
    const hash = computeAuditEventHash(latestHash, eventId, adminUsername, 'Project Admin', action, 'Document', targetProject, timestamp);

    dbRepository.auditEvents.add({
      id: eventId,
      user: adminUsername,
      role: 'Project Admin',
      action,
      entityType: 'Document',
      entityId: targetProject,
      details,
      timestamp,
      previousEventHash: latestHash,
      eventHash: hash
    });
  } catch {}

  const token = signUserSession(switchedUser);
  return sendSuccess(res, { token, user: switchedUser }, 'Chuyển vai trò quản trị thành công');
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
