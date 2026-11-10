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
  ModelOption,
  Project,
  StoredFileRecord,
  DocumentVersionRecord,
  SkillRecord,
  SkillVersionRecord,
  PipelineRunRecord,
  ReviewDecisionRecord,
  DocumentRelationshipRecord,
  UploadBatchRecord,
  JobRecord,
  KnowledgeUnitRecord,
  KnowledgeSourceRecord,
  ConflictRecord
} from '../common/types.js';
import { computeSha256, computeAuditEventHash } from '../common/crypto.js';
import { defaultFileStore } from '../common/fileStore.js';
import { DatabaseMigrator } from './migrator.js';
import { allMigrations } from './migrations/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// BUG-029: Allow tests to specify an isolated DB path via DOCQA_DB_PATH env var
const dbPath = process.env.DOCQA_DB_PATH || path.join(dataDir, 'docqa.sqlite');
export const db = new Database(dbPath);

// Enable WAL and busy timeout for concurrent testing and production resilience
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

// Execute database schema migrations with transactional versioning (E1-T1)
export const migrator = new DatabaseMigrator(db, allMigrations);
migrator.runPendingMigrations();

/* -------------------------------------------------------------
 * SEED BASELINE DATA IF TABLES ARE EMPTY
 * ----------------------------------------------------------- */

