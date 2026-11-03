# Document Taxonomy & AI Classification Rules

Tài liệu này định nghĩa hệ thống phân loại tài liệu dự án (**Document Taxonomy**) chuẩn hóa vào 8 thư mục tiêu chuẩn, các bộ từ khóa nhận diện, cấu trúc tiêu đề (Heading Patterns) và quy tắc tính điểm phân loại tiền xử lý định tính (Deterministic Classification Scoring).

---

## 1. Bản đồ Phân loại 8 Thư mục Chuẩn (8 Standard Folders Taxonomy)

| Mã thư mục | Tên thư mục | Mục đích & Phạm vi | Bộ từ khóa nhận diện chính |
|---|---|---|---|
| `01_Project_Overview` | Tổng quan Dự án | Tầm nhìn, điều lệ dự án, phạm vi tổng thể, mục tiêu kinh doanh, WBS, kế hoạch triển khai sơ bộ. | `project overview`, `charter`, `vision`, `tổng quan dự án`, `mục tiêu`, `phạm vi`, `scope`, `stakeholders`, `lộ trình`, `roadmap` |
| `02_Business_Requirements` | Yêu cầu Nghiệp vụ | Quy định nghiệp vụ, Business Requirement Document (BRD), quy trình người dùng, chính sách sản phẩm. | `brd`, `business requirement`, `nghiệp vụ`, `quy tắc nghiệp vụ`, `business rule`, `user story`, `quy trình`, `workflow`, `chính sách` |
| `03_System_Requirements` | Yêu cầu Hệ thống | Đặc tả yêu cầu phần mềm (SRS), yêu cầu chức năng, phi chức năng, ca sử dụng hệ thống. | `srs`, `system requirement`, `yêu cầu hệ thống`, `yêu cầu chức năng`, `phi chức năng`, `use case`, `functional spec`, `non-functional` |
| `04_UI_UX` | Thiết kế Giao diện | Đặc tả giao diện, wireframe, thiết kế Figma, hướng dẫn phong cách UI, trải nghiệm người dùng. | `ui`, `ux`, `wireframe`, `figma`, `design`, `giao diện`, `mockup`, `prototype`, `style guide`, `component`, `layout` |
| `05_Technical_Documents` | Tài liệu Kỹ thuật | Kiến trúc kỹ thuật, thiết kế cơ sở dữ liệu, API specs, OpenAPI, sơ đồ tuần tự, hạ tầng triển khai. | `architecture`, `database`, `db schema`, `api spec`, `openapi`, `swagger`, `erd`, `kiến trúc`, `endpoint`, `microservices`, `payload` |
| `06_QA` | Kiểm thử & Đảm bảo CL | Kế hoạch kiểm thử, chiến lược QA, kịch bản test case, tiêu chí chấp nhận, ma trận truy vết. | `test plan`, `test strategy`, `test case`, `kế hoạch kiểm thử`, `qa`, `qc`, `kịch bản`, `acceptance criteria`, `traceability matrix`, `defect` |
| `07_EVD_Evidence` | Bằng chứng Kiểm thử | Ảnh chụp màn hình, biên bản nghiệm thu (UAT Sign-off), log thực thi, kết quả kiểm thử tự động. | `evidence`, `proof`, `screenshot`, `minh chứng`, `bằng chứng`, `uat sign-off`, `test execution log`, `audit trail`, `biên bản nghiệm thu` |
| `08_Change_History` | Lịch sử Thay đổi | Nhật ký phát hành (Changelog), lịch sử phiên bản, release notes, yêu cầu sửa đổi (RFC/CR). | `change history`, `changelog`, `release note`, `lịch sử thay đổi`, `nhật ký phát hành`, `version history`, `rfc`, `change request` |

---

## 2. Danh mục 24 Ví dụ Mẫu (3 ví dụ cho mỗi thư mục - E7-T1 AC)

### 01_Project_Overview
1. `Project_Charter_DocQA_MVP.md`: Tài liệu điều lệ dự án, xác định phạm vi xây dựng MVP trong 3 tháng.
2. `Executive_Vision_FCB_Core_Banking.docx`: Báo cáo tầm nhìn chuyển đổi số core banking gửi Hội đồng quản trị.
3. `Project_Scope_and_Milestones.txt`: Bảng phân bổ mốc bàn giao và trách nhiệm các bên liên quan.

