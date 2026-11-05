import { DocumentItem, Project } from '../../types';

export function getDefaultDocumentMarkdown(
  doc: DocumentItem,
  project: Project,
  language: 'vi' | 'en'
): string {
  if (language === 'en') {
    return `# ${doc.title}

> **Project**: ${project.name} (${project.key})  
> **Document ID**: \`${doc.id}\` | **Version**: \`${doc.currentVersion}\` | **Status**: ${doc.status}  
> **Author**: ${doc.author} | **Last Updated**: ${doc.updatedAt}

---

## 1. Executive Summary & Objectives
${doc.description || 'This document serves as the standard technical specification for the system, establishing technical standards, business rules, and quality acceptance criteria for the project.'}

All participating team members (BA, DEV, QA, PM) are required to strictly adhere to approved specifications defined in this document. Any modifications must undergo impact analysis and cryptographic integrity hashing via **SHA-256**.

## 2. Scope & Target Roles
Standard Category Classification: **${doc.category}**.

| Role | Operational Responsibility | Traceability Requirement |
| :--- | :--- | :--- |
| **Product Manager (PM)** | Milestone governance & scope management | Baseline sign-off |
| **Business Analyst (BA)** | Rule decomposition & Acceptance Criteria | Direct mapping to Requirements module |
| **Software Engineer (DEV)** | Source implementation adhering to specs | Interface & API contract compliance |
| **Quality Assurance (QA)** | Test design covering all acceptance criteria | Mandatory EVD evidence on discrepancies |

## 3. Core Specifications & Business Rules
### 3.1. Integrity & Approval Rules
- **Rule BR-AUTH-01**: Documents only establish official legal baseline upon reaching \`Approved\` status.
- **Rule BR-AUTH-02**: Automated code generation and acceptance testing must not proceed on draft versions (\`Draft\` or \`In Review\`).
- **Rule BR-SEC-01**: All attachments and text content are cryptographically signed with immutable SHA-256 hashes.

### 3.2. Engineering Delivery Standards
- Source code and documentation must remain synchronized within the same release cycle (Sprint / Milestone).
- QA execution reports must achieve at least **95%** traceability matrix coverage before Release Candidate clearance.

## 4. Acceptance Criteria
- [x] **AC-01**: Identity verification and permission validation before viewing or modifying.
- [x] **AC-02**: Automated SHA-256 checksum computation upon upload or version update.
- [ ] **AC-03**: Cryptographic chained audit logging for all state transitions.
- [ ] **AC-04**: Complete requirement-to-test case linkage matrix.

## 5. References & Appendices
- **Related Documents**: Business rule definitions and EVD evidence collection guidelines.
- **Storage Identifier**: \`${doc.id}-V${doc.currentVersion.replace('v', '')}\`
`;
  }

  return `# ${doc.title}

> **Dự án**: ${project.name} (${project.key})  
> **Mã tài liệu**: \`${doc.id}\` | **Phiên bản**: \`${doc.currentVersion}\` | **Trạng thái**: ${doc.status}  
> **Người biên soạn**: ${doc.author} | **Cập nhật lần cuối**: ${doc.updatedAt}

---

## 1. Tóm tắt Mục tiêu & Bối cảnh (Executive Summary)
${doc.description || 'Tài liệu này đóng vai trò là văn bản đặc tả chuẩn cho hệ thống, quy định các tiêu chuẩn kỹ thuật, quy tắc nghiệp vụ và tiêu chí chất lượng cho dự án.'}

Hệ thống yêu cầu mọi thành viên tham gia (BA, DEV, QA, PM) tuân thủ nghiêm ngặt các quy định được phê duyệt trong văn bản này. Mọi thay đổi đối với tài liệu đều phải trải qua quy trình đánh giá tác động và đóng dấu xác thực toàn vẹn bằng hàm băm mật mã học **SHA-256**.

## 2. Phạm vi & Đối tượng Áp dụng (Scope & Target Roles)
Tài liệu được phân loại thuộc danh mục chuẩn: **${doc.category}**.

| Vai trò | Trách nhiệm áp dụng | Yêu cầu truy vết |
| :--- | :--- | :--- |
| **Product Manager (PM)** | Giám sát phạm vi và các mốc bàn giao | Ký duyệt Baseline văn bản |
| **Business Analyst (BA)** | Phân rã quy tắc nghiệp vụ và Acceptance Criteria | Ánh xạ trực tiếp vào module Requirements |
| **Software Engineer (DEV)** | Triển khai mã nguồn theo đúng đặc tả kỹ thuật | Tuân thủ hợp đồng giao diện và API |
| **Quality Assurance (QA)** | Thiết kế ca kiểm thử bao phủ toàn bộ điều kiện nghiệm thu | Bắt buộc đính kèm bằng chứng EVD khi có sai khác |

## 3. Đặc tả Yêu cầu & Quy tắc Nghiệp vụ (Core Specifications)
### 3.1. Quy tắc Toàn vẹn & Phê duyệt
- **Quy tắc BR-AUTH-01**: Tài liệu chỉ trở thành căn cứ pháp lý chính thức khi chuyển sang trạng thái \`Approved\`.
- **Quy tắc BR-AUTH-02**: Không được phép tạo mã tự động hoặc nghiệm thu sản phẩm dựa trên các bản thảo (\`Draft\` hoặc \`In Review\`).
- **Quy tắc BR-SEC-01**: Tất cả các tệp đính kèm và nội dung văn bản đều được ký số băm SHA-256 bất biến.

### 3.2. Tiêu chuẩn Bàn giao Kỹ thuật
- Mã nguồn và tài liệu phải luôn được đồng bộ trong cùng một chu kỳ phát hành (Sprint / Milestone).
- Báo cáo kiểm thử phải đạt tỷ lệ bao phủ ma trận truy vết tối thiểu **95%** trước khi đưa ra quyết định Release Candidate.

## 4. Điều kiện Nghiệm thu (Acceptance Criteria)
- [x] **AC-01**: Xác thực danh tính người dùng và kiểm tra quyền hạn trước khi cho phép xem hoặc sửa đổi.
- [x] **AC-02**: Tự động tính toán mã băm SHA-256 ngay khi tài liệu được tải lên hoặc cập nhật phiên bản.
- [ ] **AC-03**: Hệ thống ghi vết kiểm toán chuỗi khối (Chained Audit Log) cho mọi hành động thay đổi trạng thái.
- [ ] **AC-04**: Hoàn tất ma trận liên kết giữa văn bản này và các ca kiểm thử tương ứng.

## 5. Phụ lục & Liên kết Tham chiếu (References)
- **Tài liệu liên quan**: Hệ thống quy tắc nghiệp vụ và hướng dẫn thu thập bằng chứng kiểm thử EVD.
- **Mã định danh lưu trữ**: \`${doc.id}-V${doc.currentVersion.replace('v', '')}\`
`;
}
