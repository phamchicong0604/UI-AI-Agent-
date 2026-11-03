import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { DatabaseMigrator } from '../database/migrator.js';
import { allMigrations } from '../database/migrations/index.js';
import {
  SemanticRiskScorer,
  SemanticValidator,
  CandidateKnowledgeUnit
} from '../modules/knowledge/semanticValidator.js';

describe('Semantic Validation & Risk Scoring (Epic E7-T3, E7-T4)', () => {
  let db: InstanceType<typeof Database>;
  const projectId = 'proj-semantic-test';

  beforeEach(() => {
    db = new Database(':memory:');
    const migrator = new DatabaseMigrator(db, allMigrations);
    migrator.runPendingMigrations();

    // Seed test project
    db.prepare(`
      INSERT OR REPLACE INTO projects (id, name, key, description, version, author, members_count, ai_policy, data, created_at, updated_at)
      VALUES (?, 'Semantic Test Project', 'SEM', 'Testing semantic validator', 'v1.0.0', 'QA Lead', 3, 'ALLOW_EXTERNAL', '{}', datetime('now'), datetime('now'))
    `).run(projectId);
  });

  afterEach(() => {
    db.close();
  });

  describe('SemanticRiskScorer (E7-T3)', () => {
    it('accurately calculates risk breakdown and caps total score at 100', () => {
      const result = SemanticRiskScorer.calculate({
        criticalConflictsCount: 3, // 3 * 30 = 90
        ambiguitiesCount: 2,       // 2 * 15 = 30
        unknownTermsCount: 1,      // 1 * 10 = 10
        unsupportedInferencesCount: 1 // 1 * 10 = 10 -> total 140 -> capped at 100
      });

      expect(result.riskScore).toBe(100);
      expect(result.riskLevel).toBe('HIGH');
      expect(result.breakdown.criticalConflictPenalty).toBe(90);
      expect(result.breakdown.ambiguityPenalty).toBe(30);
      expect(result.breakdown.unknownTermPenalty).toBe(10);
      expect(result.breakdown.unsupportedInferencePenalty).toBe(10);
      expect(result.reviewPriorityOrder).toBe(100);
    });

    it('strictly guarantees that auto-approve is never allowed regardless of low risk score', () => {
      const cleanResult = SemanticRiskScorer.calculate({
        criticalConflictsCount: 0,
        ambiguitiesCount: 0,
        unknownTermsCount: 0,
        unsupportedInferencesCount: 0
      });

      expect(cleanResult.riskScore).toBe(0);
      expect(cleanResult.riskLevel).toBe('LOW');
      // BR-AI-01: Auto approve is strictly false; all units must undergo human governance
      expect(cleanResult.autoApproveAllowed).toBe(false);
    });

    it('classifies risk levels correctly into LOW, MEDIUM, and HIGH', () => {
      const low = SemanticRiskScorer.calculate({
        criticalConflictsCount: 0,
        ambiguitiesCount: 1, // 15
        unknownTermsCount: 0,
        unsupportedInferencesCount: 0
      });
      expect(low.riskLevel).toBe('LOW');

      const medium = SemanticRiskScorer.calculate({
        criticalConflictsCount: 1, // 30
        ambiguitiesCount: 1,       // 15 -> 45
        unknownTermsCount: 0,
        unsupportedInferencesCount: 0
      });
      expect(medium.riskLevel).toBe('MEDIUM');

      const high = SemanticRiskScorer.calculate({
        criticalConflictsCount: 2, // 60
        ambiguitiesCount: 0,
        unknownTermsCount: 0,
        unsupportedInferencesCount: 0
      });
      expect(high.riskLevel).toBe('HIGH');
    });
  });

  describe('SemanticValidator against Approved Knowledge (E7-T4)', () => {
    it('only uses Approved units as ground truth, ignoring Draft or Rejected units', () => {
      const now = new Date().toISOString();

      // Seed a draft unit and a rejected unit
      db.prepare(`
        INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, evidence_level, status, created_at, updated_at)
        VALUES 
          ('ku-draft', ?, 'Requirement', 'Timeout phiên là 15m', 'Timeout phiên', 'Thiết lập', 'Explicit', 'Draft', ?, ?),
          ('ku-rejected', ?, 'Requirement', 'Timeout phiên là 20m', 'Timeout phiên', 'Thiết lập', 'Explicit', 'Rejected', ?, ?)
      `).run(projectId, now, now, projectId, now, now);

      const candidate: CandidateKnowledgeUnit = {
        id: 'cand-01',
        project_id: projectId,
        unit_type: 'Requirement',
        subject: 'Timeout phiên',
        action: 'Thiết lập',
        content: 'Timeout phiên là 60m',
        evidence_level: 'Explicit'
      };

      // Candidate must also exist in knowledge_units if foreign keys are enforced by SQLite
      db.prepare(`
        INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, evidence_level, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?)
      `).run(candidate.id, candidate.project_id, candidate.unit_type, candidate.content, candidate.subject, candidate.action, candidate.evidence_level, now, now);

      const { conflicts } = SemanticValidator.validateAgainstApproved(db, candidate);

      // No conflict detected because no APPROVED unit exists for this subject
      expect(conflicts.length).toBe(0);
    });

    it('detects numeric contradiction with approved unit and records Critical conflict in database', () => {
      const now = new Date().toISOString();

      // 1. Existing Approved unit (e.g. from Document 1)
      const approvedUnitId = 'ku-appr-timeout';
      db.prepare(`
        INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, evidence_level, status, created_at, updated_at)
        VALUES (?, ?, 'Requirement', 'Thời gian timeout phiên đăng nhập là 15m.', 'Timeout phiên', 'Thiết lập timeout', 'Explicit', 'Approved', ?, ?)
      `).run(approvedUnitId, projectId, now, now);

      // 2. Incoming Candidate unit (e.g. from Document 2 uploaded later)
      const candidate: CandidateKnowledgeUnit = {
        id: 'cand-timeout-30',
        project_id: projectId,
        unit_type: 'Requirement',
        subject: 'Timeout phiên',
        action: 'Thiết lập timeout',
        content: 'Thời gian timeout phiên đăng nhập là 30m.',
        evidence_level: 'Explicit'
      };

      db.prepare(`
        INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, evidence_level, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?)
      `).run(candidate.id, candidate.project_id, candidate.unit_type, candidate.content, candidate.subject, candidate.action, candidate.evidence_level, now, now);

      const { conflicts, riskResult } = SemanticValidator.validateAgainstApproved(db, candidate);

      expect(conflicts.length).toBe(1);
      const conflict = conflicts[0];
      expect(conflict.conflictType).toBe('Contradiction');
      expect(conflict.severity).toBe('Critical');
      expect(conflict.unitAId).toBe(candidate.id);
      expect(conflict.unitBId).toBe(approvedUnitId);
      expect(conflict.description).toContain('conflicts with approved specification');

      expect(riskResult.riskLevel).toBe('MEDIUM'); // 1 critical conflict = 30 score -> MEDIUM
      expect(riskResult.factors.criticalConflictsCount).toBe(1);

      // Verify persisted directly in SQLite conflicts table
      const savedConflict = db.prepare(`SELECT * FROM conflicts WHERE unit_a_id = ?`).get(candidate.id) as any;
      expect(savedConflict).toBeDefined();
      expect(savedConflict.severity).toBe('Critical');
      expect(savedConflict.resolution).toBe('UNRESOLVED');
    });

    it('detects policy contradiction (mandatory vs optional) with approved unit', () => {
      const now = new Date().toISOString();

      const approvedUnitId = 'ku-appr-mfa';
      db.prepare(`
        INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, evidence_level, status, created_at, updated_at)
        VALUES (?, ?, 'BusinessRule', 'Xác thực đa nhân tố MFA là bắt buộc với mọi tài khoản quản trị.', 'Xác thực MFA', 'Bắt buộc xác thực', 'Explicit', 'Approved', ?, ?)
      `).run(approvedUnitId, projectId, now, now);

      const candidate: CandidateKnowledgeUnit = {
        id: 'cand-mfa-optional',
        project_id: projectId,
        unit_type: 'BusinessRule',
        subject: 'Xác thực MFA',
        action: 'Bắt buộc xác thực',
        content: 'Xác thực đa nhân tố MFA là tùy chọn không bắt buộc cho người dùng.',
        evidence_level: 'Explicit'
      };

      db.prepare(`
        INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, evidence_level, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?)
      `).run(candidate.id, candidate.project_id, candidate.unit_type, candidate.content, candidate.subject, candidate.action, candidate.evidence_level, now, now);

      const { conflicts } = SemanticValidator.validateAgainstApproved(db, candidate);

      expect(conflicts.length).toBe(1);
      expect(conflicts[0].conflictType).toBe('Contradiction');
      expect(conflicts[0].severity).toBe('Critical');
      expect(conflicts[0].description).toContain('mandatory requirement while the other specifies optional');
    });

    it('detects semantic redundancy when candidate content is identical to approved unit', () => {
      const now = new Date().toISOString();

      const approvedUnitId = 'ku-appr-redundant';
      const exactContent = 'Độ dài mật khẩu tối thiểu 8 ký tự bao gồm chữ và số.';

      db.prepare(`
        INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, evidence_level, status, created_at, updated_at)
        VALUES (?, ?, 'Constraint', ?, 'Độ dài mật khẩu', 'Kiểm tra độ dài', 'Explicit', 'Approved', ?, ?)
      `).run(approvedUnitId, projectId, exactContent, now, now);

      const candidate: CandidateKnowledgeUnit = {
        id: 'cand-redundant',
        project_id: projectId,
        unit_type: 'Constraint',
        subject: 'Độ dài mật khẩu',
        action: 'Kiểm tra độ dài',
        content: exactContent,
        evidence_level: 'Explicit'
      };

      db.prepare(`
        INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, evidence_level, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?)
      `).run(candidate.id, candidate.project_id, candidate.unit_type, candidate.content, candidate.subject, candidate.action, candidate.evidence_level, now, now);

      const { conflicts } = SemanticValidator.validateAgainstApproved(db, candidate);

      expect(conflicts.length).toBe(1);
      expect(conflicts[0].conflictType).toBe('Redundancy');
      expect(conflicts[0].severity).toBe('Minor');
    });

    it('does NOT flag false numeric conflicts for bare step numbers or generic words (BUG-015 Regression)', () => {
      const now = new Date().toISOString();

      const approvedUnitId = 'ku-appr-steps';
      db.prepare(`
        INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, evidence_level, status, created_at, updated_at)
        VALUES (?, ?, 'Constraint', 'Thực hiện quy trình theo Bước 1: Khởi động hệ thống.', 'Quy trình khởi động', 'Khởi động', 'Explicit', 'Approved', ?, ?)
      `).run(approvedUnitId, projectId, now, now);

      // Candidate with step 2 - bare numbers must NOT trigger numeric conflict
      const candidate: CandidateKnowledgeUnit = {
        id: 'cand-step-2',
        project_id: projectId,
        unit_type: 'Constraint',
        subject: 'Quy trình khởi động',
        action: 'Khởi động',
        content: 'Thực hiện quy trình theo Bước 2: Kiểm tra kết nối cơ sở dữ liệu.',
        evidence_level: 'Explicit'
      };

      const { conflicts } = SemanticValidator.validateAgainstApproved(db, candidate);
      const numericConflicts = conflicts.filter(c => c.conflictType === 'Contradiction' && c.description.includes('conflicts with approved specification'));
      expect(numericConflicts.length).toBe(0);
    });

    it('does NOT treat common word "yêu cầu" as affirmative modality contradiction (BUG-015 Regression)', () => {
      const now = new Date().toISOString();

      const approvedUnitId = 'ku-appr-reqword';
      db.prepare(`
        INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, evidence_level, status, created_at, updated_at)
        VALUES (?, ?, 'Requirement', 'Tài liệu đưa ra yêu cầu về tính năng đăng nhập SSO.', 'Tính năng SSO', 'Hỗ trợ SSO', 'Explicit', 'Approved', ?, ?)
      `).run(approvedUnitId, projectId, now, now);

      // Candidate mentioning optional feature without contradicting mandatory policy
      const candidate: CandidateKnowledgeUnit = {
        id: 'cand-req-optional',
        project_id: projectId,
        unit_type: 'Requirement',
        subject: 'Tính năng SSO',
        action: 'Hỗ trợ SSO',
        content: 'Tính năng SSO cho phép đăng nhập qua Google hoặc tùy chọn qua tài khoản nội bộ.',
        evidence_level: 'Explicit'
      };

      const { conflicts } = SemanticValidator.validateAgainstApproved(db, candidate);
      const policyConflicts = conflicts.filter(c => c.conflictType === 'Contradiction' && c.description.includes('policy contradiction'));
      expect(policyConflicts.length).toBe(0);
    });
  });
});