### 02_Business_Requirements
1. `BRD_Payment_Gateway_v2.md`: Yêu cầu nghiệp vụ cổng thanh toán nội địa và QR Code xuyên biên giới.
2. `Business_Rules_Loyalty_Points.docx`: Bảng 20 quy tắc tích điểm và quy đổi voucher cho khách hàng VIP.
3. `User_Stories_Merchant_Onboarding.txt`: Tập hợp user stories về đăng ký điểm chấp nhận thanh toán.

### 03_System_Requirements
1. `SRS_DocQA_Document_Pipeline_v1.md`: Đặc tả yêu cầu hệ thống xử lý tệp nén và trích xuất tri thức.
2. `Functional_Spec_User_Authentication.docx`: Chi tiết luồng xác thực đa nhân tố (MFA) và phiên đăng nhập.
3. `NFR_Performance_and_Scalability.txt`: Chỉ số tải 10,000 CCU và thời gian phản hồi API dưới 200ms.

### 04_UI_UX
1. `UI_Design_Spec_Header_and_Sidebar.md`: Đặc tả tỷ lệ khung lưới, màu sắc và typography theo Figma.
2. `Figma_Wireframe_Flow_Document_Reader.docx`: Mô tả trải nghiệm đọc tài liệu Zen Mode và duyệt mục lục.
3. `UX_Guidelines_Mobile_Responsiveness.txt`: Quy chuẩn giao diện tương thích thiết bị di động và tablet.

### 05_Technical_Documents
1. `Architecture_Design_DocQA_Platform.md`: Sơ đồ khối kiến trúc SQLite WAL, Job Queue và AI Agent sidecar.
2. `Database_Schema_DDL_Data_Model.docx`: Mô tả chi tiết 11 bảng cơ sở dữ liệu và quan hệ khóa ngoại.
3. `OpenAPI_Spec_Documents_API_v1.json`: Đặc tả RESTful API chuẩn OpenAPI 3.0 cho module tài liệu.

### 06_QA
1. `Master_Test_Plan_DocQA_Release_1.0.md`: Kế hoạch kiểm thử toàn diện, phân công nhân sự và môi trường STG.
2. `Test_Cases_Upload_Hardening_Zip_Bomb.docx`: Danh sách 15 test case kiểm thử phòng vệ tệp nén độc hại.
3. `Acceptance_Test_Suite_User_Stories.txt`: Tiêu chí nghiệm thu đầu ra cho sprint 4.

### 07_EVD_Evidence
1. `UAT_Signoff_Report_Sprint_3.md`: Biên bản nghiệm thu người dùng có chữ ký phê duyệt của PM và Product Owner.
2. `Test_Execution_Log_Regression_Run.docx`: Nhật ký thực thi 120 automated test cases trên môi trường QA.
3. `Proof_of_Concept_Biometric_Auth.txt`: Kết quả chứng minh khả năng xác thực vân tay qua SDK.

### 08_Change_History
1. `Release_Notes_v0.1.0_MVP.md`: Danh sách tính năng mới và danh sách bug đã sửa trong bản release v0.1.0.
2. `Changelog_Security_Hotfix_202611.docx`: Ghi nhận bản vá lỗi phân quyền và mã hóa SHA-256.
3. `RFC_Migration_to_SQLite_WAL.txt`: Đề xuất thay đổi kỹ thuật nâng cấp cơ chế ghi cơ sở dữ liệu.

---

## 3. Quy tắc Tính điểm Phân loại Định tính (Deterministic Scoring Rules)

Trước khi gọi mô hình ngôn ngữ lớn (LLM), hệ thống áp dụng công thức tính điểm toán học:

$$\text{Confidence}(C) = 0.35 \times S_{\text{path}}(C) + 0.35 \times S_{\text{heading}}(C) + 0.30 \times S_{\text{keyword}}(C)$$

- **$S_{\text{path}}$ (35%)**: Tên tệp hoặc tiền tố thư mục trong ZIP (ví dụ: `docs/05_tech/...` cho điểm tối đa 1.0 cho `05_Technical_Documents`).
- **$S_{\text{heading}}$ (35%)**: Khớp tiêu đề H1, H2 với cấu trúc đặc trưng (ví dụ: `# Kế hoạch kiểm thử` khớp `06_QA`).
- **$S_{\text{keyword}}$ (30%)**: Tần suất từ khóa chuẩn hóa theo dung lượng văn bản.

Nếu $\text{Confidence} \ge 0.75$, hệ thống tự động gán phân loại mà **không cần gọi AI LLM**, giúp tiết kiệm token và tăng tốc độ xử lý tức thì (E7-T2).
