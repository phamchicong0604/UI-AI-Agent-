import { describe, it, expect, beforeEach } from 'vitest';
import { db, dbRepository } from '../database/db.js';
import { defaultKnowledgeService } from '../modules/knowledge/knowledgeService.js';
import { defaultWorkflowEngine, WorkflowTransitionError } from '../modules/workflow/workflowEngine.js';
import { TestCaseItem, DocumentItem } from '../common/types.js';

describe('Knowledge Layer & Governance (Epic E6)', () => {
  const testProjectId = `PRJ-KG-${Date.now()}`;
  const testDocId = `DOC-KG-${Date.now()}`;
  const testDocVerId = `${testDocId}-v1.0`;

  beforeEach(() => {
    // 1. Seed project
    db.prepare(`
      INSERT OR REPLACE INTO projects (id, name, key, description, version, author, members_count, ai_policy, data, created_at, updated_at)
      VALUES (?, 'Knowledge Governance Project', 'KGP', 'Project for KG tests', 'v1.0.0', 'Architect', 5, 'ALLOW_EXTERNAL', '{}', '2026-11-03', '2026-11-03')
    `).run(testProjectId);

    // 2. Seed document
    const doc: DocumentItem = {
      id: testDocId,
      projectId: testProjectId,
      title: 'Banking Security Specs',
      category: '02_Business_Requirements',
      currentVersion: 'v1.0',
      status: 'Draft',
      author: 'Lead BA',
      updatedAt: '2026-11-03',
      description: 'Security rules',
      tags: ['Security'],
      linkedRequirementsCount: 0,
      versions: []
    };
    dbRepository.documents.upsert(doc);

    // 3. Seed document version
    db.prepare(`
      INSERT OR REPLACE INTO document_versions (id, document_id, version_no, file_id, extracted_content, status, change_summary, created_by, created_at)
      VALUES (?, ?, 'v1.0', NULL, 'Auth rules', 'VALIDATION', 'Initial', 'Lead BA', '2026-11-03')
    `).run(testDocVerId, testDocId);
  });

  describe('Atomic Knowledge Units & Anchors (E6-T2)', () => {
    it('should create and retrieve knowledge units with exact source anchors', () => {
      const unitId = `KU-TEST-${Date.now()}-1`;
      const sourceId = `SRC-${Date.now()}-1`;

      dbRepository.knowledgeUnits.create({
        id: unitId,
        projectId: testProjectId,
        unitType: 'Requirement',
        content: 'Mật khẩu người dùng phải có ít nhất 12 ký tự gồm chữ hoa, chữ thường và ký tự đặc biệt.',
        subject: 'Mật khẩu người dùng',
        action: 'yêu cầu độ dài tối thiểu 12 ký tự',
        condition: 'khi người dùng thiết lập hoặc đổi mật khẩu',
        evidenceLevel: 'Explicit',
        status: 'Draft',
        createdAt: '2026-11-03 10:00:00',
        updatedAt: '2026-11-03 10:00:00'
      });

      dbRepository.knowledgeSources.create({
        id: sourceId,
        unitId,
        documentVersionId: testDocVerId,
        headingPath: JSON.stringify(['3. Bảo mật', '3.1 Quy tắc Mật khẩu']),
        charOffsetStart: 120,
        charOffsetEnd: 215,
        pageNumber: 4,
        exactQuote: 'Mật khẩu người dùng phải có ít nhất 12 ký tự.',
        createdAt: '2026-11-03 10:00:00'
      });

      const retrievedUnit = dbRepository.knowledgeUnits.getById(unitId);
      expect(retrievedUnit).not.toBeNull();
      expect(retrievedUnit?.unitType).toBe('Requirement');
      expect(retrievedUnit?.evidenceLevel).toBe('Explicit');

      const sources = dbRepository.knowledgeSources.getByUnitId(unitId);
      expect(sources.length).toBe(1);
      expect(sources[0].charOffsetStart).toBe(120);
      expect(sources[0].charOffsetEnd).toBe(215);
      expect(sources[0].exactQuote).toContain('Mật khẩu người dùng');
    });
  });

  describe('Promote Unit to Requirement & BusinessRule (E6-T3)', () => {
    it('should promote approved unit into RequirementItem with precise sourceReferences', async () => {
      const unitId = `KU-PROMOTE-${Date.now()}`;
      const sourceId = `SRC-PROMOTE-${Date.now()}`;

      dbRepository.knowledgeUnits.create({
        id: unitId,
        projectId: testProjectId,
        unitType: 'Requirement',
        content: 'Hệ thống tự động khóa tài khoản sau 5 lần nhập sai mật khẩu.',
        subject: 'Khóa tài khoản đăng nhập',
        action: 'tự động tạm khóa tài khoản trong 30 phút',
        condition: 'khi phát hiện 5 lần nhập sai liên tiếp',
        evidenceLevel: 'Explicit',
        status: 'In Review',
        createdAt: '2026-11-03 10:00:00',
        updatedAt: '2026-11-03 10:00:00'
      });

      dbRepository.knowledgeSources.create({
        id: sourceId,
        unitId,
        documentVersionId: testDocVerId,
        headingPath: JSON.stringify(['Chính sách Đăng nhập']),
        charOffsetStart: 350,
        charOffsetEnd: 420,
        pageNumber: 2,
        exactQuote: 'Tài khoản sẽ bị tạm khóa sau 5 lần nhập sai liên tiếp.',
        createdAt: '2026-11-03 10:00:00'
      });

      const result = await defaultKnowledgeService.promoteUnitToRequirementOrRule(unitId, 'Senior BA');
      expect(result.unit.status).toBe('Approved');
      expect(result.requirement).toBeDefined();

      const req = result.requirement!;
      expect(req.status).toBe('Approved');
      expect(req.title).toContain('Khóa tài khoản đăng nhập');
      expect(req.sourceReferences.length).toBe(1);
      expect(req.sourceReferences[0].documentId).toBe(testDocId);
      expect(req.sourceReferences[0].section).toContain('Offsets: 350-420');

      // Verify Requirement exists in SQLite
      const inDb = dbRepository.requirements.getById(req.id);
      expect(inDb).not.toBeNull();
      expect(inDb?.title).toBe(req.title);
    });
  });

  describe('Conflict Records & Change Impact Cascade (E6-T4)', () => {
    it('should supersede older approved units and shift linked test cases to In Review (E6-T4 AC)', async () => {
      const subject = 'Thời gian timeout phiên làm việc';

      // 1. Older approved unit (v1.0 rule: 30 minutes)
      const oldUnitId = `KU-OLD-${Date.now()}`;
      dbRepository.knowledgeUnits.create({
        id: oldUnitId,
        projectId: testProjectId,
        unitType: 'Requirement',
        content: 'Phiên làm việc tự động ngắt sau 30 phút.',
        subject,
        action: 'ngắt kết nối sau 30 phút',
        condition: null,
        evidenceLevel: 'Explicit',
        status: 'Approved',
        createdAt: '2026-09-01',
        updatedAt: '2026-09-01'
      });

      // Old promoted requirement
      const reqId = `REQ-${oldUnitId.replace('KU-', '')}`;
      dbRepository.requirements.upsert({
        id: reqId,
        title: `${subject}: ngắt kết nối sau 30 phút`,
        description: 'Timeout 30 mins',
        type: 'Functional',
        priority: 'High',
        businessRules: [],
        acceptanceCriteria: [],
        sourceReferences: [],
        status: 'Approved',
        owner: 'BA',
        approver: 'QA Lead',
        createdAt: '2026-09-01',
        updatedAt: '2026-09-01'
      });

      // 2. Test Case linked to old requirement currently Approved
      const tcId = `TC-IMPACT-${Date.now()}`;
      const tc: TestCaseItem = {
        id: tcId,
        requirementId: reqId,
        requirementTitle: 'Thời gian timeout phiên làm việc',
        title: `Kiểm tra ${subject} (30 mins)`,
        scenario: 'Verify session termination',
        preconditions: 'User logged in',
        testData: 'idle 30 mins',
        type: 'Security',
        priority: 'High',
        status: 'Approved', // Currently approved
        version: 'v1.0',
        sourceReferences: [],
        steps: [{ stepNumber: 1, action: 'Idle 30m', expectedResult: 'Logged out' }],
        reviewComments: [],
        relatedEvidenceIds: [],
        createdAt: '2026-09-01',
        updatedAt: '2026-09-01'
      };
      dbRepository.testCases.upsert(tc);

      // 3. New unit arrives (v2.0 rule: 15 minutes instead of 30)
      const newUnitId = `KU-NEW-${Date.now()}`;
      dbRepository.knowledgeUnits.create({
        id: newUnitId,
        projectId: testProjectId,
        unitType: 'Requirement',
        content: 'Phiên làm việc tự động ngắt sau 15 phút (Quy định an ninh mới).',
        subject, // Same subject!
        action: 'ngắt kết nối sau 15 phút',
        condition: null,
        evidenceLevel: 'Explicit',
        status: 'In Review',
        createdAt: '2026-11-03',
        updatedAt: '2026-11-03'
      });

      // Promote new unit
      const promoteRes = await defaultKnowledgeService.promoteUnitToRequirementOrRule(newUnitId, 'Lead BA');
      expect(promoteRes.supersededUnits).toBeGreaterThanOrEqual(1);

      // Verify old unit transitioned to Superseded
      const oldUnitAfter = dbRepository.knowledgeUnits.getById(oldUnitId);
      expect(oldUnitAfter?.status).toBe('Superseded');

      // Verify Change Impact Cascade: Linked Test Case transitioned to 'In Review' (E6-T4.3)
      const tcAfter = dbRepository.testCases.getById(tcId);
      expect(tcAfter?.status).toBe('In Review');
    });

    it('should block transition to ORGANIZED when an unresolved Critical conflict exists (E6-T4 AC)', async () => {
      // 0. Seed units A and B for foreign key integrity
      const unitAId = `KU-CONF-A-${Date.now()}`;
      const unitBId = `KU-CONF-B-${Date.now()}`;

      dbRepository.knowledgeUnits.create({
        id: unitAId,
        projectId: testProjectId,
        unitType: 'Requirement',
        content: 'Hạn mức chuyển khoản 50 triệu.',
        subject: 'Hạn mức chuyển khoản',
        action: 'giới hạn 50 triệu',
        condition: null,
        evidenceLevel: 'Explicit',
        status: 'In Review',
        createdAt: '2026-11-03',
        updatedAt: '2026-11-03'
      });

      dbRepository.knowledgeUnits.create({
        id: unitBId,
        projectId: testProjectId,
        unitType: 'Requirement',
        content: 'Hạn mức chuyển khoản 100 triệu.',
        subject: 'Hạn mức chuyển khoản',
        action: 'giới hạn 100 triệu',
        condition: null,
        evidenceLevel: 'Explicit',
        status: 'In Review',
        createdAt: '2026-11-03',
        updatedAt: '2026-11-03'
      });

      // 1. Create a Critical conflict
      const conflictId = `CONF-${Date.now()}`;
      dbRepository.conflicts.create({
        id: conflictId,
        projectId: testProjectId,
        unitAId,
        unitBId,
        conflictType: 'Contradiction',
        severity: 'Critical', // CRITICAL!
        description: 'Mâu thuẫn hạn mức chuyển khoản: Tài liệu A bảo 50 triệu, Tài liệu B bảo 100 triệu.',
        resolution: 'UNRESOLVED',
        resolvedBy: null,
        resolvedAt: null,
        createdAt: '2026-11-03'
      });

      // 2. Attempting transition to ORGANIZED must fail
      await expect(defaultWorkflowEngine.transition({
        documentId: testDocId,
        fromState: 'REVIEW_REQUIRED',
        toState: 'ORGANIZED',
        actor: 'Admin',
        role: 'Reviewer / Approver'
      })).rejects.toThrow(WorkflowTransitionError);

      // 3. Resolve the conflict
      const resolved = dbRepository.conflicts.resolve(conflictId, 'KEEP_NEW_SUPERSEDE_OLD', 'Lead Architect');
      expect(resolved).toBe(true);

      // 4. Transition to ORGANIZED now succeeds!
      await expect(defaultWorkflowEngine.transition({
        documentId: testDocId,
        fromState: 'REVIEW_REQUIRED',
        toState: 'ORGANIZED',
        actor: 'Admin',
        role: 'Reviewer / Approver',
        reason: 'Conflict resolved, approved by lead architect'
      })).resolves.not.toThrow();

      const docAfter = dbRepository.documents.getById(testDocId);
      expect(docAfter?.status).toBe('Approved');
    });
  });
});
