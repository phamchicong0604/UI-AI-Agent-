import { Router, Request, Response } from 'express';
import { signUserSession, normalizeRole, VALID_ROLES } from './auth.js';
import { sendSuccess, sendError } from './response.js';

export const authRouter = Router();

/**
 * POST /api/v1/auth/session
 * Generates a cryptographically signed session token for the selected role (NEW-01).
 */
authRouter.post('/session', (req: Request, res: Response) => {
  const { role, name, id } = req.body || {};
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    return sendError(
      res,
      `Vai trò người dùng không hợp lệ. Cho phép: ${VALID_ROLES.join(', ')}`,
      400
    );
  }

  const user = {
    id: id || `USER-${normalizedRole.replace(/\s+/g, '-').toUpperCase()}`,
    name: name || normalizedRole,
    role: normalizedRole
  };

  const token = signUserSession(user);
  sendSuccess(res, { token, user }, 'Xác thực phiên làm việc thành công');
});
