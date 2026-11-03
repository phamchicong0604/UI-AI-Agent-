# Document Taxonomy & Governance Specification

Tài liệu này chuẩn hóa Taxonomy 8 thư mục tiêu chuẩn trong toàn bộ hệ thống DocQA, định nghĩa quy tắc phân loại cho tài liệu đa mục đích (Multi-purpose Documents) và tài liệu không rõ loại (Ambiguous/Unclassified Documents).

---

## 1. 8 Thư mục Chuẩn (8 Standard Taxonomy Folders)

| Mã danh mục | Tên danh mục | Phạm vi & Mục đích | 3 Ví dụ cụ thể |
|---|---|---|---|
| `01_Project_Overview` | Tổng quan Dự án | Tầm nhìn, điều lệ, phạm vi tổng thể, mục tiêu kinh doanh, WBS, lộ trình tổng quan. | 1. `Project_Charter_MVP.md`<br>2. `Vision_Document_Core_Banking.docx`<br>3. `Scope_and_Milestones.txt` |
| `02_Business_Requirements` | Yêu cầu Nghiệp vụ | Quy định nghiệp vụ, BRD, quy trình kinh doanh, chính sách sản phẩm, user stories nghiệp vụ. | 1. `BRD_Payment_Gateway_v2.md`<br>2. `Business_Rules_Loyalty_Points.docx`<br>3. `User_Stories_Merchant_Onboarding.txt` |
| `03_System_Requirements` | Yêu cầu Hệ thống | Đặc tả kỹ thuật phần mềm (SRS), yêu cầu chức năng (FR), yêu cầu phi chức năng (NFR), Use Cases. | 1. `SRS_DocQA_Document_Pipeline_v1.md`<br>2. `Functional_Spec_User_Authentication.docx`<br>3. `NFR_Performance_and_Scalability.txt` |
| `04_UI_UX` | Thiết kế Giao diện | Đặc tả UI/UX, Wireframe, thiết kế Figma, style guide, token màu sắc, typography, mockup màn hình. | 1. `UI_Design_Spec_Header_and_Sidebar.md`<br>2. `Figma_Wireframe_Flow_Document_Reader.docx`<br>3. `UX_Guidelines_Mobile_Responsiveness.txt` |
| `05_Technical_Documents` | Tài liệu Kỹ thuật | Kiến trúc giải pháp (SAD), DDL/Database Schema, API Specs (OpenAPI/Swagger), Sequence Diagrams, hạ tầng. | 1. `Architecture_Design_DocQA_Platform.md`<br>2. `Database_Schema_DDL_Data_Model.docx`<br>3. `OpenAPI_Spec_Documents_API_v1.json` |
| `06_QA` | Kiểm thử & Đảm bảo CL | Kế hoạch kiểm thử tổng thể (Master Test Plan), chiến lược QA, kịch bản test case, ma trận truy vết (RTM). | 1. `Master_Test_Plan_DocQA_Release_1.0.md`<br>2. `Test_Cases_Upload_Hardening_Zip_Bomb.docx`<br>3. `Acceptance_Test_Suite_User_Stories.txt` |
| `07_EVD_Evidence` | Bằng chứng Kiểm thử | Bằng chứng nghiệm thu thực tế, ảnh chụp màn hình kiểm thử, log thực thi automated test, biên bản UAT. | 1. `UAT_Signoff_Report_Sprint_3.md`<br>2. `Test_Execution_Log_Regression_Run.docx`<br>3. `Proof_of_Concept_Biometric_Auth.txt` |
| `08_Change_History` | Lịch sử Thay đổi | Nhật ký thay đổi (Changelog), release notes, lịch sử sửa đổi tài liệu qua các phiên bản, RFCs/CRs. | 1. `Release_Notes_v0.1.0_MVP.md`<br>2. `Changelog_Security_Hotfix_202611.docx`<br>3. `RFC_Migration_to_SQLite_WAL.txt` |

---

## 2. Quy tắc Xử lý Tài liệu Đa mục đích (Multi-purpose Documents)

Nhiều tài liệu trong thực tế kết hợp cả nghiệp vụ, giao diện và kỹ thuật (ví dụ: một tài liệu Feature Spec chứa cả Business Logic, Wireframe và API payload).

### Quy tắc phân giải:
1. **Primary Category (Danh mục chính)**:
   - Được xác định dựa trên thư mục có điểm trọng số cao nhất từ thuật toán Deterministic Scoring.
   - Nếu có 2 danh mục có điểm tương đương (chênh lệch $\le 0.05$):
     - Ưu tiên: `02_Business_Requirements` > `03_System_Requirements` > `05_Technical_Documents` > `01_Project_Overview`.
2. **Secondary Tags (Nhãn phụ)**:
   - Hệ thống lưu các danh mục đạt điểm $\ge 0.50$ vào thuộc tính `secondary_categories` trong metadata của document.
3. **Phân tách Knowledge Units theo ngữ cảnh**:
   - Khi trích xuất Atomic Knowledge Units, từng unit được gán đúng `unit_type`:
     - Định nghĩa & quy tắc nghiệp vụ -> `BusinessRule`
     - Yêu cầu chức năng -> `Requirement`
     - Giới hạn kỹ thuật -> `Constraint`

---

## 3. Quy tắc Xử lý Tài liệu Không rõ Loại (Ambiguous / Unclassified Documents)

1. **Ngưỡng chấm điểm**:
   - Nếu điểm cao nhất của tất cả danh mục $< 0.40$:
     - Đánh dấu trạng thái phân loại là `Ambiguous`.
     - Phân loại tạm thời vào `01_Project_Overview` kèm cờ `needs_human_review = true`.
2. **Hàng đợi Human Review (E8-T2)**:
   - Các tài liệu `Ambiguous` được đưa lên đầu hàng đợi review để người kiểm thử/BA chọn danh mục chuẩn xác trước khi tiến hành trích xuất sâu.
3. **Học tăng cường từ quyết định người dùng**:
   - Khi người dùng chỉnh sửa danh mục của tài liệu `Ambiguous`, hệ thống lưu AuditEvent làm dữ liệu huấn luyện/tinh chỉnh bộ từ khóa cho sprint tiếp theo.
