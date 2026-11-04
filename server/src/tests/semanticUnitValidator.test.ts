import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import { DatabaseMigrator } from '../database/migrator.js';
import { allMigrations } from '../database/migrations/index.js';
import { SemanticValidator, CandidateKnowledgeUnit } from '../modules/knowledge/semanticValidator.js';

describe('Semantic Validator Unit Normalization & Conflict Accuracy (R4-12)', () => {
  let db: any;
  const projectId = 'PRJ-SEMANTIC-TEST';

  beforeAll(() => {
    db = new Database(':memory:');
    const migrator = new DatabaseMigrator(db, allMigrations);
    migrator.runPendingMigrations();

    db.prepare(`
      INSERT INTO projects (id, name, key, description, version, author, members_count, ai_policy, data, created_at, updated_at)
      VALUES (?, 'Semantic Test', 'SEM', 'Desc', 'v1.0.0', 'Admin', 1, 'OFFLINE_ONLY', '{}', datetime('now'), datetime('now'))
    `).run(projectId);
  });

  it('correctly parses thousands separator: "10,000 CCU" vs "10 CCU" detects contradiction', async () => {
    // Approved unit: peak concurrency 10,000 CCU
    db.prepare(`
      INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, condition, evidence_level, status, created_at, updated_at)
      VALUES ('KU-APP-CCU', ?, 'Constraint', 'Hệ thống hỗ trợ tải cao điểm 10,000 CCU với mức sử dụng CPU dưới 70%.', 'Khả năng chịu tải', 'hỗ trợ tải 10,000 CCU', NULL, 'Explicit', 'Approved', datetime('now'), datetime('now'))
    `).run(projectId);

    // Candidate 1: 10 CCU -> Should trigger Contradiction
    const candidateConflict: CandidateKnowledgeUnit = {
      id: 'KU-CAND-CCU-LOW',
      project_id: projectId,
      unit_type: 'Constraint',
      content: 'Hệ thống hỗ trợ tải cao điểm 10 CCU với mức sử dụng CPU dưới 70%.',
      subject: 'Khả năng chịu tải',
      action: 'hỗ trợ tải 10 CCU',
      evidence_level: 'Explicit'
    };

    db.prepare(`
      INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, condition, evidence_level, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL, 'Explicit', 'Draft', datetime('now'), datetime('now'))
    `).run(candidateConflict.id, candidateConflict.project_id, candidateConflict.unit_type, candidateConflict.content, candidateConflict.subject, candidateConflict.action);

    const { conflicts: conflicts1 } = SemanticValidator.validateAgainstApproved(db, candidateConflict);
    const ccuConflict = conflicts1.find(c => c.conflictType === 'Contradiction');
    expect(ccuConflict).toBeDefined();
    expect(ccuConflict?.description.toLowerCase()).toContain('10 ccu');
    expect(ccuConflict?.description.toLowerCase()).toContain('10,000 ccu');

    // Candidate 2: Identical 10,000 CCU -> Zero conflict
    const candidateMatch: CandidateKnowledgeUnit = {
      id: 'KU-CAND-CCU-MATCH',
      project_id: projectId,
      unit_type: 'Constraint',
      content: 'Hệ thống hỗ trợ tải cao điểm 10,000 CCU với mức sử dụng CPU dưới 70%.',
      subject: 'Khả năng chịu tải',
      action: 'hỗ trợ tải 10,000 CCU',
      evidence_level: 'Explicit'
    };

    db.prepare(`
      INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, condition, evidence_level, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL, 'Explicit', 'Draft', datetime('now'), datetime('now'))
    `).run(candidateMatch.id, candidateMatch.project_id, candidateMatch.unit_type, candidateMatch.content, candidateMatch.subject, candidateMatch.action);

    const { conflicts: conflicts2 } = SemanticValidator.validateAgainstApproved(db, candidateMatch);
    expect(conflicts2.filter(c => c.conflictType === 'Contradiction').length).toBe(0);
  });

  it('normalizes time units: "1,5 giờ" and "90 phút" are recognized as equivalent (5400s) with zero contradiction', async () => {
    // Approved unit: 90 phút
    db.prepare(`
      INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, condition, evidence_level, status, created_at, updated_at)
      VALUES ('KU-APP-TIME', ?, 'Requirement', 'Thời gian bảo trì định kỳ là 90 phút vào cuối tuần.', 'Bảo trì hệ thống', 'thực hiện bảo trì 90 phút', NULL, 'Explicit', 'Approved', datetime('now'), datetime('now'))
    `).run(projectId);

    // Candidate with 1,5 giờ (Vietnamese decimal comma) -> Equivalent to 90 phút -> No contradiction!
    const candidateEquiv: CandidateKnowledgeUnit = {
      id: 'KU-CAND-TIME-EQUIV',
      project_id: projectId,
      unit_type: 'Requirement',
      content: 'Thời gian bảo trì định kỳ là 1,5 giờ vào cuối tuần.',
      subject: 'Bảo trì hệ thống',
      action: 'thực hiện bảo trì 1,5 giờ',
      evidence_level: 'Explicit'
    };

    const { conflicts } = SemanticValidator.validateAgainstApproved(db, candidateEquiv);
    const contradictions = conflicts.filter(c => c.conflictType === 'Contradiction');
    expect(contradictions.length).toBe(0);
  });

  it('qualifier context matching: distinguishes timeout from warning so "timeout 30m, cảnh báo sau 15m" vs "timeout 15m" detects conflict', async () => {
    // Approved rule has 30m for timeout and 15m for warning
    db.prepare(`
      INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, condition, evidence_level, status, created_at, updated_at)
      VALUES ('KU-APP-QUAL', ?, 'BusinessRule', 'Thời gian timeout phiên là 30 phút, hệ thống phát cảnh báo sau 15 phút không hoạt động.', 'Phiên làm việc', 'thiết lập phiên làm việc', NULL, 'Explicit', 'Approved', datetime('now'), datetime('now'))
    `).run(projectId);

    // New candidate specifies timeout 15 phút -> Contradicts the 30 phút timeout!
    // Must NOT be falsely masked by the 15 phút warning!
    const candidateTimeoutConflict: CandidateKnowledgeUnit = {
      id: 'KU-CAND-TIMEOUT-CONFLICT',
      project_id: projectId,
      unit_type: 'BusinessRule',
      content: 'Thời gian timeout phiên là 15 phút không hoạt động.',
      subject: 'Phiên làm việc',
      action: 'thiết lập timeout phiên 15 phút',
      evidence_level: 'Explicit'
    };

    db.prepare(`
      INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, condition, evidence_level, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL, 'Explicit', 'Draft', datetime('now'), datetime('now'))
    `).run(candidateTimeoutConflict.id, candidateTimeoutConflict.project_id, candidateTimeoutConflict.unit_type, candidateTimeoutConflict.content, candidateTimeoutConflict.subject, candidateTimeoutConflict.action);

    const { conflicts } = SemanticValidator.validateAgainstApproved(db, candidateTimeoutConflict);
    const timeoutConflict = conflicts.find(c => c.conflictType === 'Contradiction');
    expect(timeoutConflict).toBeDefined();
    expect(timeoutConflict?.description).toContain('15 phút');
    expect(timeoutConflict?.description).toContain('30 phút');
  });
});
