import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../../common/response.js';
import { Project } from '../../common/types.js';
import { dbRepository } from '../../database/db.js';
import { authenticateUser, requireAuth, requireRole, checkProjectAccess } from '../../common/auth.js';

export const projectsRouter = Router();

/**
 * GET /api/v1/projects
 * Retrieves all registered projects from SQLite, filtered by user membership if authenticated
 */
projectsRouter.get('/', authenticateUser, (req: Request, res: Response) => {
  try {
    let list = dbRepository.projects.getAll();
    if (req.user && req.user.role !== 'Project Admin') {
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
 * Creates and registers a new project workspace (Restricted to Project Admin / PM)
 */
projectsRouter.post('/', authenticateUser, requireAuth, requireRole(['Project Admin', 'PM / Project Lead']), (req: Request, res: Response) => {
  try {
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

    const nextIndex = all.length + 1;
    const nextId = `PRJ-${String(nextIndex).padStart(2, '0')}`;
    const now = new Date().toISOString().split('T')[0];

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

    dbRepository.projects.upsert(newProject);
    sendSuccess(res, newProject, `Dự án "${newProject.name}" ([${cleanKey}]) đã được tạo thành công!`, 201);
  } catch (err: any) {
    sendError(res, `Failed to create project: ${err.message}`, 500);
  }
});
