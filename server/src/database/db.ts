import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { 
  DocumentItem, 
  RequirementItem, 
  EvidenceItem, 
  TestCaseItem, 
  TestRunItem, 
  BugItem, 
  AuditEvent,
  AiConnectionConfig,
  AccountModelSnapshot,
  ModelOption
} from '../common/types.js';
import { computeSha256, computeAuditEventHash } from '../common/crypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'docqa.sqlite');
export const db = new Database(dbPath);

// Enable WAL for performance and concurrent integrity
db.pragma('journal_mode = WAL');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    category TEXT,
    status TEXT,
    data TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS requirements (
    id TEXT PRIMARY KEY,
    type TEXT,
    priority TEXT,
    status TEXT,
    data TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY,
    type TEXT,
    environment TEXT,
    status TEXT,
    data TEXT NOT NULL,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS test_cases (
    id TEXT PRIMARY KEY,
    requirement_id TEXT,
    status TEXT,
    type TEXT,
    priority TEXT,
    data TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS test_runs (
    id TEXT PRIMARY KEY,
    status TEXT,
    environment TEXT,
    data TEXT NOT NULL,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS bugs (
    id TEXT PRIMARY KEY,
    status TEXT,
    severity TEXT,
    priority TEXT,
    data TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    event_hash TEXT NOT NULL,
    previous_event_hash TEXT,
    timestamp TEXT NOT NULL,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS ai_connections (
    id TEXT PRIMARY KEY DEFAULT 'primary',
    provider TEXT NOT NULL DEFAULT 'google',
    auth_method TEXT NOT NULL DEFAULT 'api_key',
    api_key TEXT,
    base_url TEXT,
    model TEXT NOT NULL DEFAULT 'gemini-4-argon-medium',
    effort_level TEXT DEFAULT 'medium',
    max_output_tokens INTEGER DEFAULT 32768,
    cli_binary TEXT DEFAULT 'claude',
    cli_version TEXT,
    cli_auth_status TEXT,
    connection_status TEXT NOT NULL DEFAULT 'disconnected',
    last_tested_at TEXT,
    latency_ms INTEGER,
    error_message TEXT,
    updated_at TEXT NOT NULL
  );

  -- Models available to a specific provider account (synced from CLI subscription or API key)
  CREATE TABLE IF NOT EXISTS ai_models (
    provider TEXT NOT NULL,
    auth_method TEXT NOT NULL,
    source TEXT NOT NULL,
    model_id TEXT NOT NULL,
    account TEXT,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL,
    synced_at TEXT NOT NULL,
    PRIMARY KEY (provider, auth_method, source, model_id)
  );
  CREATE INDEX IF NOT EXISTS idx_ai_models_lookup ON ai_models (provider, auth_method, source);
`);

try {
  db.exec("ALTER TABLE ai_connections ADD COLUMN effort_level TEXT DEFAULT 'medium'");
} catch {}
try {
  db.exec("ALTER TABLE ai_connections ADD COLUMN max_output_tokens INTEGER DEFAULT 32768");
} catch {}

/* -------------------------------------------------------------
 * SEED BASELINE DATA IF TABLES ARE EMPTY
 * ----------------------------------------------------------- */

function seedDatabaseIfEmpty() {
  const docCount = (db.prepare('SELECT count(*) as count FROM documents').get() as any).count;
  if (docCount === 0) {
    console.log('[SQLite DB] Seeding initial baseline proposal records...');

    // Seed Documents
    const initialDocs: DocumentItem[] = [
      {
        id: 'DOC-01',
        title: 'Project Charter & Stakeholder Matrix',
        category: '01_Project_Overview',
        currentVersion: 'v1.0',
        status: 'Approved',
        author: 'Minh Tran (PM)',
        updatedAt: '2026-11-01 10:30',
        description: 'Executive summary, target milestones, sponsor sign-off, and responsibility matrix.',
        tags: ['Overview', 'Charter', 'Governance'],
        linkedRequirementsCount: 2,
        versions: [
          {
            version: 'v1.0',
            updatedAt: '2026-11-01 10:30',
            author: 'Minh Tran',
            status: 'Approved',
            changeSummary: 'Finalized scope and executive approval from Product Board.',
            fileSize: '1.2 MB',
            checksum: `sha256:${computeSha256('DOC-01|v1.0|Project Charter')}`
          }
        ]
      },
      {
        id: 'DOC-02',
        title: 'Business Requirements Document (BRD) - Authentication & RBAC',
        category: '02_Business_Requirements',
        currentVersion: 'v1.2',
        status: 'Approved',
        author: 'Sarah Le (Lead BA)',
        updatedAt: '2026-11-02 09:15',
        description: 'Comprehensive business rules for role privileges (Admin, PM, BA, DEV, QA, Approver).',
        tags: ['BRD', 'Auth', 'RBAC'],
        linkedRequirementsCount: 3,
        versions: [
          {
            version: 'v1.2',
            updatedAt: '2026-11-02 09:15',
            author: 'Sarah Le',
            status: 'Approved',
            changeSummary: 'Added strict rule: Only Approved items can act as authoritative source.',
            fileSize: '2.4 MB',
            checksum: `sha256:${computeSha256('DOC-02|v1.2|BRD Authentication & RBAC')}`
          }
        ]
      }
    ];

    const insertDoc = db.prepare('INSERT INTO documents (id, category, status, data, updated_at) VALUES (?, ?, ?, ?, ?)');
    for (const doc of initialDocs) {
      insertDoc.run(doc.id, doc.category, doc.status, JSON.stringify(doc), doc.updatedAt);
    }

    // Seed Requirements
    const initialReqs: RequirementItem[] = [
      {
        id: 'REQ-001',
        title: 'Role-Based Access Control and Strict Approval Gates',
        description: 'The platform must enforce strict RBAC permissions across Project Admin, PM, BA, Tech Lead, QA, and Approver.',
        type: 'Functional',
        priority: 'Critical',
        businessRules: [
          'BR-AUTH-01: Only users with Reviewer/Approver or Project Admin role can transition items to Approved status.',
          'BR-AUTH-02: Items in Draft or In Review must display clear unconfirmed warning flags.'
        ],
        acceptanceCriteria: [
          { id: 'AC-01', text: 'System restricts status change to Approved to authorized roles.', completed: true },
          { id: 'AC-02', text: 'Traceability view flags unapproved source dependencies.', completed: true }
        ],
        sourceReferences: [
          {
            documentId: 'DOC-02',
            documentTitle: 'BRD - Authentication & RBAC',
            version: 'v1.2',
            section: 'Section 4.1'
          }
        ],
        status: 'Approved',
        owner: 'Sarah Le (BA)',
        approver: 'Minh Tran (PM)',
        createdAt: '2026-10-29',
        updatedAt: '2026-11-01 14:20'
      }
    ];

    const insertReq = db.prepare('INSERT INTO requirements (id, type, priority, status, data, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
    for (const req of initialReqs) {
      insertReq.run(req.id, req.type, req.priority, req.status, JSON.stringify(req), req.updatedAt);
    }

    // Seed Evidence
    const initialEvd: EvidenceItem[] = [
      {
        id: 'EVD-001',
        title: 'Screenshot: 403 Forbidden Dialog on Non-Admin User',
        description: 'Capture showing unauthorized user attempting to approve REQ-001 without sufficient permissions.',
        type: 'Screenshot',
        environment: 'QA',
        buildVersion: 'build-1042',
        status: 'Verified',
        storageRef: 's3://docqa-evidence/qa/20261102/403_forbidden_gate.png',
        storageChecksum: `sha256:${computeSha256('s3://docqa-evidence/qa/20261102/403_forbidden_gate.png')}`,
        fileSize: '482 KB',
        createdBy: 'Duc Pham (QA Lead)',
        createdAt: '2026-11-02 09:40',
        verifiedBy: 'Khoa Dang (Tech Lead)',
        verifiedAt: '2026-11-02 10:05',
        links: [
          {
            targetType: 'Requirement',
            targetId: 'REQ-001',
            targetTitle: 'Role-Based Access Control and Strict Approval Gates',
            purpose: 'Validates AC-01 permission gate enforcement'
          }
        ]
      }
    ];

    const insertEvd = db.prepare('INSERT INTO evidence (id, type, environment, status, data, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    for (const evd of initialEvd) {
      insertEvd.run(evd.id, evd.type, evd.environment, evd.status, JSON.stringify(evd), evd.createdAt);
    }

    // Seed Test Cases
    const initialTCs: TestCaseItem[] = [
      {
        id: 'TC-AUTH-001',
        requirementId: 'REQ-001',
        requirementTitle: 'Role-Based Access Control and Strict Approval Gates',
        title: 'Verify Approved Status Transition by Authorized Approver',
        scenario: 'Ensure that a user with "Reviewer / Approver" role can transition Requirement to Approved.',
        preconditions: '1. User is logged in with Approver persona.',
        testData: 'Requirement ID: REQ-001, Decision: Approved',
        type: 'Positive',
        priority: 'Critical',
        status: 'Ready for Execution',
        version: 'v1.0',
        sourceReferences: [
          {
            documentId: 'DOC-02',
            documentTitle: 'BRD - Authentication & RBAC',
            version: 'v1.2',
            section: 'Section 4.1'
          }
        ],
        steps: [
          { stepNumber: 1, action: 'Navigate to Requirements and select REQ-001', expectedResult: 'Drawer opens' },
          { stepNumber: 2, action: 'Click Approve', expectedResult: 'Status updates to Approved' }
        ],
        reviewComments: [
          {
            id: 'RC-01',
            author: 'Sarah Le',
            role: 'BA',
            content: 'Steps match BRD v1.2 specifications.',
            createdAt: '2026-11-01 11:20',
            decision: 'Approved'
          }
        ],
        relatedEvidenceIds: ['EVD-001'],
        createdAt: '2026-11-01',
        updatedAt: '2026-11-02 09:00'
      }
    ];

    const insertTC = db.prepare('INSERT INTO test_cases (id, requirement_id, status, type, priority, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const tc of initialTCs) {
      insertTC.run(tc.id, tc.requirementId, tc.status, tc.type, tc.priority, JSON.stringify(tc), tc.updatedAt);
    }

    // Seed Test Runs
    const initialRuns: TestRunItem[] = [
      {
        id: 'RUN-2026-11-01',
        title: 'Regression Suite v1.2 - Release Candidate 1',
        environment: 'QA',
        buildVersion: 'build-1048',
        scope: 'Auth, RBAC and Documents Hierarchy',
        status: 'In Progress',
        createdBy: 'Duc Pham (QA)',
        createdAt: '2026-11-01 08:30',
        records: [
          {
            testCaseId: 'TC-AUTH-001',
            testCaseTitle: 'Verify Approved Status Transition by Authorized Approver',
            status: 'Pass',
            actualResult: 'Role gates passed successfully with 200 OK.',
            executedBy: 'Duc Pham',
            executedAt: '2026-11-01 09:15',
            evidenceIds: ['EVD-001']
          }
        ]
      }
    ];

    const insertRun = db.prepare('INSERT INTO test_runs (id, status, environment, data, created_at) VALUES (?, ?, ?, ?, ?)');
    for (const run of initialRuns) {
      insertRun.run(run.id, run.status, run.environment, JSON.stringify(run), run.createdAt);
    }

    // Seed Bugs
    const initialBugs: BugItem[] = [
      {
        id: 'BUG-001',
        title: 'Non-admin can see unmask tokens in browser localStorage',
        description: 'Session storage retains sensitive plain text token before approval.',
        severity: 'Major',
        priority: 'High',
        status: 'In Progress',
        assignee: 'Khoa Dang (DEV)',
        environment: 'QA',
        buildVersion: 'build-1048',
        stepsToReproduce: [
          '1. Login as QA user',
          '2. Open devtools Application -> LocalStorage',
          '3. Check docqa_user key'
        ],
        expectedResult: 'Tokens should be salted or hashed in memory only.',
        actualResult: 'Plain object stored in local browser state.',
        linkedRequirementId: 'REQ-001',
        linkedTestCaseId: 'TC-AUTH-001',
        linkedTestRunId: 'RUN-2026-11-01',
        linkedEvidenceIds: ['EVD-001'],
        createdAt: '2026-11-01 10:45',
        updatedAt: '2026-11-02 08:30'
      }
    ];

    const insertBug = db.prepare('INSERT INTO bugs (id, status, severity, priority, data, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
    for (const bug of initialBugs) {
      insertBug.run(bug.id, bug.status, bug.severity, bug.priority, JSON.stringify(bug), bug.updatedAt);
    }

    // Seed Chained Audit Events
    const h0 = computeSha256('GENESIS_BLOCK_DOCQA_PLATFORM');
    const h1 = computeAuditEventHash(`sha256:${h0}`, 'AUD-001', 'Sarah Le', 'BA', 'Created Requirement', 'Requirement', 'REQ-003', '2026-10-31 10:15');
    const h2 = computeAuditEventHash(h1, 'AUD-002', 'Duc Pham', 'QA', 'Approved Test Case', 'TestCase', 'TC-AUTH-001', '2026-11-01 11:20');

    const initialAudit: AuditEvent[] = [
      {
        id: 'AUD-002',
        user: 'Duc Pham',
        role: 'QA',
        action: 'Approved Test Case',
        entityType: 'TestCase',
        entityId: 'TC-AUTH-001',
        details: 'Signed off on RBAC test steps against BRD v1.2.',
        timestamp: '2026-11-01 11:20',
        eventHash: h2,
        previousEventHash: h1
      },
      {
        id: 'AUD-001',
        user: 'Sarah Le',
        role: 'BA',
        action: 'Created Requirement',
        entityType: 'Requirement',
        entityId: 'REQ-003',
        details: 'Created structured requirement for 3-Column QA Workspace.',
        timestamp: '2026-10-31 10:15',
        eventHash: h1,
        previousEventHash: `sha256:${h0}`
      }
    ];

    const insertAudit = db.prepare('INSERT INTO audit_events (id, event_hash, previous_event_hash, timestamp, data) VALUES (?, ?, ?, ?, ?)');
    for (const aud of initialAudit) {
      insertAudit.run(aud.id, aud.eventHash, aud.previousEventHash || null, aud.timestamp, JSON.stringify(aud));
    }

    // Seed Default AI Settings
    const insertSetting = db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)');
    insertSetting.run('AI_PROVIDER', 'gemini', new Date().toISOString());
    insertSetting.run('GEMINI_MODEL', 'gemini-1.5-pro', new Date().toISOString());
    insertSetting.run('OPENAI_MODEL', 'gpt-4o', new Date().toISOString());

    console.log('[SQLite DB] Baseline seed completed successfully.');
  }
}

seedDatabaseIfEmpty();

function seedAiConnectionIfEmpty() {
  const count = (db.prepare('SELECT count(*) as count FROM ai_connections').get() as any).count;
  if (count === 0) {
    console.log('[SQLite DB] Seeding unified AI connection baseline...');
    const getSetting = (k: string) => {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(k) as { value: string } | undefined;
      return row ? row.value : undefined;
    };
    const provider = getSetting('AI_PROVIDER') || process.env.AI_PROVIDER || 'google';
    const geminiKey = getSetting('GEMINI_API_KEY') || process.env.GEMINI_API_KEY || '';
    const geminiModel = getSetting('GEMINI_MODEL') || 'gemini-1.5-pro';

    db.prepare(`
      INSERT OR IGNORE INTO ai_connections (
        id, provider, auth_method, api_key, base_url, model,
        cli_binary, cli_version, cli_auth_status, connection_status,
        last_tested_at, latency_ms, error_message, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'primary',
      provider === 'gemini' ? 'google' : provider,
      'api_key',
      geminiKey || null,
      null,
      geminiModel,
      'claude',
      null,
      null,
      geminiKey ? 'connected' : 'disconnected',
      null,
      null,
      null,
      new Date().toISOString()
    );
  }
}

seedAiConnectionIfEmpty();

/* -------------------------------------------------------------
 * REPOSITORY HELPERS FOR ALL ENTITIES
 * ----------------------------------------------------------- */

export const dbRepository = {
  documents: {
    getAll(): DocumentItem[] {
      const rows = db.prepare('SELECT data FROM documents ORDER BY updated_at DESC').all() as { data: string }[];
      return rows.map(r => JSON.parse(r.data));
    },
    getById(id: string): DocumentItem | null {
      const row = db.prepare('SELECT data FROM documents WHERE id = ?').get(id) as { data: string } | undefined;
      return row ? JSON.parse(row.data) : null;
    },
    upsert(doc: DocumentItem): void {
      const stmt = db.prepare(`
        INSERT INTO documents (id, category, status, data, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          category = excluded.category,
          status = excluded.status,
          data = excluded.data,
          updated_at = excluded.updated_at
      `);
      stmt.run(doc.id, doc.category, doc.status, JSON.stringify(doc), doc.updatedAt);
    },
    delete(id: string): boolean {
      const result = db.prepare('DELETE FROM documents WHERE id = ?').run(id);
      return result.changes > 0;
    }
  },

  requirements: {
    getAll(): RequirementItem[] {
      const rows = db.prepare('SELECT data FROM requirements ORDER BY updated_at DESC').all() as { data: string }[];
      return rows.map(r => JSON.parse(r.data));
    },
    getById(id: string): RequirementItem | null {
      const row = db.prepare('SELECT data FROM requirements WHERE id = ?').get(id) as { data: string } | undefined;
      return row ? JSON.parse(row.data) : null;
    },
    upsert(req: RequirementItem): void {
      const stmt = db.prepare(`
        INSERT INTO requirements (id, type, priority, status, data, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          type = excluded.type,
          priority = excluded.priority,
          status = excluded.status,
          data = excluded.data,
          updated_at = excluded.updated_at
      `);
      stmt.run(req.id, req.type, req.priority, req.status, JSON.stringify(req), req.updatedAt);
    },
    delete(id: string): boolean {
      const result = db.prepare('DELETE FROM requirements WHERE id = ?').run(id);
      return result.changes > 0;
    }
  },

  evidence: {
    getAll(): EvidenceItem[] {
      const rows = db.prepare('SELECT data FROM evidence ORDER BY created_at DESC').all() as { data: string }[];
      return rows.map(r => JSON.parse(r.data));
    },
    getById(id: string): EvidenceItem | null {
      const row = db.prepare('SELECT data FROM evidence WHERE id = ?').get(id) as { data: string } | undefined;
      return row ? JSON.parse(row.data) : null;
    },
    upsert(evd: EvidenceItem): void {
      const stmt = db.prepare(`
        INSERT INTO evidence (id, type, environment, status, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          type = excluded.type,
          environment = excluded.environment,
          status = excluded.status,
          data = excluded.data
      `);
      stmt.run(evd.id, evd.type, evd.environment, evd.status, JSON.stringify(evd), evd.createdAt);
    },
    delete(id: string): boolean {
      const result = db.prepare('DELETE FROM evidence WHERE id = ?').run(id);
      return result.changes > 0;
    }
  },

  testCases: {
    getAll(): TestCaseItem[] {
      const rows = db.prepare('SELECT data FROM test_cases ORDER BY updated_at DESC').all() as { data: string }[];
      return rows.map(r => JSON.parse(r.data));
    },
    getById(id: string): TestCaseItem | null {
      const row = db.prepare('SELECT data FROM test_cases WHERE id = ?').get(id) as { data: string } | undefined;
      return row ? JSON.parse(row.data) : null;
    },
    upsert(tc: TestCaseItem): void {
      const stmt = db.prepare(`
        INSERT INTO test_cases (id, requirement_id, status, type, priority, data, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          requirement_id = excluded.requirement_id,
          status = excluded.status,
          type = excluded.type,
          priority = excluded.priority,
          data = excluded.data,
          updated_at = excluded.updated_at
      `);
      stmt.run(tc.id, tc.requirementId, tc.status, tc.type, tc.priority, JSON.stringify(tc), tc.updatedAt);
    },
    delete(id: string): boolean {
      const result = db.prepare('DELETE FROM test_cases WHERE id = ?').run(id);
      return result.changes > 0;
    }
  },

  testRuns: {
    getAll(): TestRunItem[] {
      const rows = db.prepare('SELECT data FROM test_runs ORDER BY created_at DESC').all() as { data: string }[];
      return rows.map(r => JSON.parse(r.data));
    },
    getById(id: string): TestRunItem | null {
      const row = db.prepare('SELECT data FROM test_runs WHERE id = ?').get(id) as { data: string } | undefined;
      return row ? JSON.parse(row.data) : null;
    },
    upsert(tr: TestRunItem): void {
      const stmt = db.prepare(`
        INSERT INTO test_runs (id, status, environment, data, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          environment = excluded.environment,
          data = excluded.data
      `);
      stmt.run(tr.id, tr.status, tr.environment, JSON.stringify(tr), tr.createdAt);
    },
    delete(id: string): boolean {
      const result = db.prepare('DELETE FROM test_runs WHERE id = ?').run(id);
      return result.changes > 0;
    }
  },

  bugs: {
    getAll(): BugItem[] {
      const rows = db.prepare('SELECT data FROM bugs ORDER BY updated_at DESC').all() as { data: string }[];
      return rows.map(r => JSON.parse(r.data));
    },
    getById(id: string): BugItem | null {
      const row = db.prepare('SELECT data FROM bugs WHERE id = ?').get(id) as { data: string } | undefined;
      return row ? JSON.parse(row.data) : null;
    },
    upsert(bug: BugItem): void {
      const stmt = db.prepare(`
        INSERT INTO bugs (id, status, severity, priority, data, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          severity = excluded.severity,
          priority = excluded.priority,
          data = excluded.data,
          updated_at = excluded.updated_at
      `);
      stmt.run(bug.id, bug.status, bug.severity, bug.priority, JSON.stringify(bug), bug.updatedAt);
    },
    delete(id: string): boolean {
      const result = db.prepare('DELETE FROM bugs WHERE id = ?').run(id);
      return result.changes > 0;
    }
  },

  auditEvents: {
    getAll(): AuditEvent[] {
      const rows = db.prepare('SELECT data FROM audit_events ORDER BY rowid DESC').all() as { data: string }[];
      return rows.map(r => JSON.parse(r.data));
    },
    getLatestHash(): string {
      const row = db.prepare('SELECT event_hash FROM audit_events ORDER BY rowid DESC LIMIT 1').get() as { event_hash: string } | undefined;
      if (row) return row.event_hash;
      return `sha256:${computeSha256('GENESIS_BLOCK_DOCQA_PLATFORM')}`;
    },
    add(event: AuditEvent): void {
      const stmt = db.prepare('INSERT INTO audit_events (id, event_hash, previous_event_hash, timestamp, data) VALUES (?, ?, ?, ?, ?)');
      stmt.run(event.id, event.eventHash, event.previousEventHash || null, event.timestamp, JSON.stringify(event));
    }
  },

  settings: {
    get(key: string): string | null {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
      return row ? row.value : null;
    },
    set(key: string, value: string): void {
      const stmt = db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `);
      stmt.run(key, value, new Date().toISOString());
    },
    getAll(): Record<string, string> {
      const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
      const result: Record<string, string> = {};
      for (const row of rows) {
        result[row.key] = row.value;
      }
      return result;
    }
  },

  aiConnections: {
    get(): AiConnectionConfig | null {
      const r = db.prepare('SELECT * FROM ai_connections WHERE id = ?').get('primary') as any;
      if (!r) return null;
      return {
        id: r.id,
        provider: r.provider,
        authMethod: r.auth_method,
        apiKey: r.api_key || undefined,
        baseUrl: r.base_url || undefined,
        model: r.model,
        effortLevel: r.effort_level || 'medium',
        maxOutputTokens: r.max_output_tokens || 32768,
        cliBinary: r.cli_binary || undefined,
        cliVersion: r.cli_version || undefined,
        cliAuthStatus: r.cli_auth_status || undefined,
        connectionStatus: r.connection_status,
        lastTestedAt: r.last_tested_at || undefined,
        latencyMs: r.latency_ms || undefined,
        errorMessage: r.error_message || undefined,
        updatedAt: r.updated_at
      };
    },
    save(config: Partial<AiConnectionConfig>): AiConnectionConfig {
      const existing = this.get();
      const merged: AiConnectionConfig = {
        id: 'primary',
        provider: config.provider ?? existing?.provider ?? 'google',
        authMethod: config.authMethod ?? existing?.authMethod ?? 'api_key',
        apiKey: config.apiKey !== undefined ? config.apiKey : existing?.apiKey,
        baseUrl: config.baseUrl !== undefined ? config.baseUrl : existing?.baseUrl,
        model: config.model ?? existing?.model ?? 'gemini-4-argon-medium',
        effortLevel: config.effortLevel ?? existing?.effortLevel ?? 'medium',
        maxOutputTokens: config.maxOutputTokens ?? existing?.maxOutputTokens ?? 32768,
        cliBinary: config.cliBinary ?? existing?.cliBinary ?? 'claude',
        cliVersion: config.cliVersion ?? existing?.cliVersion,
        cliAuthStatus: config.cliAuthStatus ?? existing?.cliAuthStatus,
        connectionStatus: config.connectionStatus ?? existing?.connectionStatus ?? 'disconnected',
        lastTestedAt: config.lastTestedAt ?? existing?.lastTestedAt,
        latencyMs: config.latencyMs ?? existing?.latencyMs,
        errorMessage: config.errorMessage ?? existing?.errorMessage,
        updatedAt: new Date().toISOString()
      };

      const stmt = db.prepare(`
        INSERT INTO ai_connections (
          id, provider, auth_method, api_key, base_url, model,
          effort_level, max_output_tokens,
          cli_binary, cli_version, cli_auth_status, connection_status,
          last_tested_at, latency_ms, error_message, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          provider = excluded.provider,
          auth_method = excluded.auth_method,
          api_key = excluded.api_key,
          base_url = excluded.base_url,
          model = excluded.model,
          effort_level = excluded.effort_level,
          max_output_tokens = excluded.max_output_tokens,
          cli_binary = excluded.cli_binary,
          cli_version = excluded.cli_version,
          cli_auth_status = excluded.cli_auth_status,
          connection_status = excluded.connection_status,
          last_tested_at = excluded.last_tested_at,
          latency_ms = excluded.latency_ms,
          error_message = excluded.error_message,
          updated_at = excluded.updated_at
      `);

      stmt.run(
        merged.id,
        merged.provider,
        merged.authMethod,
        merged.apiKey ?? null,
        merged.baseUrl ?? null,
        merged.model,
        merged.effortLevel ?? 'medium',
        merged.maxOutputTokens ?? 32768,
        merged.cliBinary ?? null,
        merged.cliVersion ?? null,
        merged.cliAuthStatus ?? null,
        merged.connectionStatus,
        merged.lastTestedAt ?? null,
        merged.latencyMs ?? null,
        merged.errorMessage ?? null,
        merged.updatedAt
      );

      return merged;
    },
    updateStatus(status: AiConnectionConfig['connectionStatus'], latencyMs?: number, errorMessage?: string): void {
      const now = new Date().toISOString();
      const stmt = db.prepare(`
        UPDATE ai_connections
        SET connection_status = ?, latency_ms = ?, error_message = ?, last_tested_at = ?, updated_at = ?
        WHERE id = 'primary'
      `);
      stmt.run(status, latencyMs ?? null, errorMessage ?? null, now, now);
    }
  },

  aiModels: {
    /**
     * Replaces the stored model list for one (provider, authMethod, source) account atomically.
     */
    replaceForAccount(snapshot: AccountModelSnapshot): AccountModelSnapshot {
      const syncedAt = snapshot.syncedAt || new Date().toISOString();
      const del = db.prepare('DELETE FROM ai_models WHERE provider = ? AND auth_method = ? AND source = ?');
      const ins = db.prepare(`
        INSERT INTO ai_models (provider, auth_method, source, model_id, account, name, sort_order, data, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const tx = db.transaction(() => {
        del.run(snapshot.provider, snapshot.authMethod, snapshot.source);
        snapshot.models.forEach((m, idx) => {
          const entry: ModelOption = { ...m, source: snapshot.source, account: snapshot.account, syncedAt };
          ins.run(
            snapshot.provider,
            snapshot.authMethod,
            snapshot.source,
            m.id,
            snapshot.account ?? null,
            m.name,
            idx,
            JSON.stringify(entry),
            syncedAt
          );
        });
      });
      tx();
      return { ...snapshot, syncedAt };
    },

    /**
     * Reads the stored model list for an account. Returns null when never synced.
     */
    getForAccount(provider: string, authMethod: string, source: string): AccountModelSnapshot | null {
      const rows = db.prepare(`
        SELECT account, data, synced_at FROM ai_models
        WHERE provider = ? AND auth_method = ? AND source = ?
        ORDER BY sort_order ASC
      `).all(provider, authMethod, source) as Array<{ account: string | null; data: string; synced_at: string }>;
      if (rows.length === 0) return null;
      return {
        provider: provider as AccountModelSnapshot['provider'],
        authMethod: authMethod as AccountModelSnapshot['authMethod'],
        source,
        account: rows[0].account || undefined,
        syncedAt: rows[0].synced_at,
        models: rows.map(r => JSON.parse(r.data) as ModelOption)
      };
    }
  }
};
