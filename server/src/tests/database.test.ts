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
});
