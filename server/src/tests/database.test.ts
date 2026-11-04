import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { DatabaseMigrator } from '../database/migrator.js';
import { allMigrations } from '../database/migrations/index.js';
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
      provider: 'google',
      authMethod: 'cli_subscription',
      cliBinary: 'agy',
      model: 'gemini-3.8-flash-medium',
      effortLevel: 'medium'
    });

    const updated = dbRepository.aiConnections.get();
    expect(updated?.provider).toBe('google');
    expect(updated?.authMethod).toBe('cli_subscription');
    expect(updated?.cliBinary).toBe('agy');
    expect(updated?.model).toBe('gemini-3.8-flash-medium');
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

  it('executes migrations 001-011 on a pre-populated database without data loss or foreign key cascades (R3-01)', () => {
    const memDb = new Database(':memory:');
    memDb.pragma('foreign_keys = ON');

    // 1. Run migrations 001 through 009
    const earlyMigrations = allMigrations.filter(m => parseInt(m.version) <= 9);
    const migrator1 = new DatabaseMigrator(memDb, earlyMigrations);
    migrator1.runPendingMigrations();

    // 2. Populate pre-existing project with rich interrelated data
    const prjId = 'PRJ-LEGACY';
    memDb.prepare(`
      INSERT INTO projects (id, name, key, description, version, author, members_count, ai_policy, data, created_at, updated_at)
      VALUES (?, 'Legacy Core System', 'LCS', 'Pre-existing project before migration 010', 'v1.0.0', 'Architect QA', 3, 'OFFLINE_ONLY', '{}', '2026-11-01', '2026-11-01')
    `).run(prjId);

    memDb.prepare(`
      INSERT INTO documents (id, project_id, category, status, data, updated_at)
      VALUES ('DOC-LEGACY-01', ?, '05_Technical_Documents', 'Approved', '{"id":"DOC-LEGACY-01","title":"Legacy Architecture Document"}', '2026-11-01')
    `).run(prjId);

    memDb.prepare(`
      INSERT INTO document_versions (id, document_id, version_no, file_id, extracted_content, status, change_summary, created_by, created_at)
      VALUES ('VER-LEGACY-01', 'DOC-LEGACY-01', 'v1.0', NULL, 'Extracted text', 'Approved', 'Initial release', 'Architect QA', '2026-11-01')
    `).run();

    memDb.prepare(`
      INSERT INTO requirements (id, type, priority, status, data, updated_at)
      VALUES ('REQ-LEGACY-01', 'Compliance', 'P0', 'Approved', '{"id":"REQ-LEGACY-01","title":"Audit Trail Requirement"}', '2026-11-01')
    `).run();

    memDb.prepare(`
      INSERT INTO test_cases (id, requirement_id, status, type, priority, data, updated_at)
      VALUES ('TC-LEGACY-01', 'REQ-LEGACY-01', 'Ready', 'Functional', 'P0', '{"id":"TC-LEGACY-01","title":"Test Audit Logging"}', '2026-11-01')
    `).run();

    memDb.prepare(`
      INSERT INTO bugs (id, status, severity, priority, data, updated_at)
      VALUES ('BUG-LEGACY-01', 'Open', 'Major', 'High', '{"id":"BUG-LEGACY-01","title":"Audit log timestamp skew"}', '2026-11-01')
    `).run();

    memDb.prepare(`
      INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, evidence_level, status, created_at, updated_at)
      VALUES ('KU-LEGACY-01', ?, 'Requirement', 'Audit logs must be kept for 365 days', 'Audit Log Retention', 'Enforce Retention', 'Explicit', 'Approved', '2026-11-01', '2026-11-01')
    `).run(prjId);

    memDb.prepare(`
      INSERT INTO conflicts (id, project_id, unit_a_id, unit_b_id, conflict_type, severity, description, resolution, created_at)
      VALUES ('CONF-LEGACY-01', ?, 'KU-LEGACY-01', 'KU-LEGACY-01', 'Redundancy', 'Minor', 'Duplicate retention rule', 'UNRESOLVED', '2026-11-01')
    `).run(prjId);

    // 3. Now run remaining migrations (010 and 011)
    const migratorFull = new DatabaseMigrator(memDb, allMigrations);
    migratorFull.runPendingMigrations();

    // 4. Verify ZERO data loss across all tables
    const project = memDb.prepare('SELECT * FROM projects WHERE id = ?').get(prjId) as any;
    expect(project).toBeDefined();
    expect(project.id).toBe(prjId);
    expect(project.ai_policy).toBe('OFFLINE_ONLY');

    const doc = memDb.prepare('SELECT * FROM documents WHERE id = ?').get('DOC-LEGACY-01') as any;
    expect(doc).toBeDefined();
    expect(doc.project_id).toBe(prjId);

    const docVer = memDb.prepare('SELECT * FROM document_versions WHERE id = ?').get('VER-LEGACY-01') as any;
    expect(docVer).toBeDefined();
    expect(docVer.document_id).toBe('DOC-LEGACY-01');

    const req = memDb.prepare('SELECT * FROM requirements WHERE id = ?').get('REQ-LEGACY-01') as any;
    expect(req).toBeDefined();

    const tc = memDb.prepare('SELECT * FROM test_cases WHERE id = ?').get('TC-LEGACY-01') as any;
    expect(tc).toBeDefined();

    const bug = memDb.prepare('SELECT * FROM bugs WHERE id = ?').get('BUG-LEGACY-01') as any;
    expect(bug).toBeDefined();

    const ku = memDb.prepare('SELECT * FROM knowledge_units WHERE id = ?').get('KU-LEGACY-01') as any;
    expect(ku).toBeDefined();
    expect(ku.project_id).toBe(prjId);

    const conf = memDb.prepare('SELECT * FROM conflicts WHERE id = ?').get('CONF-LEGACY-01') as any;
    expect(conf).toBeDefined();
    expect(conf.project_id).toBe(prjId);

    // 5. Verify foreign key integrity with PRAGMA foreign_key_check
    const fkErrors = memDb.prepare('PRAGMA foreign_key_check').all();
    expect(fkErrors.length).toBe(0);

    memDb.close();
  });
});
