import { describe, it, expect, beforeAll } from 'vitest';
import { db, dbRepository } from '../database/db.js';
import { defaultDataPolicyService, PolicyViolationError } from '../modules/ai/dataPolicyService.js';
import { aiConnectionManager } from '../modules/ai/ai.connection.manager.js';
import { AiService } from '../modules/ai/ai.service.js';

describe('Project AI Policy & Fail-Closed Governance (BUG-001, BUG-002, R3-04)', () => {
  const offlineProj = 'PRJ-POLICY-OFFLINE';
  const externalProj = 'PRJ-POLICY-EXTERNAL';
  const aiService = new AiService();

  beforeAll(() => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO projects (id, name, key, description, version, author, members_count, ai_policy, data, created_at, updated_at)
      VALUES (?, 'Offline Project', 'OFF', 'Desc', 'v1.0.0', 'Admin', 1, 'OFFLINE_ONLY', '{}', ?, ?)
    `).run(offlineProj, now, now);

    db.prepare(`
      INSERT OR REPLACE INTO projects (id, name, key, description, version, author, members_count, ai_policy, data, created_at, updated_at)
      VALUES (?, 'External Project', 'EXT', 'Desc', 'v1.0.0', 'Admin', 1, 'ALLOW_EXTERNAL', '{}', ?, ?)
    `).run(externalProj, now, now);
  });

  it('defaults to OFFLINE_ONLY on null, undefined or unknown project ID (BUG-002)', () => {
    expect(defaultDataPolicyService.getProjectPolicy(null as any)).toBe('OFFLINE_ONLY');
    expect(defaultDataPolicyService.getProjectPolicy(undefined as any)).toBe('OFFLINE_ONLY');
    expect(defaultDataPolicyService.getProjectPolicy('NON-EXISTENT-XYZ')).toBe('OFFLINE_ONLY');
  });

  it('assertCanSendExternal throws PolicyViolationError when project policy is OFFLINE_ONLY (BUG-001)', () => {
    expect(() => defaultDataPolicyService.assertCanSendExternal(offlineProj)).toThrow(PolicyViolationError);
    expect(() => defaultDataPolicyService.assertCanSendExternal(undefined)).toThrow(PolicyViolationError);
  });

  it('aiConnectionManager.generateCompletion blocks external calls for OFFLINE_ONLY projects', async () => {
    await expect(
      aiConnectionManager.generateCompletion('test prompt', offlineProj)
    ).rejects.toThrow(PolicyViolationError);
  });

  it('AiService automatically routes OFFLINE_ONLY projects to deterministic local rule engine without data egress', async () => {
    const reqItem = {
      id: 'REQ-POLICY-TEST',
      projectId: offlineProj,
      title: 'User Authentication Spec',
      description: 'Bắt buộc xác thực mật khẩu qua PBKDF2',
      type: 'Functional' as const,
      priority: 'High' as const,
      businessRules: [],
      acceptanceCriteria: [{ id: 'AC-1', text: 'Criteria 1', completed: false }],
      sourceReferences: [],
      status: 'Draft' as const,
      owner: 'Tester',
      approver: 'Approver',
      createdAt: '2026-11-04',
      updatedAt: '2026-11-04'
    };

    dbRepository.requirements.upsert(reqItem);

    const result = await aiService.generateGroundedDrafts({
      requirement: reqItem,
      projectId: offlineProj
    });

    expect(result).toBeDefined();
    expect(result.testCases.length).toBeGreaterThan(0);
    expect(result.testCases[0].title).toContain('User Authentication Spec');
  });
});
