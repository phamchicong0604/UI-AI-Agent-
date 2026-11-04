import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, dbRepository } from '../database/db.js';
import { defaultWorkflowEngine } from '../modules/workflow/workflowEngine.js';
import { RetentionService } from '../modules/documents/retentionService.js';
import { defaultFileStore } from '../common/fileStore.js';

describe('Workflow Supersede & Retention Integrity (Condition 5 - R4-05, R4-09, R4-11)', () => {
  const projectId = 'PRJ-SUPERSEDE-TEST';

  beforeAll(() => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO projects (id, name, key, description, version, author, members_count, ai_policy, data, created_at, updated_at)
      VALUES (?, 'Supersede Test Project', 'STP', 'Test project', 'v1.0.0', 'Admin', 1, 'OFFLINE_ONLY', '{}', ?, ?)
    `).run(projectId, now, now);
  });

  describe('Condition 5 & R4-05: Superseding Older Versions & Auto-Resolving Open Conflicts', () => {
    it('when a new version is created, older version transitions to SUPERSEDED and its open conflicts resolve with KEEP_NEW_SUPERSEDE_OLD', async () => {
      const docId = `DOC-SUPER-${Date.now()}`;
      const now = new Date().toISOString();

      // 1. Create document and older version v1.0 in REVIEW_REQUIRED state
      db.prepare(`
        INSERT INTO documents (id, project_id, category, status, data, updated_at)
        VALUES (?, ?, '01_Project_Overview', 'Review Required', '{}', ?)
      `).run(docId, projectId, now);

      const oldVerId = `${docId}-v1.0`;
      dbRepository.documentVersions.upsert({
        id: oldVerId,
        documentId: docId,
        versionNo: 'v1.0',
        fileId: null,
        extractedContent: '# Version 1.0 Content',
        status: 'REVIEW_REQUIRED',
        changeSummary: 'Old version',
        createdBy: 'Author',
        createdAt: now
      });

      // 2. Create knowledge units and sources for v1.0 in 'In Review' status
      const unit1Id = `KU-${oldVerId}-01`;
      const unit2Id = `KU-${oldVerId}-02`;
      dbRepository.knowledgeUnits.create({
        id: unit1Id,
        projectId,
        unitType: 'Requirement',
        content: 'Timeout 15 minutes',
        subject: 'Timeout',
        action: 'set timeout to 15m',
        condition: null,
        evidenceLevel: 'Explicit',
        status: 'In Review',
        createdAt: now,
        updatedAt: now
      });

      dbRepository.knowledgeUnits.create({
        id: unit2Id,
        projectId,
        unitType: 'Requirement',
        content: 'Timeout 30 minutes',
        subject: 'Timeout',
        action: 'set timeout to 30m',
        condition: null,
        evidenceLevel: 'Explicit',
        status: 'In Review',
        createdAt: now,
        updatedAt: now
      });

      dbRepository.knowledgeSources.create({
        id: `SRC-${unit1Id}`,
        unitId: unit1Id,
        documentVersionId: oldVerId,
        headingPath: '["General"]',
        charOffsetStart: 0,
        charOffsetEnd: 18,
        pageNumber: 1,
        exactQuote: 'Timeout 15 minutes',
        createdAt: now
      });

      // 3. Create open conflict involving unit1Id with UNRESOLVED resolution
      const conflictId = `CONF-${Date.now()}`;
      db.prepare(`
        INSERT INTO conflicts (id, project_id, unit_a_id, unit_b_id, conflict_type, severity, description, resolution, created_at)
        VALUES (?, ?, ?, ?, 'Contradiction', 'Critical', 'Timeout conflict between versions', 'UNRESOLVED', ?)
      `).run(conflictId, projectId, unit1Id, unit2Id, now);

      // Verify initial state
      const preConflict = db.prepare('SELECT resolution, resolved_by FROM conflicts WHERE id = ?').get(conflictId) as any;
      expect(preConflict.resolution).toBe('UNRESOLVED');
      expect(preConflict.resolved_by).toBeNull();

      // 4. Trigger supersede from WorkflowEngine when v1.1 arrives (Condition 5)
      const supersededCount = await defaultWorkflowEngine.supersedePreviousVersions(docId, 'v1.1', 'Lead Reviewer');
      expect(supersededCount).toBe(1);

      // 5. Verify older version status transitioned to SUPERSEDED
      const postOldVer = dbRepository.documentVersions.getById(oldVerId);
      expect(postOldVer?.status).toBe('SUPERSEDED');

      // 6. Verify knowledge units belonging to older version transitioned to Superseded
      const postUnit1 = dbRepository.knowledgeUnits.getById(unit1Id);
      expect(postUnit1?.status).toBe('Superseded');

      // 7. Verify open conflict was properly closed with valid KEEP_NEW_SUPERSEDE_OLD resolution
      const postConflict = db.prepare('SELECT resolution, resolved_by, resolution_notes FROM conflicts WHERE id = ?').get(conflictId) as any;
      expect(postConflict.resolution).toBe('KEEP_NEW_SUPERSEDE_OLD');
      expect(postConflict.resolved_by).toBe('SYSTEM_SUPERSEDED');
      expect(postConflict.resolution_notes).toContain('thay thế bởi v1.1');
    });
  });

  describe('R4-11: Retention Service Deletion Order & JSON Field Lookup', () => {
    it('deletes child test cases, bugs, evidence BEFORE deleting requirements to avoid empty subquery results', async () => {
      const purgeProjId = `PRJ-RETENTION-${Date.now()}`;
      const now = new Date().toISOString();

      // Create purge project
      db.prepare(`
        INSERT INTO projects (id, name, key, description, version, author, members_count, ai_policy, data, created_at, updated_at)
        VALUES (?, 'Purge Project', 'PURGE', 'Testing retention cascade', 'v1.0.0', 'Admin', 1, 'OFFLINE_ONLY', '{}', ?, ?)
      `).run(purgeProjId, now, now);

      // Create requirement
      const reqId = `REQ-RET-${Date.now()}`;
      db.prepare(`
        INSERT INTO requirements (id, project_id, type, priority, status, data, updated_at)
        VALUES (?, ?, 'Functional', 'High', 'Approved', ?, ?)
      `).run(reqId, purgeProjId, JSON.stringify({ id: reqId, projectId: purgeProjId, title: 'Req to be purged' }), now);

      // Create test case linked via requirement_id
      const tcId = `TC-RET-${Date.now()}`;
      db.prepare(`
        INSERT INTO test_cases (id, requirement_id, data, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(tcId, reqId, JSON.stringify({ id: tcId, requirementId: reqId, title: 'Linked Test Case' }), now);

      // Create bug linked via linkedRequirementId
      const bugId = `BUG-RET-${Date.now()}`;
      db.prepare(`
        INSERT INTO bugs (id, data, updated_at)
        VALUES (?, ?, ?)
      `).run(bugId, JSON.stringify({ id: bugId, linkedRequirementId: reqId, title: 'Linked Bug via linkedRequirementId' }), now);

      // Execute retention project deletion
      const result = await RetentionService.cascadeDeleteProject(db, purgeProjId);
      expect(result.projectId).toBe(purgeProjId);

      // Verify requirement is deleted
      const reqRow = db.prepare('SELECT id FROM requirements WHERE id = ?').get(reqId);
      expect(reqRow).toBeUndefined();

      // Verify test case was successfully matched and deleted by subquery
      const tcRow = db.prepare('SELECT id FROM test_cases WHERE id = ?').get(tcId);
      expect(tcRow).toBeUndefined();

      // Verify bug was successfully matched and deleted by linkedRequirementId subquery
      const bugRow = db.prepare('SELECT id FROM bugs WHERE id = ?').get(bugId);
      expect(bugRow).toBeUndefined();
    });
  });

  describe('R4-09: Pipeline State Machine Transitions', () => {
    it('permits System Worker to transition from FILE_PROCESSING and VALIDATION to CANCELLED', () => {
      expect(defaultWorkflowEngine.canTransition('FILE_PROCESSING', 'CANCELLED')).toBe(true);
      expect(defaultWorkflowEngine.canTransition('VALIDATION', 'CANCELLED')).toBe(true);
      expect(defaultWorkflowEngine.checkRolePermission('CANCELLED', 'System Worker')).toBe(true);
    });
  });
});