function seedDatabaseIfEmpty() {
  // 1. Seed Projects if empty
  const projectCount = (db.prepare('SELECT count(*) as count FROM projects').get() as any).count;
  if (projectCount === 0) {
    console.log('[SQLite DB] Seeding initial baseline projects...');
    const initialProjects: Project[] = [
      {
        id: 'PRJ-01',
        name: 'AI-Ready QA Platform MVP',
        key: 'DOCQA',
        description: 'Centralized workspace for Project Documentation, Traceability, Evidence and QA Lifecycle.',
        version: 'v0.1.0-mvp',
        author: 'Alex Nguyen (Lead Architect)',
        membersCount: 8,
        createdAt: '2026-11-01',
        updatedAt: '2026-11-01'
      },
      {
        id: 'PRJ-02',
        name: 'Fintech Core Banking & Payments',
        key: 'FCB',
        description: 'High-security microservices platform for inter-bank clearing and biometric transfers.',
        version: 'v2.4.1',
        author: 'Minh Tran (PM)',
        membersCount: 14,
        createdAt: '2026-09-15',
        updatedAt: '2026-10-20'
      }
    ];

    const insProj = db.prepare(`
      INSERT INTO projects (id, name, key, description, version, author, members_count, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of initialProjects) {
      insProj.run(p.id, p.name, p.key, p.description, p.version, p.author, p.membersCount, JSON.stringify(p), p.createdAt, p.updatedAt || p.createdAt);
    }
  }

  // Ensure all existing documents are mapped to PRJ-01 if missing
  try {
    db.exec("UPDATE documents SET project_id = 'PRJ-01' WHERE project_id IS NULL OR project_id = ''");
  } catch {}

  // Ensure baseline documents exist
  const insertDoc = db.prepare('INSERT OR IGNORE INTO documents (id, project_id, category, status, data, updated_at) VALUES (?, ?, ?, ?, ?, ?)');

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
      },
      {
        id: 'DOC-03',
        projectId: 'PRJ-01',
        title: 'Software Requirements Specification (SRS) - Evidence Lifecycle',
        category: '03_System_Requirements',
        currentVersion: 'v1.1',
        status: 'In Review',
        author: 'Sarah Le (Lead BA)',
        updatedAt: '2026-11-02 11:45',
        description: 'Functional specs for EVD storage references, multi-entity linking and audit immutability.',
        contentMarkdown: `# Software Requirements Specification (SRS) - Evidence Lifecycle

> **Module**: Lưu trữ Bằng chứng EVD & Chuỗi Truy vết Bất biến  
> **Phiên bản**: v1.1 (In Review) | **Tác giả**: Sarah Le (Lead BA)

---

## 1. Mục tiêu Phân hệ Bằng chứng (EVD)
Hệ thống **Evidence Lifecycle Management** chịu trách nhiệm thu thập, xác thực tính toàn vẹn và liên kết bằng chứng thực thi kiểm thử (log file, ảnh chụp màn hình, kết quả API JSON, video quay màn hình) với:
- Ca kiểm thử (\`TestCaseItem\`)
- Đợt chạy kiểm thử (\`TestRunItem\`)
- Yêu cầu nghiệp vụ (\`RequirementItem\`)
- Lỗi phát sinh (\`BugItem\`)

## 2. Quy trình Vòng đời Bằng chứng (Lifecycle Flow)
1. **Đăng ký (Upload & Register)**: Tester tải lên bằng chứng, nhập mô tả và môi trường thực thi (QA, Staging, Prod).
2. **Ký số & Mã băm (Hashing)**: Backend tự động tính toán mã băm mật mã học SHA-256 (\`sha256:xxxx\`) cho tệp đính kèm.
3. **Liên kết Chéo (Multi-entity Traceability)**: Gắn ID bằng chứng \`EVD-xxx\` vào các bản ghi liên quan.
4. **Xác thực Bằng chứng (Verify & Certify)**: Lead QA hoặc Approver kiểm tra và xác nhận tính xác thực (\`Verified = true\`).
`,
        tags: ['SRS', 'EVD', 'Storage'],
        linkedRequirementsCount: 2,
        versions: [
          {
            version: 'v1.1',
            updatedAt: '2026-11-02 11:45',
            author: 'Sarah Le',
            status: 'In Review',
            changeSummary: 'Defined presigned URL direct upload and tamper-evident hash signing.',
            fileSize: '3.1 MB',
            checksum: `sha256:${computeSha256('DOC-03|v1.1|SRS Evidence Lifecycle|2026-11-02')}`
          }
        ]
      },
      {
        id: 'DOC-04',
        projectId: 'PRJ-01',
        title: 'Figma Design System & 3-Column QA Workspace Wireframes',
        category: '04_UI_UX',
        currentVersion: 'v2.0',
        status: 'Approved',
        author: 'Duc Pham (QA Lead)',
        updatedAt: '2026-11-01 16:20',
        description: 'Component specs, 3-column split view layout, and evidence attachment drawer UI.',
        contentMarkdown: `# Figma Design System & 3-Column QA Workspace Wireframes

> **Dự án**: AI-Ready QA Platform MVP  
> **Chủ đề**: Quy chuẩn Giao diện 3 Cột & Bộ màu Dark Theme Slate  
> **Phiên bản**: v2.0 (Approved) | **Tác giả**: Duc Pham (QA Lead)

---

## 1. Triết lý Thiết kế Giao diện (Design Principles)
- **Zero White Borders**: Sử dụng dải màu Slate tối sâu (\`slate-950: #020617\`, \`slate-850: #162032\`, \`slate-750: #293548\`) loại bỏ hoàn toàn viền trắng fallback.
- **Three-Column Navigation**: Phân tách không gian làm việc chuyên nghiệp (Menu trái -> Danh mục/Cây dữ liệu -> Không gian đọc đặc tả & kiểm thử).
- **Instant Typography**: Trình hiển thị Markdown tối ưu hóa cho tài liệu kỹ thuật, bảng biểu RACI, checkbox tiêu chí nghiệm thu.
`,
        tags: ['Figma', 'UI/UX', 'Wireframe'],
        linkedRequirementsCount: 1,
        versions: [
          {
            version: 'v2.0',
            updatedAt: '2026-11-01 16:20',
            author: 'Duc Pham',
            status: 'Approved',
            changeSummary: 'Finalized dark slate theme tokens and 3-column test execution workspace layout.',
            fileSize: '1.8 MB',
            checksum: `sha256:${computeSha256('DOC-04|v2.0|Figma UI Specs 3-Column|2026-11-01')}`
          }
        ]
      },
      {
        id: 'DOC-05',
        projectId: 'PRJ-01',
        title: 'REST API & Traceability Schema Specifications',
        category: '05_Technical_Documents',
        currentVersion: 'v1.0',
        status: 'Approved',
        author: 'Khoa Dang (Tech Lead)',
        updatedAt: '2026-10-30 18:00',
        description: 'Complete OpenAPI 3.0 schema, webhook contracts, and SQLite JSON persistence layout.',
        contentMarkdown: `# REST API & Traceability Schema Specifications

> **Hệ thống**: DocQA Backend Micro-Service  
> **Giao thức**: RESTful JSON / SSE Streams  
> **Phiên bản**: v1.0 (Approved) | **Tác giả**: Khoa Dang (Tech Lead)

---

## 1. Danh sách Điểm cuối API (Endpoints Summary)
| Phương thức | Đường dẫn API | Mô tả nghiệp vụ |
| :--- | :--- | :--- |
| \`GET\` | \`/api/v1/documents\` | Truy vấn danh sách tài liệu dự án |
| \`POST\` | \`/api/v1/documents/upload-batch\` | Tải lên tệp .md, .zip tự động giải nén |
| \`GET\` | \`/api/v1/ai/connection\` | Lấy trạng thái kết nối AI & Model |
| \`POST\` | \`/api/v1/ai/connection/select-model\` | Chọn và lưu riêng model vào SQLite |
| \`POST\` | \`/api/v1/ai/models/effort\` | Lưu mức độ Out (Effort) theo từng model |
`,
        tags: ['API', 'OpenAPI', 'Technical'],
        linkedRequirementsCount: 3,
        versions: [
          {
            version: 'v1.0',
            updatedAt: '2026-10-30 18:00',
            author: 'Khoa Dang',
            status: 'Approved',
            changeSummary: 'Approved initial OpenAPI specification for Document & AI connection modules.',
            fileSize: '4.2 MB',
            checksum: `sha256:${computeSha256('DOC-05|v1.0|OpenAPI Spec Traceability|2026-10-30')}`
          }
        ]
      },
      {
        id: 'DOC-06',
        projectId: 'PRJ-01',
        title: 'Master Test Strategy & Acceptance Plan',
        category: '06_QA',
        currentVersion: 'v1.3',
        status: 'Approved',
        author: 'Duc Pham (QA Lead)',
        updatedAt: '2026-11-02 14:00',
        description: 'Regression coverage goals, test levels, defect severity definitions, and release sign-off rules.',
        contentMarkdown: `# Master Test Strategy & Acceptance Plan

> **Chiến lược**: Kiểm thử Toàn diện & Đối soát Toàn vẹn Yêu cầu  
> **Mục tiêu**: Bao phủ tối thiểu 95% Ma trận Truy vết  
> **Phiên bản**: v1.3 (Approved) | **Tác giả**: Duc Pham (QA Lead)

---

## 1. Tiêu chí Chất lượng & Cấp độ Kiểm thử
1. **Unit & Integration Test**: Đảm bảo 100% logic mật mã học SHA-256, SQLite repository và AI subprocess bridge hoạt động ổn định.
2. **Acceptance Criteria Verification**: Mọi ca kiểm thử phải truy xuất ngược được về ít nhất 1 tài liệu đặc tả có trạng thái \`Approved\`.
3. **Evidence Strict Rule**: Bất kỳ ca kiểm thử nào có kết quả \`Failed\` bắt buộc phải đính kèm ít nhất 1 bằng chứng EVD hợp lệ.
`,
        tags: ['QA', 'Strategy', 'TestPlan'],
        linkedRequirementsCount: 2,
        versions: [
          {
            version: 'v1.3',
            updatedAt: '2026-11-02 14:00',
            author: 'Duc Pham',
            status: 'Approved',
            changeSummary: 'Mandated SHA-256 evidence validation for all failed test execution results.',
            fileSize: '2.1 MB',
            checksum: `sha256:${computeSha256('DOC-06|v1.3|QA Master Strategy|2026-11-02')}`
          }
        ]
      }
    ];

    for (const doc of initialDocs) {
      insertDoc.run(doc.id, doc.projectId || 'PRJ-01', doc.category, doc.status, JSON.stringify(doc), doc.updatedAt);
    }

    // Seed sample document for PRJ-02
    const fcbDoc: DocumentItem = {
      id: 'DOC-FCB-01',
      projectId: 'PRJ-02',
      title: 'Core Banking Payment Gateway & Clearing Specs',
      category: '03_System_Requirements',
      currentVersion: 'v2.4',
      status: 'Approved',
      author: 'Minh Tran (PM)',
      updatedAt: '2026-10-20 14:00',
      description: 'Interbank settlement specifications, biometric authentication protocols, and ISO 20022 message mappings.',
      tags: ['Payment', 'ISO20022', 'CoreBanking'],
      linkedRequirementsCount: 1,
      versions: [
        {
          version: 'v2.4',
          updatedAt: '2026-10-20 14:00',
          author: 'Minh Tran',
          status: 'Approved',
          changeSummary: 'Updated clearing window and zero-trust payload encryption rules.',
          fileSize: '3.4 MB',
          checksum: `sha256:${computeSha256('DOC-FCB-01|v2.4|Core Banking Payment Gateway|2026-10-20')}`
        }
      ]
    };
    insertDoc.run(fcbDoc.id, fcbDoc.projectId!, fcbDoc.category, fcbDoc.status, JSON.stringify(fcbDoc), fcbDoc.updatedAt);

  const reqCount = (db.prepare('SELECT count(*) as count FROM requirements').get() as any).count;
  if (reqCount === 0) {
    // Seed Requirements
    const initialReqs: RequirementItem[] = [
      {
        id: 'REQ-001',
        projectId: 'PRJ-01',
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

    // Seed requirements must carry project_id so project isolation stays fail-closed (R7-02)
    const insertReq = db.prepare('INSERT INTO requirements (id, project_id, type, priority, status, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const req of initialReqs) {
      insertReq.run(req.id, req.projectId || 'PRJ-01', req.type, req.priority, req.status, JSON.stringify(req), req.updatedAt);
    }

    // Seed Evidence
    const initialEvd: EvidenceItem[] = [
      {
        id: 'EVD-001',
        projectId: 'PRJ-01',
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

    const insertEvd = db.prepare('INSERT INTO evidence (id, project_id, type, environment, status, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const evd of initialEvd) {
      insertEvd.run(evd.id, evd.projectId || 'PRJ-01', evd.type, evd.environment, evd.status, JSON.stringify(evd), evd.createdAt);
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
        projectId: 'PRJ-01',
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

    const insertRun = db.prepare('INSERT INTO test_runs (id, project_id, status, environment, data, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    for (const run of initialRuns) {
      insertRun.run(run.id, (run as any).projectId || 'PRJ-01', run.status, run.environment, JSON.stringify(run), run.createdAt);
    }

    // Seed Bugs
    const initialBugs: BugItem[] = [
      {
        id: 'BUG-001',
        projectId: 'PRJ-01',
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

    const insertBug = db.prepare('INSERT INTO bugs (id, project_id, status, severity, priority, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const bug of initialBugs) {
      insertBug.run(bug.id, (bug as any).projectId || 'PRJ-01', bug.status, bug.severity, bug.priority, JSON.stringify(bug), bug.updatedAt);
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

function ensureStoredFilesSynced() {
  try {
    const docs = db.prepare('SELECT id, data FROM documents').all() as { id: string; data: string }[];
    for (const row of docs) {
      try {
        const doc = JSON.parse(row.data);
        const versions = db.prepare('SELECT id, file_id FROM document_versions WHERE document_id = ?').all(doc.id) as any[];
        if (versions.length === 0 || !versions[0].file_id) {
          const content = doc.contentMarkdown || `# ${doc.title}

> **Dự án**: ${doc.projectId || 'PRJ-01'} | **Mã**: \`${doc.id}\` | **Phiên bản**: \`${doc.currentVersion || 'v1.0'}\`  
> **Tác giả**: ${doc.author || 'System'} | **Cập nhật**: ${doc.updatedAt || '2026-11-01'}

---

## 1. Tóm tắt Mục tiêu & Bối cảnh
${doc.description || 'Đặc tả kỹ thuật chuẩn hệ thống.'}

## 2. Quy tắc Nghiệp vụ & Toàn vẹn
- Tất cả các văn bản đều được ký số bất biến SHA-256.
- Mọi thay đổi đều được ghi vết kiểm toán chuỗi khối.
`;
          const buffer = Buffer.from(content, 'utf-8');
          const fileSha256 = `sha256:${computeSha256(buffer)}`;
          const storageKey = `projects/${doc.projectId || 'PRJ-01'}/${doc.id}/${doc.id}.md`;
          const fileId = `FILE-${computeSha256(Buffer.from(storageKey)).slice(0, 16)}`;

          defaultFileStore.put(`${doc.id}.md`, buffer, storageKey);
          db.prepare(`
            INSERT OR IGNORE INTO stored_files (id, storage_key, original_name, mime_type, size_bytes, sha256, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(fileId, storageKey, `${doc.id}.md`, 'text/markdown', buffer.length, fileSha256, doc.updatedAt || '2026-11-01');

          const vId = `${doc.id}-v1_0`;
          db.prepare(`
            INSERT OR REPLACE INTO document_versions (id, document_id, version_no, file_id, extracted_content, status, change_summary, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(vId, doc.id, doc.currentVersion || 'v1.0', fileId, content, doc.status || 'Draft', 'Synchronized baseline version', doc.author || 'System', doc.updatedAt || '2026-11-01');
        }
      } catch {}
    }
  } catch {}
}

ensureStoredFilesSynced();

/* -------------------------------------------------------------
 * REPOSITORY HELPERS FOR ALL ENTITIES
 * ----------------------------------------------------------- */

export function compareVersionNumbers(v1: string, v2: string): number {
  const parseParts = (v: string) => (v || '').replace(/^[^\d]*/, '').split(/[\.-]/).map(p => parseInt(p, 10) || 0);
  const p1 = parseParts(v1);
  const p2 = parseParts(v2);
  const maxLen = Math.max(p1.length, p2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = p1[i] ?? 0;
    const num2 = p2[i] ?? 0;
    if (num1 !== num2) return num1 - num2;
  }
  return (v1 || '').localeCompare(v2 || '');
}

export const dbRepository = {
  projects: {
    getAll(): Project[] {
      const rows = db.prepare('SELECT id, name, key, description, version, author, members_count, ai_policy, data FROM projects ORDER BY created_at ASC').all() as any[];
      return rows.map(r => {
        const parsed = r.data ? JSON.parse(r.data) : {};
        return {
          id: r.id,
          name: r.name,
          key: r.key,
          description: r.description,
          version: r.version,
          author: r.author,
          membersCount: r.members_count,
          aiPolicy: r.ai_policy,
          ...parsed
        };
      });
    },
    getById(id: string): Project | null {
      const row = db.prepare('SELECT id, name, key, description, version, author, members_count, ai_policy, data FROM projects WHERE id = ?').get(id) as any;
      if (!row) return null;
      const parsed = row.data ? JSON.parse(row.data) : {};
      return {
        id: row.id,
        name: row.name,
        key: row.key,
        description: row.description,
        version: row.version,
        author: row.author,
        membersCount: row.members_count,
        aiPolicy: row.ai_policy,
        ...parsed
      };
    },
    upsert(p: Project & { aiPolicy?: string; ai_policy?: string }): Project {
      const existing = db.prepare('SELECT id, key, ai_policy, created_at FROM projects WHERE id = ?').get(p.id) as any;
      const effectivePolicy = p.aiPolicy || p.ai_policy || existing?.ai_policy || 'OFFLINE_ONLY';
      const effectiveKey = p.key || existing?.key || (p.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'PRJ');
      const now = new Date().toISOString();
      const effectiveCreatedAt = p.createdAt || existing?.created_at || now;
      const effectiveUpdatedAt = p.updatedAt || now;
      const pWithPolicy = { ...p, key: effectiveKey, aiPolicy: effectivePolicy, createdAt: effectiveCreatedAt, updatedAt: effectiveUpdatedAt };

      const stmt = db.prepare(`
        INSERT INTO projects (id, name, key, description, version, author, members_count, ai_policy, data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          key = excluded.key,
          description = excluded.description,
          version = excluded.version,
          author = excluded.author,
          members_count = excluded.members_count,
          ai_policy = excluded.ai_policy,
          data = excluded.data,
          updated_at = excluded.updated_at
      `);
      stmt.run(
        p.id,
        p.name,
        effectiveKey,
        p.description || null,
        p.version || null,
        p.author || null,
        p.membersCount || null,
        effectivePolicy,
        JSON.stringify(pWithPolicy),
        effectiveCreatedAt,
        effectiveUpdatedAt
      );
      return pWithPolicy as Project;
    },
    delete(id: string): boolean {
      const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
      return result.changes > 0;
    }
  },

  documents: {
    getAll(projectId?: string): DocumentItem[] {
      if (projectId && projectId !== 'ALL') {
        const rows = db.prepare('SELECT data FROM documents WHERE project_id = ? ORDER BY category ASC, id ASC').all(projectId) as { data: string }[];
        return rows.map(r => JSON.parse(r.data));
      }
      const rows = db.prepare('SELECT data FROM documents ORDER BY category ASC, id ASC').all() as { data: string }[];
      return rows.map(r => JSON.parse(r.data));
    },
    getById(id: string): DocumentItem | null {
      const row = db.prepare('SELECT id, project_id, category, status, data, updated_at FROM documents WHERE id = ?').get(id) as any;
      if (!row) return null;
      try {
        const parsed = JSON.parse(row.data || '{}');
        return {
          ...parsed,
          id: row.id,
          projectId: row.project_id || parsed.projectId || 'PRJ-01',
          category: row.category || parsed.category,
          status: row.status || parsed.status,
          updatedAt: row.updated_at || parsed.updatedAt
        };
      } catch {
        return null;
      }
    },
    upsert(doc: DocumentItem): void {
      const pId = doc.projectId || 'PRJ-01';
      const docWithProj = { ...doc, projectId: pId };
      const stmt = db.prepare(`
        INSERT INTO documents (id, project_id, category, status, data, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          project_id = excluded.project_id,
          category = excluded.category,
          status = excluded.status,
          data = excluded.data,
          updated_at = excluded.updated_at
      `);
      stmt.run(doc.id, pId, doc.category, doc.status, JSON.stringify(docWithProj), doc.updatedAt);
    },
    delete(id: string): boolean {
      const result = db.prepare('DELETE FROM documents WHERE id = ?').run(id);
      return result.changes > 0;
    }
  },

  storedFiles: {
    getById(id: string): StoredFileRecord | null {
      const row = db.prepare('SELECT id, storage_key as storageKey, original_name as originalName, mime_type as mimeType, size_bytes as sizeBytes, sha256, created_at as createdAt FROM stored_files WHERE id = ?').get(id) as StoredFileRecord | undefined;
      return row || null;
    },
    getBySha256(sha256: string): StoredFileRecord | null {
      const row = db.prepare('SELECT id, storage_key as storageKey, original_name as originalName, mime_type as mimeType, size_bytes as sizeBytes, sha256, created_at as createdAt FROM stored_files WHERE sha256 = ?').get(sha256) as StoredFileRecord | undefined;
      return row || null;
    },
    upsert(file: StoredFileRecord): void {
      const stmt = db.prepare(`
        INSERT INTO stored_files (id, storage_key, original_name, mime_type, size_bytes, sha256, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          storage_key = excluded.storage_key,
          original_name = excluded.original_name,
          mime_type = excluded.mime_type,
          size_bytes = excluded.size_bytes,
          sha256 = excluded.sha256,
          created_at = excluded.created_at
      `);
      stmt.run(file.id, file.storageKey, file.originalName, file.mimeType, file.sizeBytes, file.sha256, file.createdAt);
    }
  },

  documentVersions: {
    getByDocumentId(docId: string): DocumentVersionRecord[] {
      const rows = db.prepare('SELECT id, document_id as documentId, version_no as versionNo, file_id as fileId, extracted_content as extractedContent, status, change_summary as changeSummary, created_by as createdBy, created_at as createdAt FROM document_versions WHERE document_id = ?').all(docId) as DocumentVersionRecord[];
      return rows.sort((a, b) => compareVersionNumbers(a.versionNo, b.versionNo));
    },
    getById(id: string): DocumentVersionRecord | null {
      const row = db.prepare('SELECT id, document_id as documentId, version_no as versionNo, file_id as fileId, extracted_content as extractedContent, status, change_summary as changeSummary, created_by as createdBy, created_at as createdAt FROM document_versions WHERE id = ?').get(id) as DocumentVersionRecord | undefined;
      return row || null;
    },
    upsert(v: DocumentVersionRecord): void {
      const stmt = db.prepare(`
        INSERT INTO document_versions (id, document_id, version_no, file_id, extracted_content, status, change_summary, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          version_no = excluded.version_no,
          file_id = excluded.file_id,
          extracted_content = excluded.extracted_content,
          status = excluded.status,
          change_summary = excluded.change_summary,
          created_by = excluded.created_by,
          created_at = excluded.created_at
      `);
      stmt.run(v.id, v.documentId, v.versionNo, v.fileId, v.extractedContent, v.status, v.changeSummary, v.createdBy, v.createdAt);
    }
  },

  skills: {
    getAll(): SkillRecord[] {
      return db.prepare('SELECT id, name, description, created_at as createdAt FROM skills ORDER BY name ASC').all() as SkillRecord[];
    },
    getById(id: string): SkillRecord | null {
      const row = db.prepare('SELECT id, name, description, created_at as createdAt FROM skills WHERE id = ?').get(id) as SkillRecord | undefined;
      return row || null;
    },
    getVersions(skillId: string): SkillVersionRecord[] {
      return db.prepare('SELECT id, skill_id as skillId, version, prompt_template as promptTemplate, prompt_hash as promptHash, input_schema as inputSchema, output_schema as outputSchema, model_recommended as modelRecommended, created_at as createdAt FROM skill_versions WHERE skill_id = ? ORDER BY version DESC').all(skillId) as SkillVersionRecord[];
    },
    upsertVersion(v: SkillVersionRecord): void {
      const stmt = db.prepare(`
        INSERT INTO skill_versions (id, skill_id, version, prompt_template, prompt_hash, input_schema, output_schema, model_recommended, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(skill_id, version) DO UPDATE SET
          prompt_template = excluded.prompt_template,
          prompt_hash = excluded.prompt_hash,
          input_schema = excluded.input_schema,
          output_schema = excluded.output_schema,
          model_recommended = excluded.model_recommended
      `);
      stmt.run(v.id, v.skillId, v.version, v.promptTemplate, v.promptHash, v.inputSchema, v.outputSchema, v.modelRecommended, v.createdAt);
    }
  },

  pipelineRuns: {
    getByDocumentVersion(docVersionId: string): PipelineRunRecord[] {
      return db.prepare('SELECT id, document_version_id as documentVersionId, skill_version_id as skillVersionId, model_id as modelId, provider, status, input_payload as inputPayload, output_payload as outputPayload, tokens_prompt as tokensPrompt, tokens_completion as tokensCompletion, latency_ms as latencyMs, error_message as errorMessage, created_at as createdAt FROM pipeline_runs WHERE document_version_id = ? ORDER BY created_at DESC').all(docVersionId) as PipelineRunRecord[];
    },
    getById(id: string): PipelineRunRecord | null {
      const row = db.prepare('SELECT id, document_version_id as documentVersionId, skill_version_id as skillVersionId, model_id as modelId, provider, status, input_payload as inputPayload, output_payload as outputPayload, tokens_prompt as tokensPrompt, tokens_completion as tokensCompletion, latency_ms as latencyMs, error_message as errorMessage, created_at as createdAt FROM pipeline_runs WHERE id = ?').get(id) as PipelineRunRecord | undefined;
      return row || null;
    },
    upsert(run: PipelineRunRecord): void {
      const stmt = db.prepare(`
        INSERT INTO pipeline_runs (id, document_version_id, skill_version_id, model_id, provider, status, input_payload, output_payload, tokens_prompt, tokens_completion, latency_ms, error_message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          output_payload = excluded.output_payload,
          tokens_prompt = excluded.tokens_prompt,
          tokens_completion = excluded.tokens_completion,
          latency_ms = excluded.latency_ms,
          error_message = excluded.error_message
      `);
      stmt.run(run.id, run.documentVersionId, run.skillVersionId, run.modelId, run.provider, run.status, run.inputPayload, run.outputPayload, run.tokensPrompt, run.tokensCompletion, run.latencyMs, run.errorMessage, run.createdAt);
    }
  },

  reviewDecisions: {
    getByTarget(targetType: string, targetId: string): ReviewDecisionRecord[] {
      return db.prepare('SELECT id, target_type as targetType, target_id as targetId, decision, reviewer, comment, created_at as createdAt FROM review_decisions WHERE target_type = ? AND target_id = ? ORDER BY created_at DESC').all(targetType, targetId) as ReviewDecisionRecord[];
    },
    create(decision: ReviewDecisionRecord): void {
      db.prepare(`
        INSERT OR REPLACE INTO review_decisions (id, target_type, target_id, decision, reviewer, comment, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(decision.id, decision.targetType, decision.targetId, decision.decision, decision.reviewer, decision.comment, decision.createdAt);
    }
  },

  documentRelationships: {
    getByDocument(docId: string): DocumentRelationshipRecord[] {
      return db.prepare('SELECT id, source_doc_id as sourceDocId, target_doc_id as targetDocId, relationship_type as relationshipType, confidence_score as confidenceScore, created_at as createdAt FROM document_relationships WHERE source_doc_id = ? OR target_doc_id = ?').all(docId, docId) as DocumentRelationshipRecord[];
    },
    upsert(rel: DocumentRelationshipRecord): void {
      db.prepare(`
        INSERT INTO document_relationships (id, source_doc_id, target_doc_id, relationship_type, confidence_score, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          relationship_type = excluded.relationship_type,
          confidence_score = excluded.confidence_score
      `).run(rel.id, rel.sourceDocId, rel.targetDocId, rel.relationshipType, rel.confidenceScore, rel.createdAt);
    }
  },

  uploadBatches: {
    getById(id: string): UploadBatchRecord | null {
      const row = db.prepare(`
        SELECT id, project_id as projectId, filename, total_files as totalFiles,
               processed_files as processedFiles, failed_files as failedFiles,
               status, error_summary as errorSummary, batch_details as batchDetails,
               created_at as createdAt
        FROM upload_batches
        WHERE id = ?
      `).get(id) as UploadBatchRecord | undefined;
      return row || null;
    },
    getByProjectId(projectId: string): UploadBatchRecord[] {
      const rows = db.prepare(`
        SELECT id, project_id as projectId, filename, total_files as totalFiles,
               processed_files as processedFiles, failed_files as failedFiles,
               status, error_summary as errorSummary, batch_details as batchDetails,
               created_at as createdAt
        FROM upload_batches
        WHERE project_id = ?
        ORDER BY created_at DESC
      `).all(projectId) as UploadBatchRecord[];
      return rows;
    },
    upsert(b: UploadBatchRecord): void {
      const stmt = db.prepare(`
        INSERT INTO upload_batches (id, project_id, filename, total_files, processed_files, failed_files, status, error_summary, batch_details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          project_id = excluded.project_id,
          filename = excluded.filename,
          total_files = excluded.total_files,
          processed_files = excluded.processed_files,
          failed_files = excluded.failed_files,
          status = excluded.status,
          error_summary = excluded.error_summary,
          batch_details = excluded.batch_details
      `);
      stmt.run(b.id, b.projectId, b.filename, b.totalFiles, b.processedFiles, b.failedFiles, b.status, b.errorSummary || null, b.batchDetails || null, b.createdAt);
    }
  },

  jobs: {
    create(job: JobRecord): void {
      const stmt = db.prepare(`
        INSERT INTO jobs (id, type, payload, status, attempts, max_attempts, locked_by, locked_at, next_run_at, last_error, result, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        job.id,
        job.type,
        job.payload,
        job.status,
        job.attempts,
        job.maxAttempts,
        job.lockedBy || null,
        job.lockedAt || null,
        job.nextRunAt,
        job.lastError || null,
        job.result || null,
        job.createdAt,
        job.updatedAt
      );
    },
    getById(id: string): JobRecord | null {
      const row = db.prepare(`
        SELECT id, type, payload, status, attempts, max_attempts as maxAttempts,
               locked_by as lockedBy, locked_at as lockedAt, next_run_at as nextRunAt,
               last_error as lastError, result, created_at as createdAt, updated_at as updatedAt
        FROM jobs WHERE id = ?
      `).get(id) as JobRecord | undefined;
      return row || null;
    },
    pollAndLock(workerId: string, limit = 5): JobRecord[] {
      const now = new Date().toISOString();
      const lockTx = db.transaction(() => {
        const rows = db.prepare(`
          SELECT id, type, payload, status, attempts, max_attempts as maxAttempts,
                 locked_by as lockedBy, locked_at as lockedAt, next_run_at as nextRunAt,
                 last_error as lastError, result, created_at as createdAt, updated_at as updatedAt
          FROM jobs
          WHERE status = 'PENDING' AND next_run_at <= ?
          ORDER BY next_run_at ASC
          LIMIT ?
        `).all(now, limit) as JobRecord[];

        if (rows.length === 0) return [];

        const updateStmt = db.prepare(`
          UPDATE jobs
          SET status = 'RUNNING', locked_by = ?, locked_at = ?, updated_at = ?
          WHERE id = ? AND status = 'PENDING'
        `);

        const locked: JobRecord[] = [];
        for (const row of rows) {
          const res = updateStmt.run(workerId, now, now, row.id);
          if (res.changes > 0) {
            locked.push({
              ...row,
              status: 'RUNNING',
              lockedBy: workerId,
              lockedAt: now,
              updatedAt: now
            });
          }
        }
        return locked;
      });

      return lockTx.immediate();
    },
    resetForRetry(id: string): boolean {
      const now = new Date().toISOString();
      const res = db.prepare(`
        UPDATE jobs
        SET status = 'PENDING', attempts = 0, locked_by = NULL, locked_at = NULL, next_run_at = ?, last_error = NULL, updated_at = ?
        WHERE id = ? AND status = 'FAILED'
      `).run(now, now, id);
      return res.changes > 0;
    },
    heartbeat(id: string, workerId: string): boolean {
      const now = new Date().toISOString();
      const res = db.prepare(`
        UPDATE jobs
        SET locked_at = ?, updated_at = ?
        WHERE id = ? AND status = 'RUNNING' AND locked_by = ?
      `).run(now, now, id, workerId);
      return res.changes > 0;
    },
    complete(id: string, result?: any, workerId?: string): boolean {
      const now = new Date().toISOString();
      const resultStr = result ? (typeof result === 'string' ? result : JSON.stringify(result)) : null;
      let query = `
        UPDATE jobs
        SET status = 'COMPLETED', result = ?, locked_by = NULL, locked_at = NULL, updated_at = ?
        WHERE id = ? AND status = 'RUNNING'
      `;
      const params: any[] = [resultStr, now, id];
      if (workerId) {
        query += ` AND locked_by = ?`;
        params.push(workerId);
      }
      const res = db.prepare(query).run(...params);
      return res.changes > 0;
    },
    failWithRetry(id: string, error: string, backoffSeconds?: number, workerId?: string): boolean {
      const now = new Date();
      const job = this.getById(id);
      if (!job) return false;
      if (job.status !== 'RUNNING') return false;
      if (workerId && job.lockedBy && job.lockedBy !== workerId) return false;

      const newAttempts = job.attempts + 1;
      const timestamp = now.toISOString();

      if (newAttempts < job.maxAttempts) {
        // Exponential backoff or custom backoff: default = 2^(attempts) * 5 seconds
        const delay = backoffSeconds !== undefined ? backoffSeconds : Math.pow(2, newAttempts) * 5;
        const nextRun = new Date(now.getTime() + delay * 1000).toISOString();
        const res = db.prepare(`
          UPDATE jobs
          SET status = 'PENDING', attempts = ?, locked_by = NULL, locked_at = NULL, next_run_at = ?, last_error = ?, updated_at = ?
          WHERE id = ? AND status = 'RUNNING'
        `).run(newAttempts, nextRun, error, timestamp, id);
        return res.changes > 0;
      } else {
        const res = db.prepare(`
          UPDATE jobs
          SET status = 'FAILED', attempts = ?, locked_by = NULL, locked_at = NULL, last_error = ?, updated_at = ?
          WHERE id = ? AND status = 'RUNNING'
        `).run(newAttempts, error, timestamp, id);
        return res.changes > 0;
      }
    },
    cancel(id: string, reason?: string): boolean {
      const now = new Date().toISOString();
      const res = db.prepare(`
        UPDATE jobs
        SET status = 'CANCELLED', last_error = ?, locked_by = NULL, locked_at = NULL, updated_at = ?
        WHERE id = ? AND status IN ('PENDING', 'RUNNING')
      `).run(reason || 'Job cancelled by user', now, id);
      return res.changes > 0;
    },
    resetStaleLocks(staleSeconds = 300): number {
      const cutoff = new Date(Date.now() - staleSeconds * 1000).toISOString();
      const now = new Date().toISOString();

      const staleJobs = db.prepare(`
        SELECT id, attempts, max_attempts FROM jobs
        WHERE status = 'RUNNING' AND (locked_at IS NULL OR locked_at < ?)
      `).all(cutoff) as Array<{ id: string; attempts: number; max_attempts: number }>;

      let recovered = 0;
      for (const job of staleJobs) {
        const nextAttempts = job.attempts + 1;
        if (nextAttempts >= job.max_attempts) {
          db.prepare(`
            UPDATE jobs
            SET status = 'FAILED', attempts = ?, locked_by = NULL, locked_at = NULL, last_error = 'Stale lock timeout exceeded max attempts', updated_at = ?
            WHERE id = ? AND status = 'RUNNING'
          `).run(nextAttempts, now, job.id);
        } else {
          db.prepare(`
            UPDATE jobs
            SET status = 'PENDING', attempts = ?, locked_by = NULL, locked_at = NULL, last_error = 'Stale lock recovered', updated_at = ?
            WHERE id = ? AND status = 'RUNNING'
          `).run(nextAttempts, now, job.id);
        }
        recovered++;
      }
      return recovered;
    }
  },

  knowledgeUnits: {
    create(unit: KnowledgeUnitRecord): void {
      db.prepare(`
        INSERT INTO knowledge_units (id, project_id, unit_type, content, subject, action, condition, evidence_level, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          content = CASE WHEN knowledge_units.status = 'Approved' THEN knowledge_units.content ELSE excluded.content END,
          subject = CASE WHEN knowledge_units.status = 'Approved' THEN knowledge_units.subject ELSE excluded.subject END,
          action = CASE WHEN knowledge_units.status = 'Approved' THEN knowledge_units.action ELSE excluded.action END,
          condition = CASE WHEN knowledge_units.status = 'Approved' THEN knowledge_units.condition ELSE excluded.condition END,
          evidence_level = CASE WHEN knowledge_units.status = 'Approved' THEN knowledge_units.evidence_level ELSE excluded.evidence_level END,
          status = CASE WHEN knowledge_units.status = 'Approved' THEN knowledge_units.status ELSE excluded.status END,
          updated_at = excluded.updated_at
      `).run(unit.id, unit.projectId, unit.unitType, unit.content, unit.subject, unit.action, unit.condition || null, unit.evidenceLevel, unit.status, unit.createdAt, unit.updatedAt);
    },
    getById(id: string): KnowledgeUnitRecord | null {
      const row = db.prepare(`
        SELECT id, project_id as projectId, unit_type as unitType, content,
               subject, action, condition, evidence_level as evidenceLevel,
               status, created_at as createdAt, updated_at as updatedAt
        FROM knowledge_units WHERE id = ?
      `).get(id) as KnowledgeUnitRecord | undefined;
      return row || null;
    },
    getByProject(projectId: string, filter?: { status?: string; unitType?: string }): KnowledgeUnitRecord[] {
      let query = `
        SELECT id, project_id as projectId, unit_type as unitType, content,
               subject, action, condition, evidence_level as evidenceLevel,
               status, created_at as createdAt, updated_at as updatedAt
        FROM knowledge_units WHERE project_id = ?
      `;
      const params: any[] = [projectId];
      if (filter?.status && filter.status !== 'ALL') {
        query += ' AND status = ?';
        params.push(filter.status);
      }
      if (filter?.unitType && filter.unitType !== 'ALL') {
        query += ' AND unit_type = ?';
        params.push(filter.unitType);
      }
      query += ' ORDER BY created_at DESC';
      return db.prepare(query).all(...params) as KnowledgeUnitRecord[];
    },
    getByDocumentVersion(documentVersionId: string): (KnowledgeUnitRecord & { sources: KnowledgeSourceRecord[] })[] {
      const rows = db.prepare(`
        SELECT DISTINCT ku.id, ku.project_id as projectId, ku.unit_type as unitType, ku.content,
               ku.subject, ku.action, ku.condition, ku.evidence_level as evidenceLevel,
               ku.status, ku.created_at as createdAt, ku.updated_at as updatedAt
        FROM knowledge_units ku
        JOIN knowledge_sources ks ON ks.unit_id = ku.id
        WHERE ks.document_version_id = ?
        ORDER BY ku.created_at DESC
      `).all(documentVersionId) as KnowledgeUnitRecord[];

      return rows.map(r => ({
        ...r,
        sources: dbRepository.knowledgeSources.getByUnitId(r.id)
      }));
    },
    updateStatus(id: string, status: string): boolean {
      const now = new Date().toISOString();
      const res = db.prepare('UPDATE knowledge_units SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
      return res.changes > 0;
    },
    supersedeOlderUnits(projectId: string, currentUnitId: string, subject: string): number {
      const now = new Date().toISOString();
      const res = db.prepare(`
        UPDATE knowledge_units
        SET status = 'Superseded', updated_at = ?
        WHERE project_id = ? AND subject = ? AND id != ? AND status = 'Approved'
      `).run(now, projectId, subject, currentUnitId);
      return res.changes;
    }
  },

  knowledgeSources: {
    create(src: KnowledgeSourceRecord): void {
      db.prepare(`
        INSERT OR REPLACE INTO knowledge_sources (id, unit_id, document_version_id, heading_path, char_offset_start, char_offset_end, page_number, exact_quote, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(src.id, src.unitId, src.documentVersionId, src.headingPath, src.charOffsetStart, src.charOffsetEnd, src.pageNumber || null, src.exactQuote, src.createdAt);
    },
    getByUnitId(unitId: string): KnowledgeSourceRecord[] {
      return db.prepare(`
        SELECT id, unit_id as unitId, document_version_id as documentVersionId,
               heading_path as headingPath, char_offset_start as charOffsetStart,
               char_offset_end as charOffsetEnd, page_number as pageNumber,
               exact_quote as exactQuote, created_at as createdAt
        FROM knowledge_sources WHERE unit_id = ?
      `).all(unitId) as KnowledgeSourceRecord[];
    }
  },

  conflicts: {
    create(c: ConflictRecord): void {
      db.prepare(`
        INSERT INTO conflicts (id, project_id, unit_a_id, unit_b_id, conflict_type, severity, description, resolution, resolved_by, resolved_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(c.id, c.projectId, c.unitAId, c.unitBId, c.conflictType, c.severity, c.description, c.resolution, c.resolvedBy || null, c.resolvedAt || null, c.createdAt);
    },
    getById(id: string): ConflictRecord | null {
      const row = db.prepare(`
        SELECT id, project_id as projectId, unit_a_id as unitAId, unit_b_id as unitBId,
               conflict_type as conflictType, severity, description, resolution,
               resolution_notes as resolutionNotes,
               resolved_by as resolvedBy, resolved_at as resolvedAt, created_at as createdAt
        FROM conflicts WHERE id = ?
      `).get(id) as ConflictRecord | undefined;
      return row || null;
    },
    getByProject(projectId: string, severity?: string): ConflictRecord[] {
      let query = `
        SELECT id, project_id as projectId, unit_a_id as unitAId, unit_b_id as unitBId,
               conflict_type as conflictType, severity, description, resolution,
               resolution_notes as resolutionNotes,
               resolved_by as resolvedBy, resolved_at as resolvedAt, created_at as createdAt
        FROM conflicts
        WHERE project_id = ?
      `;
      const params: any[] = [projectId];
      if (severity) {
        query += ' AND severity = ?';
        params.push(severity);
      }
      return db.prepare(query).all(...params) as ConflictRecord[];
    },
    getUnresolved(): ConflictRecord[] {
      return db.prepare(`
        SELECT id, project_id as projectId, unit_a_id as unitAId, unit_b_id as unitBId,
               conflict_type as conflictType, severity, description, resolution,
               resolution_notes as resolutionNotes,
               resolved_by as resolvedBy, resolved_at as resolvedAt, created_at as createdAt
        FROM conflicts
        WHERE resolution = 'UNRESOLVED'
      `).all() as ConflictRecord[];
    },
    getUnresolvedByProject(projectId: string, severity?: string): ConflictRecord[] {
      let query = `
        SELECT id, project_id as projectId, unit_a_id as unitAId, unit_b_id as unitBId,
               conflict_type as conflictType, severity, description, resolution,
               resolution_notes as resolutionNotes,
               resolved_by as resolvedBy, resolved_at as resolvedAt, created_at as createdAt
        FROM conflicts
        WHERE project_id = ? AND resolution = 'UNRESOLVED'
      `;
      const params: any[] = [projectId];
      if (severity) {
        query += ' AND severity = ?';
        params.push(severity);
      }
      return db.prepare(query).all(...params) as ConflictRecord[];
    },
    resolve(id: string, resolution: string, resolvedBy: string, notes?: string): boolean {
      const now = new Date().toISOString();
      const res = db.prepare(`
        UPDATE conflicts
        SET resolution = ?, resolved_by = ?, resolved_at = ?, resolution_notes = coalesce(?, resolution_notes)
        WHERE id = ? AND resolution = 'UNRESOLVED'
      `).run(resolution, resolvedBy, now, notes || null, id);
      return res.changes > 0;
    }
  },

  requirements: {
    getAll(projectId?: string): RequirementItem[] {
      if (projectId && projectId !== 'ALL') {
        const rows = db.prepare('SELECT data FROM requirements WHERE project_id = ? ORDER BY updated_at DESC').all(projectId) as { data: string }[];
        return rows.map(r => JSON.parse(r.data));
      }
      const rows = db.prepare('SELECT data FROM requirements ORDER BY updated_at DESC').all() as { data: string }[];
      return rows.map(r => JSON.parse(r.data));
    },
    getById(id: string): (RequirementItem & { projectId?: string }) | null {
      const row = db.prepare('SELECT project_id, data FROM requirements WHERE id = ?').get(id) as { project_id?: string; data: string } | undefined;
      if (!row) return null;
      const parsed = JSON.parse(row.data);
      if (row.project_id && !parsed.projectId) {
        parsed.projectId = row.project_id;
      }
      return parsed;
    },
    upsert(req: RequirementItem & { projectId?: string }): void {
      // Resolve project strictly from requirement or parent document, fail-closed without blind PRJ-01 fallback (R3-07)
      let projId = req.projectId;
      if (!projId && req.sourceReferences?.[0]?.documentId) {
        const docRow = db.prepare('SELECT project_id FROM documents WHERE id = ?').get(req.sourceReferences[0].documentId) as any;
        if (docRow?.project_id) {
          projId = docRow.project_id;
        }
      }
      if (!projId) {
        const existing = db.prepare('SELECT project_id FROM requirements WHERE id = ?').get(req.id) as any;
        projId = existing?.project_id || null;
      }
      const reqWithProj = { ...req, projectId: projId || undefined };
      const stmt = db.prepare(`
        INSERT INTO requirements (id, project_id, type, priority, status, data, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          project_id = coalesce(excluded.project_id, requirements.project_id),
          type = excluded.type,
          priority = excluded.priority,
          status = excluded.status,
          data = excluded.data,
          updated_at = excluded.updated_at
      `);
      stmt.run(req.id, projId, req.type, req.priority, req.status, JSON.stringify(reqWithProj), req.updatedAt);
    },
    delete(id: string): boolean {
      const result = db.prepare('DELETE FROM requirements WHERE id = ?').run(id);
      return result.changes > 0;
    }
  },

  users: {
    getByUsername(username: string): { id: string; username: string; passwordHash: string; passwordSalt: string; name: string; role: string; mustChangePassword?: number; passwordChangedAt?: number; tokenVersion?: number; createdAt: string } | null {
      const row = db.prepare(`
        SELECT id, username, password_hash as passwordHash, password_salt as passwordSalt,
               name, role, coalesce(must_change_password, 0) as mustChangePassword,
               coalesce(password_changed_at, 0) as passwordChangedAt,
               coalesce(token_version, 1) as tokenVersion,
               created_at as createdAt
        FROM users WHERE username = ?
      `).get(username) as any;
      return row || null;
    },
    getById(id: string): { id: string; username: string; name: string; role: string; mustChangePassword?: number; passwordChangedAt?: number; tokenVersion?: number; createdAt: string } | null {
      const row = db.prepare(`
        SELECT id, username, name, role, coalesce(must_change_password, 0) as mustChangePassword,
               coalesce(password_changed_at, 0) as passwordChangedAt,
               coalesce(token_version, 1) as tokenVersion,
               created_at as createdAt
        FROM users WHERE id = ?
      `).get(id) as any;
      return row || null;
    },
    getAll(): Array<{ id: string; username: string; name: string; role: string; mustChangePassword?: number; createdAt: string }> {
      return db.prepare(`
        SELECT id, username, name, role, coalesce(must_change_password, 0) as mustChangePassword, created_at as createdAt
        FROM users ORDER BY created_at ASC
      `).all() as any;
    },
    create(user: { id: string; username: string; passwordHash: string; passwordSalt: string; name: string; role: string; mustChangePassword?: number }): void {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO users (id, username, password_hash, password_salt, name, role, must_change_password, password_changed_at, token_version, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?)
      `).run(user.id, user.username, user.passwordHash, user.passwordSalt, user.name, user.role, user.mustChangePassword ?? 1, now);
    },
    updatePassword(userId: string, newHash: string, newSalt: string): boolean {
      const nowSec = Math.floor(Date.now() / 1000);
      const res = db.prepare(`
        UPDATE users
        SET password_hash = ?, password_salt = ?, must_change_password = 0,
            password_changed_at = ?, token_version = coalesce(token_version, 1) + 1
        WHERE id = ?
      `).run(newHash, newSalt, nowSec, userId);
      return res.changes > 0;
    },
    delete(id: string): boolean {
      const res = db.prepare('DELETE FROM users WHERE id = ?').run(id);
      return res.changes > 0;
    }
  },

  projectMembers: {
    getProjectsForUser(userId: string): string[] {
      const rows = db.prepare('SELECT project_id FROM project_members WHERE user_id = ?').all(userId) as { project_id: string }[];
      return rows.map(r => r.project_id);
    },
    getRole(projectId: string, userId: string): string | null {
      const row = db.prepare(`
        SELECT role FROM project_members WHERE project_id = ? AND user_id = ?
      `).get(projectId, userId) as { role: string } | undefined;
      return row?.role || null;
    },
    listByProject(projectId: string): Array<{ userId: string; name: string; role: string }> {
      return db.prepare(`
        SELECT u.id as userId, u.name, pm.role
        FROM project_members pm
        JOIN users u ON u.id = pm.user_id
        WHERE pm.project_id = ?
      `).all(projectId) as any;
    },
    addMember(projectId: string, userId: string, role: string): void {
      const now = new Date().toISOString();
      const id = `pm_${projectId}_${userId}`;
      db.prepare(`
        INSERT INTO project_members (id, project_id, user_id, role, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role
      `).run(id, projectId, userId, role, now);
    },
    removeMember(projectId: string, userId: string): boolean {
      const res = db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(projectId, userId);
      return res.changes > 0;
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
      const projId = (evd as any).projectId || (evd as any).project_id || 'PRJ-01';
      const evdWithProj = { ...evd, projectId: projId };
      const stmt = db.prepare(`
        INSERT INTO evidence (id, project_id, type, environment, status, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          project_id = excluded.project_id,
          type = excluded.type,
          environment = excluded.environment,
          status = excluded.status,
          data = excluded.data
      `);
      stmt.run(evd.id, projId, evd.type, evd.environment, evd.status, JSON.stringify(evdWithProj), evd.createdAt);
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
      const projId = (tc as any).projectId || (tc as any).project_id || 'PRJ-01';
      const tcWithProj = { ...tc, projectId: projId };
      const stmt = db.prepare(`
        INSERT INTO test_cases (id, project_id, requirement_id, status, type, priority, data, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          project_id = excluded.project_id,
          requirement_id = excluded.requirement_id,
          status = excluded.status,
          type = excluded.type,
          priority = excluded.priority,
          data = excluded.data,
          updated_at = excluded.updated_at
      `);
      stmt.run(tc.id, projId, tc.requirementId, tc.status, tc.type, tc.priority, JSON.stringify(tcWithProj), tc.updatedAt);
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
      const projId = (tr as any).projectId || (tr as any).project_id || 'PRJ-01';
      const trWithProj = { ...tr, projectId: projId };
      const stmt = db.prepare(`
        INSERT INTO test_runs (id, project_id, status, environment, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          project_id = excluded.project_id,
          status = excluded.status,
          environment = excluded.environment,
          data = excluded.data
      `);
      stmt.run(tr.id, projId, tr.status, tr.environment, JSON.stringify(trWithProj), tr.createdAt);
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
      const projId = (bug as any).projectId || (bug as any).project_id || 'PRJ-01';
      const bugWithProj = { ...bug, projectId: projId };
      const stmt = db.prepare(`
        INSERT INTO bugs (id, project_id, status, severity, priority, data, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          project_id = excluded.project_id,
          status = excluded.status,
          severity = excluded.severity,
          priority = excluded.priority,
          data = excluded.data,
          updated_at = excluded.updated_at
      `);
      stmt.run(bug.id, projId, bug.status, bug.severity, bug.priority, JSON.stringify(bugWithProj), bug.updatedAt);
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
  },

  modelEfforts: {
    /**
     * Reads saved effort setting for a specific model under a provider
     */
    get(provider: string, modelId: string): { effortLevel: string; maxOutputTokens: number; resolvedVariant?: string; updatedAt?: string } | null {
      const row = db.prepare(`
        SELECT effort_level, max_output_tokens, resolved_variant, updated_at
        FROM ai_model_efforts
        WHERE provider = ? AND model_id = ?
      `).get(provider, modelId) as any;
      if (!row) return null;
      return {
        effortLevel: row.effort_level,
        maxOutputTokens: row.max_output_tokens,
        resolvedVariant: row.resolved_variant || undefined,
        updatedAt: row.updated_at
      };
    },

    /**
     * Reads all per-model effort settings for a provider
     */
    getAll(provider: string): Record<string, { effortLevel: string; maxOutputTokens: number; resolvedVariant?: string; updatedAt: string }> {
      const rows = db.prepare(`
        SELECT model_id, effort_level, max_output_tokens, resolved_variant, updated_at
        FROM ai_model_efforts
        WHERE provider = ?
      `).all(provider) as any[];
      const map: Record<string, any> = {};
      for (const r of rows) {
        map[r.model_id] = {
          effortLevel: r.effort_level,
          maxOutputTokens: r.max_output_tokens,
          resolvedVariant: r.resolved_variant || undefined,
          updatedAt: r.updated_at
        };
      }
      return map;
    },

    /**
     * Saves per-model effort setting atomically in SQLite
     */
    save(provider: string, modelId: string, effortLevel: string, maxOutputTokens = 32768, resolvedVariant?: string) {
      const now = new Date().toISOString();
      const stmt = db.prepare(`
        INSERT INTO ai_model_efforts (provider, model_id, effort_level, max_output_tokens, resolved_variant, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(provider, model_id) DO UPDATE SET
          effort_level = excluded.effort_level,
          max_output_tokens = excluded.max_output_tokens,
          resolved_variant = excluded.resolved_variant,
          updated_at = excluded.updated_at
      `);
      stmt.run(provider, modelId, effortLevel, maxOutputTokens, resolvedVariant ?? null, now);
      return { provider, modelId, effortLevel, maxOutputTokens, resolvedVariant, updatedAt: now };
    }
  }
};
