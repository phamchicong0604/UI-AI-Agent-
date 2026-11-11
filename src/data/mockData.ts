import { 
  Project, 
  DocumentItem, 
  RequirementItem, 
  EvidenceItem, 
  TestCaseItem, 
  TestRunItem, 
  BugItem, 
  AuditEvent, 
  ClarificationQuestion 
} from '../types';
import { syncSha256 } from '../common/utils/hash';

export const initialProjects: Project[] = [
  {
    id: 'PRJ-01',
    name: 'AI-Ready QA Platform MVP',
    key: 'DOCQA',
    description: 'Centralized workspace for Project Documentation, Traceability, Evidence and QA Lifecycle.',
    version: 'v0.1.0-mvp',
    author: 'Alex Nguyen (Lead Architect)',
    membersCount: 8,
    createdAt: '2026-11-01'
  },
  {
    id: 'PRJ-02',
    name: 'Fintech Core Banking & Payments',
    key: 'FCB',
    description: 'High-security microservices platform for inter-bank clearing and biometric transfers.',
    version: 'v2.4.1',
    author: 'Minh Tran (PM)',
    membersCount: 14,
    createdAt: '2026-09-15'
  }
];

// Demo documents for offline use. Their text is kept apart from the document records, as on the server (E11-T1).
const demoDocuments: Array<DocumentItem & { demoContent?: string }> = [
  {
    id: 'DOC-01',
    projectId: 'PRJ-01',
    title: 'Project Charter & Stakeholder Matrix',
    category: '01_Project_Overview',
    currentVersion: 'v1.0',
    status: 'Approved',
    author: 'Minh Tran (PM)',
    updatedAt: '2026-11-01 10:30',
    description: 'Executive summary, target milestones, sponsor sign-off, and organizational responsibility matrix.',
    demoContent: `# Project Charter & Stakeholder Governance Matrix

> **Dự án**: AI-Ready QA Platform MVP (v0.1.0-mvp)  
> **Tác giả**: Minh Tran (PM) | **Trạng thái**: Đã phê duyệt (Approved) | **Mã băm**: SHA-256 Verified

---

## 1. Tuyên bố Mục tiêu Dự án (Executive Summary)
Nền tảng **DocQA** được xây dựng nhằm giải quyết bài toán cốt lõi trong quy trình phát triển phần mềm:
- **Tập trung hóa tài liệu đặc tả**: Lưu trữ tài liệu nguồn (BRD, SRS, UI/UX, API specs) theo cấu trúc chuẩn 8 thư mục.
- **Tính toàn vẹn không thể giả mạo**: Mỗi phiên bản tài liệu được gán mã băm mật mã học **SHA-256** và ghi vết chuỗi khối kiểm toán (Audit Trail Chain).
- **Truy vết 100% hai chiều (Bi-directional Traceability)**: Kết nối chặt chẽ từ Tài liệu nguồn → Yêu cầu nghiệp vụ → Ca kiểm thử → Lần chạy thử nghiệm → Bằng chứng EVD → Lỗi Defect.

## 2. Ma trận Trách nhiệm & Các Bên liên quan (RACI Matrix)

| Vai trò (Role) | Đại diện chính | Trách nhiệm trong hệ thống | Quyền hạn phê duyệt |
| :--- | :--- | :--- | :--- |
| **Project Admin** | Alex Nguyen | Quản trị dự án, cấu hình hệ thống, AI Engine | Toàn quyền (Full Access) |
| **PM / Project Lead** | Minh Tran | Quản lý tiến độ, phê duyệt Charter & Baseline | Phê duyệt Tài liệu & Test Plan |
| **Lead BA** | Sarah Le | Soạn thảo BRD, SRS, phân tách Acceptance Criteria | Tạo & Chỉnh sửa Yêu cầu |
| **Tech Lead / DEV** | Khoa Dang | Thiết kế Kiến trúc, OpenAPI, sửa lỗi Defect | Tạo & cập nhật Bug |
| **QA Lead** | Duc Pham | Thiết kế Test Matrix, thực thi Run, xác thực EVD | Phê duyệt Test Case, Chạy Test |
| **Approver** | Hội đồng nghiệm thu | Rà soát và đóng dấu Baseline chính thức | Phê duyệt trạng thái Approved |

## 3. Các Nguyên tắc Nghiệp vụ Bắt buộc (Governance Rules)
1. **Quy tắc BR-AUTH-01**: Chỉ người dùng có vai trò \`Project Admin\`, \`PM\`, hoặc \`Reviewer / Approver\` mới có quyền phê duyệt trạng thái \`Approved\` cho tài liệu.
2. **Quy tắc BR-AUTH-02**: Tài liệu ở trạng thái \`Draft\` hoặc \`In Review\` **tuyệt đối không được sử dụng** làm căn cứ chính thức để nghiệm thu tính năng hoặc sinh mã tự động.
3. **Quy tắc BR-EVD-01**: Mọi kết quả kiểm thử thất bại (\`Fail\`) hoặc bị chặn (\`Blocked\`) bắt buộc phải đính kèm tối thiểu 01 bằng chứng \`EVD\` hợp lệ trước khi lưu trữ.
`,
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
        checksum: `sha256:${syncSha256('DOC-01|v1.0|Project Charter & Stakeholder Matrix|2026-11-01')}`
      }
    ]
  },
  {
    id: 'DOC-02',
    projectId: 'PRJ-01',
    title: 'Business Requirements Document (BRD) - Authentication & RBAC',
    category: '02_Business_Requirements',
    currentVersion: 'v1.2',
    status: 'Approved',
    author: 'Sarah Le (Lead BA)',
    updatedAt: '2026-11-02 09:15',
    description: 'Comprehensive business rules for role privileges (Admin, PM, BA, DEV, QA, Approver) and security requirements.',
    demoContent: `# Business Requirements Document (BRD) - Authentication & RBAC

> **Phân hệ**: Xác thực danh tính & Phân quyền kiểm thử (Auth & RBAC)  
> **Phiên bản**: v1.2 (Approved) | **Tác giả**: Sarah Le (Lead BA)

---

## 1. Bối cảnh & Phạm vi (Context & Scope)
Tài liệu này xác định các yêu cầu nghiệp vụ bắt buộc đối với việc kiểm soát quyền truy cập theo vai trò (Role-Based Access Control) và các cổng phê duyệt chất lượng (Quality Approval Gates) trong nền tảng DocQA.

## 2. Đặc tả Vai trò & Ma trận Phân quyền (RBAC Specification)

### 2.1. Danh sách Vai trò Hệ thống
- **QA**: Thiết kế ca kiểm thử, ghi nhận kết quả thực thi kiểm thử và đăng ký bằng chứng EVD.
- **BA (Business Analyst)**: Tạo và chỉnh sửa yêu cầu (Requirements), định nghĩa Acceptance Criteria (AC) và Business Rules.
- **Tech Lead / DEV**: Thiết kế kỹ thuật, sửa mã nguồn, cập nhật trạng thái lỗi Defect.
- **PM / Project Lead**: Quản lý kế hoạch phát hành, theo dõi tiến độ tổng thể và ma trận truy vết.
- **Reviewer / Approver**: Người có thẩm quyền phê duyệt các mốc Baseline tài liệu và yêu cầu.
- **Project Admin**: Quản trị tài khoản, kết nối AI Engine và cấu hình hệ thống.

### 2.2. Bảng Phân quyền Thao tác (Permission Matrix)

| Chức năng | QA | BA | DEV | PM | Approver | Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Đọc tài liệu dự án | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tạo / Tải lên tài liệu (.md, .zip) | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Phê duyệt tài liệu (Approved) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Tạo Yêu cầu (Requirements) | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ |
| Tạo Ca kiểm thử (Test Cases) | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Thực thi Chạy thử & Ghi nhận EVD | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Chuyển trạng thái Lỗi Defect | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |

## 3. Điều kiện Nghiệm thu Nghiệp vụ (Acceptance Criteria)
- [x] **AC-01**: Khi người dùng không có vai trò Approver nhấn nút Phê duyệt, hệ thống từ chối với thông báo lỗi 403 Forbidden.
- [x] **AC-02**: Mọi thay đổi trạng thái tài liệu hoặc yêu cầu phải tự động ghi nhận vào chuỗi nhật ký kiểm toán (Audit Trail) với hàm băm SHA-256 nối chuỗi.
- [x] **AC-03**: Hệ thống phải hỗ trợ chuyển đổi vai trò nhanh trên Header để kiểm thử phân quyền ngay lập tức trong môi trường thử nghiệm.
`,
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
        checksum: `sha256:${syncSha256('DOC-02|v1.2|BRD Authentication & RBAC|2026-11-02')}`
      },
      {
        version: 'v1.1',
        updatedAt: '2026-10-28 14:00',
        author: 'Sarah Le',
        status: 'Deprecated',
        changeSummary: 'Clarified Approver vs Reviewer responsibilities.',
        fileSize: '2.3 MB',
        checksum: `sha256:${syncSha256('DOC-02|v1.1|BRD Authentication & RBAC|2026-10-28')}`
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
    demoContent: `# Software Requirements Specification (SRS) - Evidence Lifecycle

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

## 3. Quy định Bảo mật & Riêng tư (Data Privacy Rules)
- Nghiêm cấm lưu trữ trực tiếp \`Bearer Token\`, \`API Key\`, mật khẩu hoặc thông tin thẻ thanh toán trong tệp bằng chứng.
- Dữ liệu nhạy cảm phải được che mờ (masking) trước khi tải lên hệ thống.
`,
    tags: ['SRS', 'EVD', 'Storage'],
    linkedRequirementsCount: 2,
    versions: [
      {
        version: 'v1.1',
        updatedAt: '2026-11-02 11:45',
        author: 'Sarah Le',
        status: 'In Review',
        changeSummary: 'Added metadata schema: environment, build version, verifiedBy, purpose.',
        fileSize: '1.8 MB',
        checksum: `sha256:${syncSha256('DOC-03|v1.1|SRS Evidence Lifecycle|2026-11-02')}`
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
    author: 'Elena Vo (Lead UI/UX)',
    updatedAt: '2026-11-01 16:20',
    description: 'High-fidelity wireframes including the specialized 3-column test case workspace and responsive drawer navigation.',
    demoContent: `# Figma Design System & 3-Column QA Workspace Wireframes

> **Thiết kế**: UI/UX Specification v2.0 (Approved)  
> **Tác giả**: Elena Vo (Lead UI/UX) | **Công cụ nguồn**: Figma Workspace

---

## 1. Kiến trúc Bố cục Giao diện (Workspace Architecture)
Giao diện DocQA được chuẩn hóa theo tỷ lệ tối ưu cho kỹ sư kiểm thử phần mềm:
- **Header cố định**: Tích hợp bộ chọn Dự án, Thanh tìm kiếm toàn cục, Nút chuyển vai trò RBAC và Trạng thái đồng bộ Backend 5001.
- **Sidebar điều hướng**: Trực quan với 9 phân hệ chức năng (Dashboard, Kho tài liệu, Quản lý Yêu cầu, Bằng chứng, Ca kiểm thử, Đợt chạy, Theo dõi Lỗi, Ma trận Truy vết, Cấu hình).
- **Workspace 3 cột (3-Column QA Authoring Layout)**:
  - Cột 1: Danh sách ca kiểm thử lọc theo Trạng thái / Mức độ ưu tiên.
  - Cột 2: Bảng soạn thảo các bước thực thi (Action & Expected Result).
  - Cột 3: Drawer bằng chứng thực thi EVD và lịch sử bình luận rà soát.

## 2. Bảng Màu Thương hiệu & Token (Design Tokens)
- **Primary Indigo**: \`#4f46e5\` (indigo-600) dùng cho hành động chính và tiêu đề.
- **Surface Dark**: \`#0f172a\` (slate-900) kết hợp \`#020617\` (slate-950) tạo chiều sâu tương phản cao.
- **Status Green**: \`#10b981\` (emerald-500) dành cho trạng thái \`Approved\`, \`Pass\`, \`Healthy\`.
- **Status Amber**: \`#f59e0b\` (amber-500) dành cho \`In Review\`, \`Gaps\`.
`,
    tags: ['UI', 'Wireframes', 'Workspace'],
    linkedRequirementsCount: 1,
    versions: [
      {
        version: 'v2.0',
        updatedAt: '2026-11-01 16:20',
        author: 'Elena Vo',
        status: 'Approved',
        changeSummary: 'Approved 3-column test authoring view and status chip designs.',
        fileSize: '14.5 MB',
        checksum: `sha256:${syncSha256('DOC-04|v2.0|Figma UI Specs 3-Column|2026-11-01')}`
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
    description: 'OpenAPI 3.1 definitions for Documents, Requirements, Test Runs, Evidence uploads and Traceability queries.',
    demoContent: `# REST API & Traceability Schema Specifications

> **Giao thức**: REST API v1.0 (OpenAPI 3.1)  
> **Công nghệ**: Express.js, TypeScript, Better-SQLite3, Multer, Adm-Zip

---

## 1. Danh sách Endpoints Chính (Core API Endpoints)

| Method | Endpoint | Mục đích |
| :--- | :--- | :--- |
| \`GET\` | \`/api/v1/projects\` | Lấy danh sách toàn bộ dự án |
| \`POST\` | \`/api/v1/projects\` | Đăng ký dự án mới |
| \`GET\` | \`/api/v1/documents?projectId=:id\` | Lấy danh sách tài liệu theo dự án |
| \`POST\` | \`/api/v1/documents/upload\` | Tải lên tài liệu (.md, .zip, .txt) |
| \`DELETE\` | \`/api/v1/documents/:id\` | Xóa tài liệu khỏi cơ sở dữ liệu |
| \`PATCH\` | \`/api/v1/documents/:id/status\` | Phê duyệt chuyển đổi trạng thái tài liệu |

## 2. Tiêu chuẩn Mã băm Toàn vẹn (Integrity Standards)
Mọi bản ghi tài liệu khi lưu vào SQLite đều phải tính toán mã SHA-256 Checksum:
\`\`\`ts
const checksum = 'sha256:' + crypto.createHash('sha256').update(content).digest('hex');
\`\`\`
`,
    tags: ['API', 'OpenAPI', 'Backend'],
    linkedRequirementsCount: 2,
    versions: [
      {
        version: 'v1.0',
        updatedAt: '2026-10-30 18:00',
        author: 'Khoa Dang',
        status: 'Approved',
        changeSummary: 'Baseline API specification for Core MVP.',
        fileSize: '950 KB',
        checksum: `sha256:${syncSha256('DOC-05|v1.0|OpenAPI Spec Traceability|2026-10-30')}`
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
    updatedAt: '2026-11-02 08:30',
    description: 'Quality criteria, pass rate gates (min 95% pass rate), blocking criteria, and regression test matrix.',
    demoContent: `# Master Test Strategy & Acceptance Plan

> **Chiến lược**: QA Governance & Test Lifecycle Matrix v1.3 (Approved)  
> **Tác giả**: Duc Pham (QA Lead)

---

## 1. Mục tiêu Chiến lược Kiểm thử (Quality Objectives)
1. **Đảm bảo độ bao phủ**: Tỷ lệ yêu cầu có ca kiểm thử đạt **100%** trước khi đóng Sprint.
2. **Cổng chất lượng phát hành (Release Gate)**: Tỷ lệ thực thi đạt tối thiểu **95% Pass Rate** trong đợt chạy Regression cuối cùng.
3. **Chính sách Bằng chứng bắt buộc**: Bất kỳ ca kiểm thử nào có kết quả \`Fail\` hoặc \`Blocked\` bắt buộc phải đính kèm tối thiểu 01 bằng chứng \`EVD\` hợp lệ (ảnh chụp màn hình lỗi hoặc log HTTP).
`,
    tags: ['QA', 'TestPlan', 'Acceptance'],
    linkedRequirementsCount: 3,
    versions: [
      {
        version: 'v1.3',
        updatedAt: '2026-11-02 08:30',
        author: 'Duc Pham',
        status: 'Approved',
        changeSummary: 'Integrated mandatory EVD attachment policy for all Fail/Blocked executions.',
        fileSize: '3.1 MB',
        checksum: `sha256:${syncSha256('DOC-06|v1.3|QA Master Strategy|2026-11-02')}`
      }
    ]
  },
  {
    id: 'DOC-07',
    projectId: 'PRJ-02',
    title: 'Evidence Retention & Data Privacy Guide',
    category: '07_EVD_Evidence',
    currentVersion: 'v1.0',
    status: 'Approved',
    author: 'Khoa Dang (Tech Lead)',
    updatedAt: '2026-10-25 15:10',
    description: 'Security policies prohibiting raw secrets/bearer tokens in evidence, masking guidelines, and AWS S3 encryption.',
    demoContent: `# Evidence Retention & Data Privacy Guide

> **Phân loại**: Bảo mật & Tuân thủ Dữ liệu EVD  
> **Tác giả**: Khoa Dang (Tech Lead) | **Dự án**: Fintech Core Banking & Payments (FCB)

---

## 1. Nguyên tắc Bảo mật Bằng chứng (Security Principles)
1. **Che mờ dữ liệu (Data Masking)**: Tất cả mã PIN, CVV, OTP, khóa cá nhân phải được thay thế bằng ký tự \`***\` trước khi chụp ảnh màn hình hoặc lưu file log.
2. **Mã hóa Lưu trữ**: Tệp đính kèm được mã hóa AES-256 trên bộ lưu trữ đám mây.
3. **Mã băm toàn vẹn**: Bắt buộc tính toán SHA-256 Checksum ngay tại thời điểm đăng ký.
`,
    tags: ['Security', 'Compliance', 'Evidence'],
    linkedRequirementsCount: 1,
    versions: [
      {
        version: 'v1.0',
        updatedAt: '2026-10-25 15:10',
        author: 'Khoa Dang',
        status: 'Approved',
        changeSummary: 'Initial policy sign-off.',
        fileSize: '820 KB',
        checksum: `sha256:${syncSha256('DOC-07|v1.0|Evidence Security Guide|2026-10-25')}`
      }
    ]
  },
  {
    id: 'DOC-08',
    projectId: 'PRJ-02',
    title: 'Release Notes & Change Decision Log v0.1',
    category: '08_Change_History',
    currentVersion: 'v0.1',
    status: 'Draft',
    author: 'Minh Tran (PM)',
    updatedAt: '2026-11-02 14:00',
    description: 'Sprint changelog, architectural decisions regarding AI readiness and modular schema.',
    demoContent: `# Release Notes & Change Decision Log v0.1

> **Ghi chú Phát hành**: Sprint 1 Milestone Baseline  
> **Tác giả**: Minh Tran (PM) | **Trạng thái**: Draft

---

## 1. Các Tính năng Đã Hoàn thành (Delivered Features)
- [x] Quản trị tài liệu phân cấp chuẩn 8 thư mục.
- [x] Bộ lọc tài liệu gắn chặt theo từng Không gian Dự án riêng biệt.
- [x] Tải lên tài liệu hàng loạt qua file \`.md\` và \`.zip\` tự động giải nén & phân loại.
- [x] Chế độ Đọc tài liệu dự án trực quan (Project Document Reader Workspace).
- [x] Ký chữ ký số mật mã học SHA-256 cho từng phiên bản.
`,
    tags: ['ReleaseNotes', 'Decisions'],
    linkedRequirementsCount: 0,
    versions: [
      {
        version: 'v0.1',
        updatedAt: '2026-11-02 14:00',
        author: 'Minh Tran',
        status: 'Draft',
        changeSummary: 'Drafted Sprint 1 release scope.',
        fileSize: '400 KB',
        checksum: `sha256:${syncSha256('DOC-08|v0.1|Release Notes v0.1|2026-11-02')}`
      }
    ]
  }
];

export const initialDocuments: DocumentItem[] = demoDocuments.map(({ demoContent, ...doc }) => doc);

export const demoDocumentContents: Record<string, string> = Object.fromEntries(
  demoDocuments.filter(d => d.demoContent).map(d => [d.id, d.demoContent as string])
);

export const initialRequirements: RequirementItem[] = [
  {
    id: 'REQ-001',
    title: 'Role-Based Access Control and Strict Approval Gates',
    description: 'The platform must enforce strict RBAC permissions across Project Admin, PM, BA, Tech Lead, QA, and Approver. Unapproved items must never be treated as authoritative sources.',
    type: 'Functional',
    priority: 'Critical',
    businessRules: [
      'BR-AUTH-01: Only users with Reviewer/Approver or Project Admin role can transition items to Approved status.',
      'BR-AUTH-02: Items in Draft or In Review must display clear unconfirmed warning flags.',
      'BR-AUTH-03: Any edit to an Approved item automatically triggers an audit log and creates a new pending version.'
    ],
    acceptanceCriteria: [
      { id: 'AC-01', text: 'System restricts status change to Approved to authorized roles.', completed: true },
      { id: 'AC-02', text: 'Traceability view flags unapproved source dependencies.', completed: true },
      { id: 'AC-03', text: 'Audit event is logged with actor, timestamp, and previous state.', completed: true }
    ],
    sourceReferences: [
      {
        documentId: 'DOC-02',
        documentTitle: 'BRD - Authentication & RBAC',
        version: 'v1.2',
        section: 'Section 4.1 - Permission Matrix'
      }
    ],
    status: 'Approved',
    owner: 'Sarah Le (BA)',
    approver: 'Minh Tran (PM)',
    relatedUI: 'AppHeader / RoleSwitcher / SettingsView',
    relatedAPI: 'POST /api/v1/permissions/verify',
    createdAt: '2026-10-29',
    updatedAt: '2026-11-01 14:20'
  },
  {
    id: 'REQ-002',
    title: 'Multi-Entity Evidence (EVD) Management & Audit Trail',
    description: 'Support creation, metadata indexing, and flexible linking of EVD artifacts (Screenshots, Logs, Videos, API responses) across Requirements, Test Cases, Test Runs, and Bugs.',
    type: 'Functional',
    priority: 'High',
    businessRules: [
      'BR-EVD-01: One Evidence record can link to multiple artifacts with defined link purpose.',
      'BR-EVD-02: Evidence requires minimum metadata: Type, Environment, Build Version, and Description.',
      'BR-EVD-03: Evidence payload must not store sensitive passwords or unmasked auth tokens.'
    ],
    acceptanceCriteria: [
      { id: 'AC-01', text: 'Users can link evidence directly during Test Run execution.', completed: true },
      { id: 'AC-02', text: 'Evidence status lifecycle supports Draft -> Submitted -> Verified.', completed: true },
      { id: 'AC-03', text: 'Evidence preview renders screenshots and JSON payload viewer.', completed: false }
    ],
    sourceReferences: [
      {
        documentId: 'DOC-03',
        documentTitle: 'SRS - Evidence Lifecycle',
        version: 'v1.1',
        section: 'Section 3.2 - EVD Metadata'
      }
    ],
    status: 'In Review',
    owner: 'Duc Pham (QA Lead)',
    approver: 'Khoa Dang (Tech Lead)',
    relatedUI: 'EvidenceView / TestRunModal',
    relatedAPI: 'POST /api/v1/evidence/upload',
    createdAt: '2026-10-30',
    updatedAt: '2026-11-02 11:00'
  },
  {
    id: 'REQ-003',
    title: '3-Column Test Case Authoring Workspace with Traceability',
    description: 'Provide an integrated authoring workspace featuring: Left column (Source Requirements & ACs), Center column (Test Steps & Expected Results), Right column (Evidence, Source References & Review comments).',
    type: 'Functional',
    priority: 'Critical',
    businessRules: [
      'BR-TC-01: Every Test Case must cite at least one Requirement or Document source reference.',
      'BR-TC-02: Test Steps must clearly differentiate Action and Expected Result.',
      'BR-TC-03: Export functionality supports standardized Excel / CSV templates.'
    ],
    acceptanceCriteria: [
      { id: 'AC-01', text: 'Interactive 3-column layout displays synced Requirement details.', completed: true },
      { id: 'AC-02', text: 'Action bar supports Save Draft, Submit Review, Approve, Export.', completed: true },
      { id: 'AC-03', text: 'Reviewers can leave inline comments and approve directly in workspace.', completed: true }
    ],
    sourceReferences: [
      {
        documentId: 'DOC-04',
        documentTitle: 'Figma Design System & 3-Column QA Workspace',
        version: 'v2.0',
        section: 'Section 7.1 - Workspace Architecture'
      }
    ],
    status: 'Approved',
    owner: 'Duc Pham (QA Lead)',
    approver: 'Sarah Le (Lead BA)',
    relatedUI: 'TestCaseWorkspace.tsx',
    relatedAPI: 'GET /api/v1/testcases/:id/workspace',
    createdAt: '2026-10-31',
    updatedAt: '2026-11-02 10:15'
  },
  {
    id: 'REQ-004',
    title: 'Test Run Execution Console with Auto Bug Generation',
    description: 'Facilitate test suite execution by Build/Environment, record Pass/Fail/Blocked states, capture actual results with evidence, and generate pre-populated Bug reports directly upon failure.',
    type: 'Functional',
    priority: 'High',
    businessRules: [
      'BR-RUN-01: Failed runs must prompt user to attach Evidence and/or file linked Bug.',
      'BR-RUN-02: Prior execution logs are immutable; re-runs append new timestamped records.',
      'BR-RUN-03: Progress bar displays live Pass/Fail/Blocked percentages.'
    ],
    acceptanceCriteria: [
      { id: 'AC-01', text: 'Execution results update run completion metrics in real time.', completed: true },
      { id: 'AC-02', text: 'One-click "Log Bug" inherits Test Case title, steps, and active build.', completed: true }
    ],
    sourceReferences: [
      {
        documentId: 'DOC-06',
        documentTitle: 'Master Test Strategy & Acceptance Plan',
        version: 'v1.3',
        section: 'Section 5.4 - Execution & Defect Logging'
      }
    ],
    status: 'Approved',
    owner: 'Duc Pham (QA Lead)',
    approver: 'Minh Tran (PM)',
    relatedUI: 'TestRunsView.tsx',
    relatedAPI: 'POST /api/v1/testruns/:id/execute',
    createdAt: '2026-11-01',
    updatedAt: '2026-11-02 08:45'
  },
  {
    id: 'REQ-005',
    title: 'End-to-End Bidirectional Traceability Matrix & Gap Analysis',
    description: 'Deliver visual and tabular traceability connecting Source Document -> Requirement -> Test Case -> Test Run -> Evidence -> Bug. Uncovered requirements must be conspicuously highlighted.',
    type: 'Functional',
    priority: 'High',
    businessRules: [
      'BR-TRACE-01: Matrix must highlight Requirements lacking any linked Test Case (Coverage Gap).',
      'BR-TRACE-02: Trace links must allow direct navigation into respective entity inspectors.'
    ],
    acceptanceCriteria: [
      { id: 'AC-01', text: 'Graph and table views show complete lineage across all 5 tiers.', completed: true },
      { id: 'AC-02', text: 'Quick filter isolates requirements with 0% test coverage.', completed: true }
    ],
    sourceReferences: [
      {
        documentId: 'DOC-05',
        documentTitle: 'REST API & Traceability Schema Specifications',
        version: 'v1.0',
        section: 'Section 6 - Trace Graph Queries'
      }
    ],
    status: 'Approved',
    owner: 'Khoa Dang (Tech Lead)',
    approver: 'Minh Tran (PM)',
    relatedUI: 'TraceabilityView.tsx',
    relatedAPI: 'GET /api/v1/traceability/matrix',
    createdAt: '2026-11-01',
    updatedAt: '2026-11-02 09:30'
  },
  {
    id: 'REQ-006',
    title: 'AI Copilot Grounded Drafting & Change Impact Detection',
    description: 'AI-assisted generation of test cases and impact assessment when requirements change. AI outputs must cite sources, remain in Draft status, and require human sign-off.',
    type: 'Technical',
    priority: 'Medium',
    businessRules: [
      'BR-AI-01: AI outputs cannot be auto-approved; human approval is mandatory.',
      'BR-AI-02: AI proposals must explicitly cite grounded document version and section.'
    ],
    acceptanceCriteria: [
      { id: 'AC-01', text: 'AI modal generates drafted test cases tagged with citation.', completed: true },
      { id: 'AC-02', text: 'Impact detector highlights test cases impacted by document revisions.', completed: false }
    ],
    sourceReferences: [
      {
        documentId: 'DOC-08',
        documentTitle: 'Release Notes & Change Decision Log v0.1',
        version: 'v0.1',
        section: 'Section 8 - AI Readiness Principles'
      }
    ],
    status: 'Draft',
    owner: 'Khoa Dang (Tech Lead)',
    approver: 'Duc Pham (QA Lead)',
    relatedUI: 'AiAssistantModal.tsx',
    relatedAPI: 'POST /api/v1/ai/draft-testcases',
    createdAt: '2026-11-02',
    updatedAt: '2026-11-02 14:10'
  }
];

export const initialEvidences: EvidenceItem[] = [
  {
    id: 'EVD-001',
    title: 'Screenshot: 403 Forbidden Dialog on Non-Admin User',
    description: 'Capture showing unauthorized user attempting to approve REQ-001 without sufficient permissions.',
    type: 'Screenshot',
    environment: 'QA',
    buildVersion: 'build-1042',
    status: 'Verified',
    storageRef: 's3://docqa-evidence/qa/20261102/403_forbidden_gate.png',
    storageChecksum: `sha256:${syncSha256('s3://docqa-evidence/qa/20261102/403_forbidden_gate.png|482KB')}`,
    fileSize: '482 KB',
    previewUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80',
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
      },
      {
        targetType: 'TestCase',
        targetId: 'TC-AUTH-002',
        targetTitle: 'Reject Approval Attempt by Unauthorized Role',
        purpose: 'Evidence of positive test assertion'
      }
    ]
  },
  {
    id: 'EVD-002',
    title: 'Server Error Log: 504 Gateway Timeout during Batch Export',
    description: 'CloudWatch log dump showing timeout when exporting test cases with large image attachments.',
    type: 'Log',
    environment: 'STG',
    buildVersion: 'build-1039',
    status: 'Submitted',
    storageRef: 's3://docqa-evidence/stg/20261101/cloudwatch_export_timeout.log',
    storageChecksum: `sha256:${syncSha256('s3://docqa-evidence/stg/20261101/cloudwatch_export_timeout.log|1.4MB')}`,
    fileSize: '1.4 MB',
    logPayload: `2026-11-01T15:24:11.892Z [ERROR] ExportService: Timeout after 30000ms while generating XLSX
  at /app/node_modules/excel-stream/dist/index.js:142:19
  at async handleBatchExport (/app/src/services/export.service.ts:88:5)
  HTTP 504 Gateway Timeout for request ID: req_9948c21a`,
    createdBy: 'Thao Nguyen (QA)',
    createdAt: '2026-11-01 15:30',
    links: [
      {
        targetType: 'Bug',
        targetId: 'BUG-001',
        targetTitle: '504 Timeout on Large Matrix Export',
        purpose: 'Stack trace reproduction proof'
      },
      {
        targetType: 'TestRun',
        targetId: 'RUN-2026-11-01',
        targetTitle: 'Sprint 24 Staging Regression',
        purpose: 'Failed execution artifact'
      }
    ]
  },
  {
    id: 'EVD-003',
    title: 'JSON API Response: RBAC Security Handshake 200 OK',
    description: 'Verified payload from auth gateway confirming permission scopes for QA and BA personas.',
    type: 'API Response',
    environment: 'DEV',
    buildVersion: 'build-1045',
    status: 'Verified',
    storageRef: 's3://docqa-evidence/dev/20261102/auth_handshake.json',
    storageChecksum: `sha256:${syncSha256('s3://docqa-evidence/dev/20261102/auth_handshake.json|4.2KB')}`,
    fileSize: '4.2 KB',
    logPayload: `{\n  "status": "success",\n  "userId": "usr_9918",\n  "role": "QA",\n  "permissions": [\n    "read:documents",\n    "write:testcases",\n    "execute:testruns",\n    "upload:evidence"\n  ],\n  "restricted": [\n    "approve:production_artifacts"\n  ]\n}`,
    createdBy: 'Khoa Dang (Tech Lead)',
    createdAt: '2026-11-02 08:15',
    verifiedBy: 'Minh Tran (PM)',
    verifiedAt: '2026-11-02 08:45',
    links: [
      {
        targetType: 'Requirement',
        targetId: 'REQ-001',
        targetTitle: 'Role-Based Access Control',
        purpose: 'Conformance test data validation'
      }
    ]
  },
  {
    id: 'EVD-004',
    title: 'Approval Record: Sign-Off Sheet for v1.0 Baseline',
    description: 'Signed PDF document confirming QA Lead and PM signoff for MVP phase 1 testing.',
    type: 'Approval Record',
    environment: 'PROD',
    buildVersion: 'release-0.1.0',
    status: 'Verified',
    storageRef: 's3://docqa-evidence/compliance/20261101/signoff_p1.pdf',
    storageChecksum: `sha256:${syncSha256('s3://docqa-evidence/compliance/20261101/signoff_p1.pdf|320KB')}`,
    fileSize: '320 KB',
    createdBy: 'Minh Tran (PM)',
    createdAt: '2026-11-01 17:00',
    verifiedBy: 'Alex Nguyen (Lead Architect)',
    verifiedAt: '2026-11-01 17:30',
    links: [
      {
        targetType: 'Document',
        targetId: 'DOC-01',
        targetTitle: 'Project Charter & Stakeholder Matrix',
        purpose: 'Formal governance evidence'
      }
    ]
  }
];

export const initialTestCases: TestCaseItem[] = [
  {
    id: 'TC-AUTH-001',
    requirementId: 'REQ-001',
    requirementTitle: 'Role-Based Access Control and Strict Approval Gates',
    title: 'Verify Approved Status Transition by Authorized Approver',
    scenario: 'Ensure that a user with "Reviewer / Approver" role can successfully transition a Requirement from "In Review" to "Approved".',
    preconditions: '1. User is logged in with Approver persona.\n2. Requirement REQ-001 is currently in "In Review" status.',
    testData: 'Requirement ID: REQ-001, Decision: Approved, Comment: "All criteria met."',
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
      {
        stepNumber: 1,
        action: 'Navigate to Requirements view and select REQ-001.',
        expectedResult: 'Requirement details drawer opens showing "In Review" badge.'
      },
      {
        stepNumber: 2,
        action: 'Click "Approve" button in the action toolbar.',
        expectedResult: 'Approval confirmation modal displays asking for optional sign-off remarks.'
      },
      {
        stepNumber: 3,
        action: 'Enter remarks and submit approval.',
        expectedResult: 'Status updates immediately to "Approved"; Audit log records timestamp and Approver ID.'
      }
    ],
    reviewComments: [
      {
        id: 'RC-01',
        author: 'Sarah Le',
        role: 'BA',
        content: 'Steps look accurate and match BRD v1.2 specifications.',
        createdAt: '2026-11-01 11:20',
        decision: 'Approved'
      }
    ],
    relatedEvidenceIds: ['EVD-003'],
    createdAt: '2026-11-01',
    updatedAt: '2026-11-02 09:00'
  },
  {
    id: 'TC-AUTH-002',
    requirementId: 'REQ-001',
    requirementTitle: 'Role-Based Access Control and Strict Approval Gates',
    title: 'Reject Approval Attempt by Unauthorized Role (QA/DEV)',
    scenario: 'Verify that non-approver roles receive a 403 Forbidden alert when attempting to trigger the approve API.',
    preconditions: 'User active session role is set to "QA" or "Tech Lead / DEV".',
    testData: 'User: Duc Pham (QA Role), Target: REQ-002',
    type: 'Security',
    priority: 'Critical',
    status: 'Ready for Execution',
    version: 'v1.0',
    sourceReferences: [
      {
        documentId: 'DOC-02',
        documentTitle: 'BRD - Authentication & RBAC',
        version: 'v1.2',
        section: 'Section 4.1 - Rule BR-AUTH-01'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        action: 'Switch active user role in header to "QA".',
        expectedResult: 'App header badge reflects "QA" role.'
      },
      {
        stepNumber: 2,
        action: 'Attempt to click the "Approve" button on a pending requirement.',
        expectedResult: 'Button is disabled or shows tooltip "Approver role required".'
      },
      {
        stepNumber: 3,
        action: 'Simulate direct POST request to /api/v1/requirements/approve.',
        expectedResult: 'System returns HTTP 403 with descriptive error message.'
      }
    ],
    reviewComments: [
      {
        id: 'RC-02',
        author: 'Khoa Dang',
        role: 'Tech Lead / DEV',
        content: 'Crucial security test case. Confirmed API gateway handles 403 properly.',
        createdAt: '2026-11-01 14:10',
        decision: 'Approved'
      }
    ],
    relatedEvidenceIds: ['EVD-001'],
    createdAt: '2026-11-01',
    updatedAt: '2026-11-02 09:30'
  },
  {
    id: 'TC-EVD-001',
    requirementId: 'REQ-002',
    requirementTitle: 'Multi-Entity Evidence (EVD) Management & Audit Trail',
    title: 'Attach Multi-format Evidence during Test Execution',
    scenario: 'Verify that a tester can upload both a Screenshot and Log output to a failed test step.',
    preconditions: 'Test Run RUN-2026-11-01 is opened in execution mode.',
    testData: 'Files: screenshot.png (480KB), execution.log (1.2MB)',
    type: 'Positive',
    priority: 'High',
    status: 'Ready for Execution',
    version: 'v1.0',
    sourceReferences: [
      {
        documentId: 'DOC-03',
        documentTitle: 'SRS - Evidence Lifecycle',
        version: 'v1.1',
        section: 'Section 3.2'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        action: 'Set Test Result to "Fail".',
        expectedResult: 'Fail status highlights in red and opens Evidence Attachment drawer.'
      },
      {
        stepNumber: 2,
        action: 'Upload screenshot and paste server log snippet.',
        expectedResult: 'Evidence metadata is created with ID, timestamp, and linked TestRun ID.'
      },
      {
        stepNumber: 3,
        action: 'Save execution record.',
        expectedResult: 'Test Run summary updates and links the two evidence records.'
      }
    ],
    reviewComments: [],
    relatedEvidenceIds: ['EVD-001', 'EVD-002'],
    createdAt: '2026-11-02',
    updatedAt: '2026-11-02 10:00'
  },
  {
    id: 'TC-WS-001',
    requirementId: 'REQ-003',
    requirementTitle: '3-Column Test Case Authoring Workspace with Traceability',
    title: 'Verify 3-Column Synchronized Layout and Source Reference Display',
    scenario: 'Check that opening a test case in Workspace mode displays source requirement, steps editor, and evidence/review panels side-by-side.',
    preconditions: 'Test case exists in repository.',
    testData: 'Test Case: TC-AUTH-001',
    type: 'Positive',
    priority: 'High',
    status: 'Ready for Execution',
    version: 'v1.0',
    sourceReferences: [
      {
        documentId: 'DOC-04',
        documentTitle: 'Figma Design System & 3-Column QA Workspace',
        version: 'v2.0',
        section: 'Section 7.1'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        action: 'Open Test Cases list and click "Workspace View".',
        expectedResult: 'Screen divides into 3 responsive columns: Specs, Steps, and References/Reviews.'
      },
      {
        stepNumber: 2,
        action: 'Select a step in the center column.',
        expectedResult: 'Step inputs (Action, Expected Result, Test Data) are editable.'
      },
      {
        stepNumber: 3,
        action: 'Click "Export to CSV" in the top action bar.',
        expectedResult: 'Browser initiates download of test-case-export.csv containing all columns.'
      }
    ],
    reviewComments: [],
    relatedEvidenceIds: [],
    createdAt: '2026-11-02',
    updatedAt: '2026-11-02 11:30'
  },
  {
    id: 'TC-AI-001',
    requirementId: 'REQ-006',
    requirementTitle: 'AI Copilot Grounded Drafting & Change Impact Detection',
    title: 'Ensure AI-Generated Test Cases Default to Draft Status with Mandatory Citation',
    scenario: 'Trigger AI Test Case Drafting from an Approved Requirement and confirm generated test cases never inherit Approved status automatically.',
    preconditions: 'AI Copilot is configured with grounded document context DOC-02.',
    testData: 'Prompt: "Draft boundary test cases for password length."',
    type: 'Positive',
    priority: 'Medium',
    status: 'Draft',
    version: 'v0.1',
    sourceReferences: [
      {
        documentId: 'DOC-08',
        documentTitle: 'Release Notes & Change Decision Log v0.1',
        version: 'v0.1',
        section: 'Section 8.1 - AI Grounded Output'
      }
    ],
    steps: [
      {
        stepNumber: 1,
        action: 'Open AI Assistant and choose "Draft Test Cases from Requirement".',
        expectedResult: 'Assistant generates proposed test scenarios citing exact BRD section.'
      },
      {
        stepNumber: 2,
        action: 'Click "Import to Repository as Draft".',
        expectedResult: 'Test case is saved with status = "Draft" and badge "AI Drafted - Pending Review".'
      }
    ],
    reviewComments: [],
    relatedEvidenceIds: [],
    createdAt: '2026-11-02',
    updatedAt: '2026-11-02 14:30',
    isAiDrafted: true
  }
];

export const initialTestRuns: TestRunItem[] = [
  {
    id: 'RUN-2026-11-01',
    title: 'Sprint 24 Staging Regression & Auth Verification',
    environment: 'STG',
    buildVersion: 'build-1039',
    scope: 'Smoke and regression coverage for Authentication, RBAC, and Evidence linking modules.',
    status: 'In Progress',
    createdBy: 'Duc Pham (QA Lead)',
    createdAt: '2026-11-01 14:00',
    records: [
      {
        testCaseId: 'TC-AUTH-001',
        testCaseTitle: 'Verify Approved Status Transition by Authorized Approver',
        status: 'Pass',
        actualResult: 'Approver successfully approved REQ-001; status updated immediately.',
        executedBy: 'Duc Pham',
        executedAt: '2026-11-01 14:45',
        evidenceIds: ['EVD-003']
      },
      {
        testCaseId: 'TC-AUTH-002',
        testCaseTitle: 'Reject Approval Attempt by Unauthorized Role (QA/DEV)',
        status: 'Pass',
        actualResult: '403 Forbidden alert received as expected. User could not change status.',
        executedBy: 'Thao Nguyen',
        executedAt: '2026-11-01 15:10',
        evidenceIds: ['EVD-001']
      },
      {
        testCaseId: 'TC-EVD-001',
        testCaseTitle: 'Attach Multi-format Evidence during Test Execution',
        status: 'Fail',
        actualResult: 'Export of attached evidence resulted in HTTP 504 timeout due to payload size.',
        executedBy: 'Thao Nguyen',
        executedAt: '2026-11-01 15:25',
        evidenceIds: ['EVD-002'],
        bugId: 'BUG-001'
      },
      {
        testCaseId: 'TC-WS-001',
        testCaseTitle: 'Verify 3-Column Synchronized Layout and Source Reference Display',
        status: 'Not Run',
        actualResult: 'Pending execution on next build.',
        evidenceIds: []
      }
    ]
  },
  {
    id: 'RUN-2026-11-02',
    title: 'Hotfix v1.4.3 Smoke Run - QA Environment',
    environment: 'QA',
    buildVersion: 'build-1045',
    scope: 'Rapid smoke test after deploying RBAC patch fix.',
    status: 'Completed',
    createdBy: 'Thao Nguyen (QA)',
    createdAt: '2026-11-02 09:00',
    records: [
      {
        testCaseId: 'TC-AUTH-001',
        testCaseTitle: 'Verify Approved Status Transition by Authorized Approver',
        status: 'Pass',
        actualResult: 'Confirmed operational in QA env.',
        executedBy: 'Thao Nguyen',
        executedAt: '2026-11-02 09:30',
        evidenceIds: ['EVD-003']
      },
      {
        testCaseId: 'TC-AUTH-002',
        testCaseTitle: 'Reject Approval Attempt by Unauthorized Role (QA/DEV)',
        status: 'Pass',
        actualResult: 'Verified security gate works cleanly.',
        executedBy: 'Thao Nguyen',
        executedAt: '2026-11-02 09:45',
        evidenceIds: ['EVD-001']
      }
    ]
  }
];

export const initialBugs: BugItem[] = [
  {
    id: 'BUG-001',
    title: 'HTTP 504 Gateway Timeout during XLSX Matrix Export with Evidence',
    description: 'When generating export files containing large screenshot or log payloads, the export service exceeds the 30-second gateway limit and fails.',
    severity: 'Major',
    priority: 'High',
    status: 'In Progress',
    assignee: 'Khoa Dang (Tech Lead)',
    environment: 'STG',
    buildVersion: 'build-1039',
    stepsToReproduce: [
      'Navigate to Traceability or Test Cases view.',
      'Filter for records with > 1MB attached evidence.',
      'Click "Export Full Matrix to Excel".',
      'Wait 30 seconds -> Observe 504 error popup.'
    ],
    expectedResult: 'Export streams asynchronously and provides download link or completes in under 5s.',
    actualResult: 'HTTP 504 Gateway Timeout after 30000ms. CloudWatch log attached.',
    linkedRequirementId: 'REQ-003',
    linkedTestCaseId: 'TC-EVD-001',
    linkedTestRunId: 'RUN-2026-11-01',
    linkedEvidenceIds: ['EVD-002'],
    createdAt: '2026-11-01 15:40',
    updatedAt: '2026-11-02 10:00'
  },
  {
    id: 'BUG-002',
    title: 'Unapproved Requirements appearing in Production Summary Export',
    description: 'A requirement with "In Review" status was inadvertently included in the certified client export report.',
    severity: 'Critical',
    priority: 'Critical',
    status: 'Open',
    assignee: 'Sarah Le (Lead BA)',
    environment: 'PROD',
    buildVersion: 'release-0.1.0',
    stepsToReproduce: [
      'Create requirement REQ-006 with Draft status.',
      'Generate Release Summary report.',
      'Check output section 4.'
    ],
    expectedResult: 'Only "Approved" items should appear in external release deliverables per rule BR-AUTH-02.',
    actualResult: 'Draft requirement REQ-006 is present without unconfirmed disclaimer.',
    linkedRequirementId: 'REQ-001',
    linkedEvidenceIds: ['EVD-004'],
    createdAt: '2026-11-02 11:15',
    updatedAt: '2026-11-02 11:15'
  }
];

// Chain-hashed audit events demonstrating cryptographic tamper-evidence
const hash0 = syncSha256('GENESIS_BLOCK_DOCQA_PLATFORM');
const hash1 = syncSha256(`${hash0}|AUD-001|Requirement|REQ-003|2026-10-31 10:15`);
const hash2 = syncSha256(`${hash1}|AUD-002|TestCase|TC-AUTH-001|2026-11-01 11:20`);
const hash3 = syncSha256(`${hash2}|AUD-003|TestRun|RUN-2026-11-01|2026-11-01 15:25`);
const hash4 = syncSha256(`${hash3}|AUD-004|Bug|BUG-001|2026-11-01 15:40`);
const hash5 = syncSha256(`${hash4}|AUD-005|Document|DOC-02|2026-11-02 09:15`);

export const initialAuditEvents: AuditEvent[] = [
  {
    id: 'AUD-005',
    user: 'Minh Tran',
    role: 'PM / Project Lead',
    action: 'Approved Document',
    entityType: 'Document',
    entityId: 'DOC-02',
    details: 'Approved BRD v1.2 as authoritative baseline with SHA-256 signature.',
    timestamp: '2026-11-02 09:15',
    eventHash: `sha256:${hash5}`,
    previousEventHash: `sha256:${hash4}`
  },
  {
    id: 'AUD-004',
    user: 'Thao Nguyen',
    role: 'QA',
    action: 'Logged Defect',
    entityType: 'Bug',
    entityId: 'BUG-001',
    details: 'Filed BUG-001 from failed execution of TC-EVD-001.',
    timestamp: '2026-11-01 15:40',
    eventHash: `sha256:${hash4}`,
    previousEventHash: `sha256:${hash3}`
  },
  {
    id: 'AUD-003',
    user: 'Thao Nguyen',
    role: 'QA',
    action: 'Executed Test Run',
    entityType: 'TestRun',
    entityId: 'RUN-2026-11-01',
    details: 'Logged Failure on TC-EVD-001 and attached CloudWatch log EVD-002 with SHA-256 integrity.',
    timestamp: '2026-11-01 15:25',
    eventHash: `sha256:${hash3}`,
    previousEventHash: `sha256:${hash2}`
  },
  {
    id: 'AUD-002',
    user: 'Duc Pham',
    role: 'QA',
    action: 'Approved Test Case',
    entityType: 'TestCase',
    entityId: 'TC-AUTH-001',
    details: 'Signed off on RBAC test steps against BRD v1.2.',
    timestamp: '2026-11-01 11:20',
    eventHash: `sha256:${hash2}`,
    previousEventHash: `sha256:${hash1}`
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
    eventHash: `sha256:${hash1}`,
    previousEventHash: `sha256:${hash0}`
  }
];

export const initialClarificationQuestions: ClarificationQuestion[] = [
  {
    id: 'CQ-01',
    question: 'How should Evidence (EVD) retention handle large video captures (>100MB)?',
    context: 'Direct database storage is prohibited per non-functional requirements. Is S3 presigned URL with 90-day lifecycle rule acceptable?',
    sourceDoc: 'DOC-07: Evidence Retention Guide',
    status: 'Open',
    askedBy: 'Duc Pham (QA Lead)',
    assignedTo: 'Khoa Dang (Tech Lead)',
    createdAt: '2026-11-01 16:00'
  },
  {
    id: 'CQ-02',
    question: 'Should an edit to an Approved Requirement immediately mark all linked Test Cases as "Needs Review"?',
    context: 'Proposal Section 6.5 states: "When source changes, flag linked items rather than silently updating expected results."',
    sourceDoc: 'DOC-02: BRD v1.2 Section 6.5',
    status: 'Open',
    askedBy: 'Sarah Le (Lead BA)',
    assignedTo: 'Minh Tran (PM)',
    createdAt: '2026-11-02 10:30'
  }
];
