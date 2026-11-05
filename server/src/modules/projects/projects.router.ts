import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response.js';
import { Project } from '../../common/types.js';
import { db, dbRepository } from '../../database/db.js';
import { authenticateUser, requireAuth, checkProjectAccess, getUserRoleInProject, normalizeRole } from '../../common/auth.js';

export const projectsRouter = Router();

/**
 * GET /api/v1/projects
 * Retrieves all registered projects from SQLite, filtered by user membership if authenticated
 */
projectsRouter.get('/', authenticateUser, (req: Request, res: Response) => {
  try {
    let list = dbRepository.projects.getAll();
    const dbUser = req.user ? dbRepository.users.getById(req.user.id) : null;
    const isSystemAdmin = dbUser && normalizeRole(dbUser.role) === 'Project Admin';
    if (req.user && !isSystemAdmin) {
      const allowed = new Set(dbRepository.projectMembers.getProjectsForUser(req.user.id));
      if (req.user.projectId) {
        allowed.add(req.user.projectId);
      }
      list = list.filter(p => allowed.has(p.id));
    }
    sendSuccess(res, list, 'Projects retrieved successfully');
  } catch (err: any) {
    sendError(res, `Failed to get projects: ${err.message}`, 500);
  }
});

/**
 * GET /api/v1/projects/:id
 * Retrieves a single project by ID, verifying user access
 */
projectsRouter.get('/:id', authenticateUser, (req: Request, res: Response) => {
  try {
    if (req.user && !checkProjectAccess(req.user, req.params.id)) {
      return sendError(res, `Bạn không có quyền truy cập dự án "${req.params.id}".`, 403);
    }
    const proj = dbRepository.projects.getById(req.params.id);
    if (!proj) return sendError(res, 'Project not found', 404);
    sendSuccess(res, proj);
  } catch (err: any) {
    sendError(res, `Failed to get project: ${err.message}`, 500);
  }
});

/**
 * POST /api/v1/projects
 * Creates and registers a new project workspace (Restricted to genuine System Admin or PM in DB)
 */
projectsRouter.post('/', authenticateUser, requireAuth, (req: Request, res: Response) => {
  try {
    const dbUser = req.user ? dbRepository.users.getById(req.user.id) : null;
    const userRole = dbUser ? normalizeRole(dbUser.role) : null;
    if (!userRole || !['Project Admin', 'PM / Project Lead'].includes(userRole)) {
      return sendError(res, 'Permission denied: Chỉ Quản trị viên hệ thống hoặc Trưởng dự án mới có quyền tạo dự án mới.', 403);
    }

    const { name, key, description, version, author, membersCount } = req.body;
    if (!name || !key) {
      return sendError(res, 'Project name and key are required', 400);
    }

    const all = dbRepository.projects.getAll();
    const cleanKey = key.trim().toUpperCase();

    // Check key duplication
    if (all.some(p => p.key === cleanKey)) {
      return sendError(res, `Project key "${cleanKey}" already exists`, 409);
    }

    let maxIndex = 0;
    for (const p of all) {
      const match = p.id.match(/^PRJ-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxIndex) maxIndex = num;
      }
    }
    let nextId = `PRJ-${String(maxIndex + 1).padStart(2, '0')}`;
    while (all.some(p => p.id === nextId)) {
      maxIndex++;
      nextId = `PRJ-${String(maxIndex + 1).padStart(2, '0')}`;
    }

    const now = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    const newProject: Project = {
      id: nextId,
      name: name.trim(),
      key: cleanKey,
      description: (description || '').trim(),
      version: (version || 'v1.0.0').trim(),
      author: (author || req.user?.name || 'Project Admin').trim(),
      membersCount: Number(membersCount) || 1,
      createdAt: now,
      updatedAt: now
    };

    const creatorId = req.user?.id || 'usr_admin';
    const creatorRole = req.user?.role || 'PM / Project Lead';

    const tx = db.transaction(() => {
      dbRepository.projects.upsert(newProject);
      // Ensure creator is immediately enrolled as member to prevent 403 on newly created project (R4-08)
      db.prepare(`
        INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(`pm_${newProject.id}_${creatorId}`, newProject.id, creatorId, creatorRole, nowIso);
    });
    tx.immediate();

    sendSuccess(res, newProject, `Dự án "${newProject.name}" ([${cleanKey}]) đã được tạo thành công!`, 201);
  } catch (err: any) {
    sendError(res, `Failed to create project: ${err.message}`, 500);
  }
});

/**
 * GET /api/v1/projects/:id/members
 * Retrieves all members of a project (R6-06)
 */
projectsRouter.get('/:id/members', authenticateUser, (req: Request, res: Response) => {
  if (req.user && !checkProjectAccess(req.user, req.params.id)) {
    return sendError(res, `Bạn không có quyền xem thành viên dự án "${req.params.id}".`, 403);
  }
  const members = dbRepository.projectMembers.listByProject(req.params.id);
  sendSuccess(res, members);
});

/**
 * POST /api/v1/projects/:id/members
 * Adds or updates a project member (Restricted to Project Admin / PM in target project) (R6-06)
 */
projectsRouter.post('/:id/members', authenticateUser, requireAuth, (req: Request, res: Response) => {
  const projId = req.params.id;
  const proj = dbRepository.projects.getById(projId);
  if (!proj) return sendError(res, 'Project not found', 404);

  const effectiveRole = req.user ? getUserRoleInProject(req.user.id, projId) : null;
  if (!effectiveRole || !['Project Admin', 'PM / Project Lead'].includes(effectiveRole)) {
    return sendError(res, `Permission denied: Chỉ Quản trị viên hoặc PM trong dự án "${projId}" mới có quyền gán thành viên.`, 403);
  }

  const { userId, role } = req.body || {};
  if (!userId || !role) return sendError(res, 'userId và role là bắt buộc', 400);

  const targetUser = dbRepository.users.getById(userId);
  if (!targetUser) return sendError(res, 'Người dùng không tồn tại', 404);

  const normRole = normalizeRole(role);
  if (!normRole) return sendError(res, 'Vai trò không hợp lệ', 400);

  dbRepository.projectMembers.addMember(projId, userId, normRole);
  sendSuccess(res, { projectId: projId, userId, role: normRole }, 'Thêm thành viên dự án thành công', 201);
});

/**
 * DELETE /api/v1/projects/:id/members/:userId
 * Removes a member from a project (Restricted to Project Admin / PM in target project) (R6-06)
 */
projectsRouter.delete('/:id/members/:userId', authenticateUser, requireAuth, (req: Request, res: Response) => {
  const { id: projId, userId } = req.params;
  const effectiveRole = req.user ? getUserRoleInProject(req.user.id, projId) : null;
  if (!effectiveRole || !['Project Admin', 'PM / Project Lead'].includes(effectiveRole)) {
    return sendError(res, `Permission denied: Chỉ Quản trị viên hoặc PM trong dự án "${projId}" mới có quyền xóa thành viên.`, 403);
  }

  const deleted = dbRepository.projectMembers.removeMember(projId, userId);
  if (!deleted) {
    return sendError(res, 'Thành viên không tồn tại trong dự án.', 404);
  }
  sendSuccess(res, { projectId: projId, userId }, 'Xóa thành viên khỏi dự án thành công');
});
