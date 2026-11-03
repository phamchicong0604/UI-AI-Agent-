import { describe, it, expect } from 'vitest';
import { dbRepository } from '../database/db.js';
import { DocumentItem, RequirementItem, TestCaseItem } from '../common/types.js';

describe('SQLite Database Layer & Repository CRUD', () => {
  it('should retrieve seeded baseline documents from SQLite', () => {
    const docs = dbRepository.documents.getAll();
    expect(Array.isArray(docs)).toBe(true);
    expect(docs.length).toBeGreaterThanOrEqual(1);

    const doc1 = dbRepository.documents.getById('DOC-01');
    expect(doc1).toBeDefined();
    expect(doc1?.id).toBe('DOC-01');
    expect(doc1?.versions[0]?.checksum.startsWith('sha256:')).toBe(true);
  });

  it('should support creating and retrieving a new document in SQLite', () => {
    const testDoc: DocumentItem = {
      id: 'DOC-UNIT-TEST-01',
      title: 'Automated Test Architecture Spec',
      category: '05_Technical_Documents',
      currentVersion: 'v1.0',
      status: 'Draft',
      author: 'Vitest Runner',
      updatedAt: '2026-11-02 12:00',
      description: 'Unit testing specification document',
      tags: ['Test', 'Vitest'],
      linkedRequirementsCount: 0,
      versions: [
        {
          version: 'v1.0',
          updatedAt: '2026-11-02 12:00',
          author: 'Vitest Runner',
          status: 'Draft',
          changeSummary: 'Initial test document creation',
          fileSize: '100 KB',
          checksum: 'sha256:dummytestchecksum1234567890abcdef'
        }
      ]
    };

    dbRepository.documents.upsert(testDoc);
    const fetched = dbRepository.documents.getById('DOC-UNIT-TEST-01');
    expect(fetched).toBeDefined();
    expect(fetched?.title).toBe('Automated Test Architecture Spec');
    expect(fetched?.status).toBe('Draft');

    // Clean up
    dbRepository.documents.delete('DOC-UNIT-TEST-01');
    expect(dbRepository.documents.getById('DOC-UNIT-TEST-01')).toBeNull();
  });

  it('should persist and retrieve AI settings', () => {
    dbRepository.settings.set('TEST_KEY', 'test_value_123');
    const val = dbRepository.settings.get('TEST_KEY');
    expect(val).toBe('test_value_123');

    // Overwrite existing
    dbRepository.settings.set('TEST_KEY', 'updated_value_456');
    expect(dbRepository.settings.get('TEST_KEY')).toBe('updated_value_456');
  });

  it('should handle audit event chained retrieval and latest hash lookup', () => {
    const events = dbRepository.auditEvents.getAll();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);

    const latestHash = dbRepository.auditEvents.getLatestHash();
    expect(latestHash).toBeDefined();
    expect(latestHash.startsWith('sha256:')).toBe(true);
  });

  it('should persist and retrieve unified AI connections', () => {
    const conn = dbRepository.aiConnections.get();
    expect(conn).toBeDefined();
    expect(conn?.id).toBe('primary');

    dbRepository.aiConnections.save({
      provider: 'anthropic',
      authMethod: 'cli_subscription',
      cliBinary: 'claude',
      model: 'claude-3-7-sonnet'
    });

    const updated = dbRepository.aiConnections.get();
    expect(updated?.provider).toBe('anthropic');
    expect(updated?.authMethod).toBe('cli_subscription');
    expect(updated?.cliBinary).toBe('claude');
  });

  it('should support project CRUD and document project-scoping in SQLite', () => {
    // 1. Projects getAll
    const projects = dbRepository.projects.getAll();
    expect(projects.length).toBeGreaterThanOrEqual(2);
    expect(projects.some(p => p.id === 'PRJ-01')).toBe(true);

    // 2. Project upsert & getById
    const testProject = {
      id: 'PRJ-TEST-99',
      name: 'Omni Logistics Platform',
      key: 'OLP',
      description: 'Warehouse tracking and dispatch platform',
      version: 'v1.0.0',
      author: 'Tester QA',
      membersCount: 4,
      createdAt: '2026-11-03'
    };
    dbRepository.projects.upsert(testProject);
    const fetchedProject = dbRepository.projects.getById('PRJ-TEST-99');
    expect(fetchedProject).toBeDefined();
    expect(fetchedProject?.key).toBe('OLP');

    // 3. Document scoping by projectId
    const testDoc: DocumentItem = {
      id: 'DOC-PROJ-TEST-01',
      projectId: 'PRJ-TEST-99',
      title: 'Warehouse Protocol',
      category: '01_Project_Overview',
      currentVersion: 'v1.0',
      status: 'Approved',
      author: 'Tester QA',
      updatedAt: '2026-11-03',
      description: 'Logistics overview',
      tags: ['Test'],
      linkedRequirementsCount: 0,
      versions: []
    };
    dbRepository.documents.upsert(testDoc);

    const scopedDocs = dbRepository.documents.getAll('PRJ-TEST-99');
    expect(scopedDocs.some(d => d.id === 'DOC-PROJ-TEST-01')).toBe(true);
    expect(scopedDocs.every(d => d.projectId === 'PRJ-TEST-99')).toBe(true);

    // Clean up
    dbRepository.documents.delete('DOC-PROJ-TEST-01');
    dbRepository.projects.delete('PRJ-TEST-99');
    expect(dbRepository.projects.getById('PRJ-TEST-99')).toBeNull();
  });
});
