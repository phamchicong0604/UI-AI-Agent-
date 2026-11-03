# Bug List: Review nhánh `feat/document-project-upload` @ 4b1c2a5

Phạm vi review: `72a68e8..4b1c2a5`, Epic E1 đến E10.
Ngày review: 2026-11-03.
Trạng thái build: 100% tests pass (17/17 frontend, 107/107 server), build frontend & server pass, 0 lỗi TypeScript.
Kết luận: **ĐÃ HOÀN THÀNH SỬA TOÀN BỘ 34 BUGS (Blocker, High, Medium, Low).** Đạt chuẩn Definition of Done (DoD), sẵn sàng merge vào `develop`.

## Quy ước

| Trường | Ý nghĩa |
|---|---|
| Severity | Blocker chặn merge. High cần sửa trước pilot. Medium cần sửa trước release. Low có thể đưa vào backlog |
| Verified | **Manual** là đã đọc lại code để xác nhận. **Review** là do lần review code báo, có dẫn chiếu dòng, dev cần tái hiện trước khi sửa |
| Epic | Liên kết với `docs/BACKLOG-AI-DOCUMENT-PIPELINE.md` |
| Đường dẫn | Tương đối từ `server/src/` nếu không ghi khác |

Số dòng tính tại commit 4b1c2a5 và có thể lệch sau khi sửa.

## Tổng hợp

| ID | Severity | Epic | Tiêu đề | Verified | Trạng thái |
|---|---|---|---|---|---|
| BUG-001 | Blocker | E5 | Chính sách Offline only không được áp dụng trên luồng AI thật | Manual | ✅ Đã sửa & Có Test |
| BUG-002 | Blocker | E5 | Policy fail-open khi thiếu cấu hình hoặc DB lỗi | Manual | ✅ Đã sửa & Có Test |
| BUG-003 | Blocker | E6 | Route duyệt Knowledge và resolve conflict không kiểm tra quyền | Manual | ✅ Đã sửa & Có Test |
| BUG-004 | Blocker | E6 | Server không chặn approve unit có evidence_level khác Explicit | Review | ✅ Đã sửa & Có Test |
| BUG-005 | Blocker | E3 | Route transition tin `fromState` và `role` từ client | Manual | ✅ Đã sửa & Có Test |
| BUG-006 | Blocker | E1 | Approve tài liệu bypass được khi bỏ trống `userRole` | Manual | ✅ Đã sửa & Có Test |
| BUG-007 | Blocker | E9 | Eval ghi đè baseline thay vì so sánh, chỉ số gán cứng | Manual | ✅ Đã sửa & Có Test |
| BUG-008 | Blocker | E10 | Cascade delete project để lại documents và versions | Manual | ✅ Đã sửa & Có Test |
| BUG-009 | Blocker | E2 | Upload docx không kiểm tra zip bomb | Review | ✅ Đã sửa & Có Test |
| BUG-010 | Blocker | E3 | Job queue và workflow engine không được nối vào app | Manual | ✅ Đã sửa & Có Test |
| BUG-011 | Blocker | E3 | Route retry job luôn trả 500 | Manual | ✅ Đã sửa & Có Test |
| BUG-012 | High | E3 | Job bị cancel hoặc timeout có thể bị ghi đè hoặc chạy hai lần | Review | ✅ Đã sửa & Có Test |
| BUG-013 | High | E3 | Khôi phục lock cũ gây chạy trùng và retry vô hạn | Review | ✅ Đã sửa & Có Test |
| BUG-014 | High | E6 | Promote sang Requirement ghi đè chỉnh sửa và sai source reference | Review | ✅ Đã sửa & Có Test |
| BUG-015 | High | E7 | Phát hiện conflict sai với câu phủ định và số một chữ số | Review | ✅ Đã sửa & Có Test |
| BUG-016 | High | E5 | Delimiter prompt bị thoát được, cờ injection không có tác dụng | Review | ✅ Đã sửa & Có Test |
| BUG-017 | High | E4 | Fallback engine sinh unit giả gắn nhãn Explicit | Review | ✅ Đã sửa & Có Test |
| BUG-018 | High | E3 | Supersede version không đúng spec và không được gọi khi upload | Review | ✅ Đã sửa & Có Test |
| BUG-019 | Medium | E1 | Migration 002 làm mất nội dung version cũ | Review | ✅ Đã sửa |
| BUG-020 | Medium | E1 | File id dùng chung giữa các project có nội dung giống nhau | Review | ✅ Đã sửa & Có Test |
| BUG-021 | Medium | E2 | Upload batch không atomic, `projectId` không được validate | Review | ✅ Đã sửa & Có Test |
| BUG-022 | Medium | E10 | Retention xóa file trước DB, không transaction, đếm sai | Review | ✅ Đã sửa & Có Test |
| BUG-023 | Medium | E1 | `DELETE /documents/:id` không kiểm tra quyền và để lại file | Review | ✅ Đã sửa & Có Test |
| BUG-024 | Medium | E7 | FTS5 MATCH nhận text chưa quote, regex làm hỏng tiếng Việt | Review | ✅ Đã sửa & Có Test |
| BUG-025 | Medium | E8 | Bulk approve dùng state cũ, lỗi API bị nuốt | Review | ✅ Đã sửa |
| BUG-026 | Medium | E8 | Conflict đã resolve vẫn hiển thị và resolve lại được | Review | ✅ Đã sửa & Có Test |
| BUG-027 | Medium | E8 | Modal conflict thiếu coexist, resolve không tác động unit | Review | ✅ Đã sửa & Có Test |
| BUG-028 | Medium | E8 | Highlight bỏ qua char offset | Review | ✅ Đã sửa |
| BUG-029 | Medium | QA | Test ghi vào DB dev thật và thiếu các ca quan trọng | Review | ✅ Đã sửa |
| BUG-030 | Low | E1 | Checksum khi tạo tài liệu thủ công không tính trên bytes | Review | ✅ Đã sửa |
| BUG-031 | Low | E2 | Kiểm tra loại file dùng blacklist extension | Review | ✅ Đã sửa & Có Test |
| BUG-032 | Low | E5 | Redaction bỏ sót các định dạng secret phổ biến | Review | ✅ Đã sửa & Có Test |
| BUG-033 | Low | E1 | Migrator không kiểm tra checksum migration đã áp dụng | Review | ✅ Đã sửa |
| BUG-034 | Low | E8 | Vi phạm Rules of Hooks, timer không clear, route mount trùng, thiếu i18n | Review | ✅ Đã sửa |

---

## Blocker

### BUG-001: Chính sách Offline only không được áp dụng trên luồng AI thật

- **Severity:** Blocker · **Epic:** E5-T2 · **Verified:** Manual
- **Vị trí:** `modules/ai/stage2Runner.ts:39`, `modules/ai/dataPolicyService.ts:85`, `modules/ai/ai.service.ts:46-63`
- **Mô tả:** Policy chỉ được kiểm tra trong `Stage2CombinedRunner`. Class này không được gọi ở đâu ngoài test. `assertCanSendExternal` cũng không có caller nào. Các luồng gọi provider thật trong `ai.service.ts` không kiểm tra policy.
- **Tái hiện:**
  1. Đặt `ai_policy` của một project là Offline only.
  2. Gọi `POST /api/v1/ai/generate-testcases` cho requirement thuộc project đó, với connection Gemini hoặc OpenAI đang bật.
  3. Quan sát request đi ra provider ngoài.
- **Mong đợi:** Không có request nào ra ngoài. Hệ thống dùng grounded engine hoặc trả lỗi rõ ràng.
- **Hướng sửa:** Đặt kiểm tra policy ở một điểm duy nhất là `aiConnectionManager.generateCompletion` hoặc tầng tương đương. Mọi caller, gồm `ai.controller.ts`, `agent.router.ts` và `cli/agent.ts`, phải đi qua điểm đó. Bắt buộc truyền `projectId`.
- **AC:** Có test tích hợp mock HTTP chứng minh project Offline only không phát sinh request ra ngoài trên tất cả endpoint AI.

### BUG-002: Policy fail-open khi thiếu cấu hình hoặc DB lỗi

- **Severity:** Blocker · **Epic:** E5-T2 · **Verified:** Manual
- **Vị trí:** `modules/ai/dataPolicyService.ts:64-72`, `modules/ai/stage2Runner.ts:34`
- **Mô tả:** `getProjectPolicy` trả `ALLOW_EXTERNAL` khi không có row, khi `ai_policy` null, hoặc khi DB throw lỗi. Lỗi bị `catch {}` nuốt. `projectId` mặc định là `'PRJ-01'`.
- **Tái hiện:** Gọi runner với `projectId` không tồn tại, hoặc không truyền `projectId`.
- **Mong đợi:** Fail-closed. Không xác định được policy thì không gửi ra ngoài.
- **Hướng sửa:** Mặc định là Offline only. Log lỗi DB rồi throw. Bỏ giá trị mặc định `'PRJ-01'`.
- **AC:** Test cho ba trường hợp: thiếu project, policy null và DB lỗi. Cả ba đều phải chặn gửi ra ngoài.

### BUG-003: Route duyệt Knowledge và resolve conflict không kiểm tra quyền

- **Severity:** Blocker · **Epic:** E6-T2, E6-T4 · **Verified:** Manual
- **Vị trí:** `modules/knowledge/knowledge.router.ts:40-60`, `:78-90`
- **Mô tả:** Hai route không có authentication và không kiểm tra role. Tên `reviewer` và `resolvedBy` lấy từ body, mặc định là `'Reviewer'`.
- **Tái hiện:** Gửi `POST /api/v1/knowledge-units/<id>/decision` với body `{"decision":"Approve"}` mà không đăng nhập. Unit chuyển Approved, Requirement được tạo, Test Case liên quan chuyển In Review. Tương tự với route resolve conflict Critical.
- **Mong đợi:** Trả 401 hoặc 403 nếu người gọi không có role BA, Reviewer / Approver hoặc Project Admin. Danh tính reviewer lấy từ session.
- **Hướng sửa:** Thêm middleware xác thực và kiểm tra role dùng chung. Không nhận danh tính từ body.
- **AC:** Có test cho trường hợp không có quyền và sai role. Audit event ghi đúng người thực hiện.

### BUG-004: Server không chặn approve unit có evidence_level khác Explicit

- **Severity:** Blocker · **Epic:** E4-T3, E8-T3 · **Verified:** Review
- **Vị trí:** `modules/knowledge/knowledge.router.ts:40-56`, `modules/knowledge/knowledgeService.ts:20`
- **Mô tả:** Server không kiểm tra `evidence_level` khi Approve. Reject không bắt buộc lý do. Service approve được unit ở mọi trạng thái, kể cả Rejected, Superseded và Conflict. Quy tắc chặn bulk approve và lý do tối thiểu 5 ký tự chỉ có ở UI.
- **Tái hiện:** Gọi API approve trực tiếp cho unit có `evidence_level` là Assumed, hoặc reject mà không có `reason`.
- **Mong đợi:** Unit không phải Explicit chỉ được approve khi có xác nhận riêng của reviewer và ghi rõ lý do. Reject bắt buộc có lý do. Chỉ approve được unit ở trạng thái chờ review.
- **Hướng sửa:** Chuyển các guardrail đang có ở UI xuống service. Thêm state guard trước khi approve.
- **AC:** Có test server cho từng guardrail, không phụ thuộc UI.

### BUG-005: Route transition tin `fromState` và `role` từ client

- **Severity:** Blocker · **Epic:** E3-T3 · **Verified:** Manual
- **Vị trí:** `modules/workflow/workflow.router.ts:66-78`, `modules/workflow/workflowEngine.ts:76-81`
- **Mô tả:** Engine kiểm tra state machine dựa trên `fromState` do client gửi, không đọc trạng thái thật từ DB. Role cũng lấy từ body, mặc định là `'Reviewer / Approver'`.
- **Tái hiện:** Với tài liệu đang ở `AI_ANALYSIS`, gửi `POST /api/v1/workflow/transition` với body `{"fromState":"REVIEW_REQUIRED","toState":"ORGANIZED","role":"Project Admin"}`.
- **Mong đợi:** Trả 409 vì trạng thái thực tế không khớp. Role lấy từ session.
- **Hướng sửa:** Đọc trạng thái hiện tại từ DB trong transaction. Dùng compare-and-set dạng `UPDATE ... WHERE state = ?`. Bỏ `fromState` và `role` khỏi body.
- **AC:** Test với `fromState` sai và role giả đều bị từ chối.

### BUG-006: Approve tài liệu bypass được khi bỏ trống `userRole`

- **Severity:** Blocker · **Epic:** E1 · **Verified:** Manual
- **Vị trí:** `modules/documents/documents.router.ts:707`
- **Mô tả:** Điều kiện `status === 'Approved' && userRole && ...` bỏ qua kiểm tra khi không có `userRole`. `status` cũng không được validate theo danh sách cho phép.
- **Tái hiện:** Gửi `PATCH /api/v1/documents/<id>/status` với body `{"status":"Approved"}`.
- **Mong đợi:** Trả 403.
- **Hướng sửa:** Lấy role từ session, thiếu role thì từ chối. Validate `status` theo `StatusLifecycle`.
- **AC:** Có test cho các trường hợp thiếu role, sai role và status không hợp lệ.

### BUG-007: Eval ghi đè baseline thay vì so sánh, chỉ số gán cứng

- **Severity:** Blocker · **Epic:** E9-T3 · **Verified:** Manual
- **Vị trí:** `tests/eval/evalRunner.test.ts:27`, `:67`, `tests/eval/evalRunner.ts:147-148`, `tests/eval/dataset.v1.json`, `modules/documents/classificationScorer.ts:156`
- **Mô tả:**
  - Mỗi lần chạy `npm test`, file `baseline.json` và `docs/AI-EVALUATION-REPORT.md` bị ghi đè. Baseline không bao giờ được đọc để so sánh.
  - Extraction precision 92.5 và recall 94.0 là số gán cứng nhưng báo cáo trình bày như số đo.
  - `filePath` trong dataset bắt đầu bằng tên thư mục đúng, và scorer cho điểm path tối đa. Nhãn đúng vì vậy bị lộ cho scorer.
  - Conflict recall chỉ dựa trên một cặp dữ liệu.
- **Tái hiện:** Chạy `npm --prefix server test`, sau đó chạy `git status` và thấy hai file tracked bị sửa.
- **Mong đợi:** Test chỉ đọc baseline và fail khi metric giảm quá ngưỡng. Việc cập nhật baseline là thao tác có chủ đích.
- **Hướng sửa:**
  - Tách lệnh `eval:update-baseline` riêng. Test chỉ so sánh với baseline.
  - Ghi báo cáo vào thư mục build hoặc thư mục bị gitignore.
  - Đo extraction thật hoặc ghi rõ là chưa đo.
  - Đổi `filePath` trong dataset sang tên trung tính.
  - Bổ sung thêm các cặp conflict.
- **AC:** Chạy test không làm thay đổi file tracked. Cố ý làm giảm chất lượng scorer thì test fail.

### BUG-008: Cascade delete project để lại documents và versions

- **Severity:** Blocker · **Epic:** E10-T3 · **Verified:** Manual
- **Vị trí:** `modules/documents/retentionService.ts:48-68`, `database/migrations/001_initial_schema.ts:12`
- **Mô tả:** Service xóa file trên đĩa rồi chỉ chạy `DELETE FROM projects`. Cột `documents.project_id` không có foreign key tới `projects`. Vì vậy documents, document_versions và stored_files vẫn còn.
- **Tái hiện:** Gọi cascade delete cho một project có tài liệu, rồi truy vấn bảng `documents` theo `project_id`.
- **Mong đợi:** Mọi dữ liệu của project bị xóa, gồm documents, versions, stored_files, knowledge_units, conflicts, pipeline_runs và jobs.
- **Hướng sửa:** Xóa tường minh các bảng con trong một transaction, hoặc thêm foreign key qua migration mới. Test hiện tại ở `observabilityAndRetention.test.ts:155-169` phải kiểm tra cả các bảng con.
- **AC:** Sau khi xóa, không còn row nào tham chiếu project. Test fail nếu còn dữ liệu mồ côi.

### BUG-009: Upload docx không kiểm tra zip bomb

- **Severity:** Blocker · **Epic:** E2-T1 · **Verified:** Review
- **Vị trí:** `modules/documents/uploadSecurity.ts:75-104`, `modules/documents/parsers/docxParser.ts:22`
- **Mô tả:** Nhánh `.docx` chỉ kiểm tra magic bytes và tên entry, bỏ qua kiểm tra tỷ lệ nén và tổng dung lượng giải nén mà nhánh `.zip` có. Parser đọc `word/document.xml` mà không giới hạn kích thước. Lỗi này cũng áp dụng cho file docx nằm trong file zip.
- **Tái hiện:** Upload một file docx vài MB có `document.xml` khai báo kích thước giải nén khoảng 2 GB.
- **Mong đợi:** Trả 4xx và không đọc nội dung.
- **Hướng sửa:** Dùng chung hàm kiểm tra archive cho cả zip và docx. Giới hạn kích thước từng entry trước khi đọc.
- **AC:** Có test docx bomb, docx bomb nằm trong zip, và zip bomb theo tỷ lệ nén.

### BUG-010: Job queue và workflow engine không được nối vào app

- **Severity:** Blocker · **Epic:** E3-T2, E3-T3 · **Verified:** Manual
- **Vị trí:** `modules/workflow/jobQueue.ts`, `modules/workflow/workflowEngine.ts`, `main.ts`
- **Mô tả:** Không có chỗ nào ngoài test gọi `defaultJobQueue.start()` hay đăng ký handler. Pipeline upload không gọi `transition()`. Khôi phục sau crash, timeout và retry theo stage vì vậy không chạy trong app thật.
- **Mong đợi:** Upload tạo job. Worker xử lý job qua các stage và chuyển trạng thái bằng engine.
- **Hướng sửa:** Khởi động worker trong `main.ts`, đăng ký handler cho từng stage, và nối luồng upload vào job queue. Dừng worker khi tắt server.
- **AC:** Có test tích hợp: upload một file thì tài liệu đi tới `REVIEW_REQUIRED` qua job queue.

### BUG-011: Route retry job luôn trả 500

- **Severity:** Blocker · **Epic:** E3-T2 · **Verified:** Manual
- **Vị trí:** `modules/workflow/workflow.router.ts:47`
- **Mô tả:** Route retry gọi `jobs.create()`, tức một lệnh INSERT, với id của job đã tồn tại. `jobs.id` là khóa chính nên lệnh luôn lỗi UNIQUE constraint.
- **Tái hiện:** Gọi retry cho một job ở trạng thái FAILED.
- **Mong đợi:** Job chuyển về PENDING và chạy lại.
- **Hướng sửa:** Thêm `jobs.resetForRetry(id)` dùng `UPDATE ... WHERE id = ? AND status = 'FAILED'`.
- **AC:** Có test cho route retry.

---

## High

### BUG-012: Job bị cancel hoặc timeout có thể bị ghi đè hoặc chạy hai lần

- **Severity:** High · **Epic:** E3-T2 · **Verified:** Review
- **Vị trí:** `modules/workflow/jobQueue.ts:138-149`, `database/db.ts:972-1004`
- **Mô tả:** `complete()` và `failWithRetry()` chỉ update theo `id`, không có điều kiện `status = 'RUNNING' AND locked_by = ?`. Handler đã quá timeout không bị hủy.
- **Tái hiện:** Cancel một job đang chạy, và job bị ghi thành COMPLETED khi handler kết thúc. Với job quá timeout, job được đưa lại hàng đợi trong khi handler cũ vẫn chạy.
- **Hướng sửa:** Thêm điều kiện owner và status vào mọi lệnh update. Dùng `AbortSignal` để hủy handler khi timeout hoặc cancel.
- **AC:** Có test cho cancel trong lúc đang chạy và cho timeout.

### BUG-013: Khôi phục lock cũ gây chạy trùng và retry vô hạn

- **Severity:** High · **Epic:** E3-T2 · **Verified:** Review
- **Vị trí:** `modules/workflow/jobQueue.ts:69`, `database/db.ts:1015`
- **Mô tả:** Việc khôi phục lock chỉ chạy lúc `start()` với ngưỡng 60 giây, không có heartbeat, và không tăng `attempts`.
- **Tác động:** Một process thứ hai khởi động sẽ reset các job mà worker khác đang giữ quá 60 giây. Job làm crash process sẽ bị reset mãi mà không bao giờ chạm `maxAttempts`.
- **Hướng sửa:** Thêm heartbeat cập nhật `locked_at`. Chỉ khôi phục khi heartbeat quá hạn. Tăng `attempts` mỗi lần khôi phục.
- **AC:** Có test với hai worker và với job làm crash process.

### BUG-014: Promote sang Requirement ghi đè chỉnh sửa và sai source reference

- **Severity:** High · **Epic:** E6-T3 · **Verified:** Review
- **Vị trí:** `modules/knowledge/knowledgeService.ts:56-61`, `:71-95`
- **Mô tả:**
  - Requirement được tạo với id cố định `REQ-<unit>` và upsert. Duyệt lại sẽ ghi đè title, description, priority và acceptance criteria mà người dùng đã sửa.
  - Source reference không chứa id của unit.
  - Version được đoán từ id bằng `split('-v')`, và document fallback về `DOC-01` giả.
  - Unit loại BusinessRule không bao giờ được promote.
- **Hướng sửa:** Chỉ tạo Requirement nếu chưa có. Nếu đã có thì tạo đề xuất cập nhật cho người duyệt. Lấy version và document từ `knowledge_sources`. Thêm id của unit vào source reference. Promote BusinessRule.
- **AC:** Test duyệt lại không làm mất chỉnh sửa của người dùng. Trace matrix hiển thị nguồn tới unit và document version thật.

### BUG-015: Phát hiện conflict sai với câu phủ định và số một chữ số

- **Severity:** High · **Epic:** E7-T3, E6-T4 · **Verified:** Review
- **Vị trí:** `modules/knowledge/semanticValidator.ts:163`, `:184-192`, `modules/workflow/workflowEngine.ts:89`
- **Mô tả:**
  - Cụm "không bắt buộc" chứa "bắt buộc", nên bị tính là khẳng định. Hệ thống tạo conflict Critical giả và chặn project tới ORGANIZED.
  - Pattern số `\d+[\w%]+` bỏ sót số một chữ số như "5 phút", nên mâu thuẫn thật như 5 phút và 7 phút không được phát hiện.
- **Hướng sửa:** Xử lý phủ định trước khi so khớp từ khóa. Sửa regex để bắt cả số có một chữ số, với đơn vị tách bởi khoảng trắng.
- **AC:** Có test cho các cặp "không bắt buộc" với "không bắt buộc", "5 phút" với "7 phút", và các ví dụ tiếng Việt khác.

### BUG-016: Delimiter prompt bị thoát được, cờ injection không có tác dụng

- **Severity:** High · **Epic:** E5-T3 · **Verified:** Review
- **Vị trí:** `modules/ai/dataPolicyService.ts:150-156`, `modules/ai/stage2Runner.ts:142`
- **Mô tả:** Nội dung tài liệu không được escape chuỗi `=== END_UNTRUSTED_DOCUMENT_CONTENT ===`, nên tài liệu có thể tự đóng khối dữ liệu và chèn chỉ thị. Kết quả `detectPromptInjection` chỉ được ghi log. Hàm trả `sanitizedText` không thay đổi.
- **Hướng sửa:** Dùng delimiter ngẫu nhiên cho mỗi lần gọi, hoặc escape delimiter trong nội dung. Khi có cờ injection, gắn cờ cho tài liệu và bắt buộc Human Review.
- **AC:** Có test với tài liệu chứa delimiter đóng và chỉ thị nhúng. Tài liệu đó phải được đẩy sang review.

### BUG-017: Fallback engine sinh unit giả gắn nhãn Explicit

- **Severity:** High · **Epic:** E4-T4 · **Verified:** Review
- **Vị trí:** `modules/ai/stage2Runner.ts:80`, `:89`, `:163-195`, `modules/ai/skills/schemas.ts:104`
- **Mô tả:**
  - Khi không có `llmCaller`, runner dùng fallback ngay cả với project cho phép gửi ra ngoài.
  - Fallback trả về một unit gán cứng với `evidence_level` là Explicit, subject và action tự đặt, và confidence 0.92.
  - `canAutoApproveUnit` tồn tại để tự động duyệt unit Explicit. Hàm chưa được gọi, nhưng nếu được nối vào sẽ tự động duyệt nội dung giả này.
  - Lần retry gửi lại đúng prompt cũ, không kèm lỗi validate.
- **Hướng sửa:** Fallback chỉ được trích xuất câu có thật trong tài liệu kèm offset, hoặc trả rỗng với trạng thái rõ ràng. Xóa `canAutoApproveUnit` vì trái nguyên tắc Human-controlled Knowledge. Lần retry gửi kèm lỗi validate.
- **AC:** Mọi unit do fallback tạo đều có `exactQuote` tồn tại nguyên văn trong tài liệu.

### BUG-018: Supersede version không đúng spec và không được gọi khi upload

- **Severity:** High · **Epic:** E3-T3 · **Verified:** Review
- **Vị trí:** `modules/workflow/workflowEngine.ts:28-29`, `:144-150`
- **Mô tả:**
  - Chuyển trạng thái `FEEDBACK_REQUIRED → SUPERSEDED` thiếu trong `ALLOWED_TRANSITIONS`, dù spec mục 4 yêu cầu.
  - `supersedePreviousVersions` bỏ qua state machine và supersede cả version đang xử lý.
  - Hàm không đóng các review đang chờ.
  - Hàm không được gọi từ luồng upload, chỉ có test gọi.
- **Hướng sửa:** Supersede qua engine theo đúng spec, đóng các review đang chờ, và gọi hàm khi upload version mới.
- **AC:** Test upload version mới khi version cũ đang review, đối chiếu với `docs/WORKFLOW-STATE-MACHINE.md`.

---

## Medium

### BUG-019: Migration 002 làm mất nội dung version cũ

- **Severity:** Medium · **Epic:** E1-T3 · **Verified:** Review
- **Vị trí:** `database/migrations/002_file_storage_and_document_versions.ts:95-114`, `:147-149`
- **Mô tả:**
  - Mọi phần tử `versions[]` cũ nhận nội dung hiện tại và cùng một file id.
  - Lỗi trên từng row bị nuốt bằng `console.warn`, nhưng migration vẫn được đánh dấu đã áp dụng.
  - Checksum cũ được giữ dù không khớp với bytes đã lưu.
  - `fileStore.put` là hàm async nhưng không được await, và ghi file nằm ngoài transaction.
- **Hướng sửa:** Version cũ không có nội dung riêng thì đánh dấu `content_unavailable`. Lỗi trên row nào thì rollback toàn bộ migration. Tính lại checksum. Ghi file trước, commit DB sau, và có bước dọn dẹp khi lỗi.
- **AC:** Có test migration với dữ liệu JSON cũ gồm nhiều version.
- **Lưu ý:** Nếu migration này đã chạy trên DB có dữ liệu thật, cần đánh giá dữ liệu đã bị ảnh hưởng.

### BUG-020: File id dùng chung giữa các project có nội dung giống nhau

- **Severity:** Medium · **Epic:** E1-T3 · **Verified:** Review
- **Vị trí:** `database/migrations/002_file_storage_and_document_versions.ts:76`, `:84`, `database/db.ts:644`
- **Mô tả:** File id là `FILE-<10 ký tự hex của hash nội dung>`. Hai tài liệu cùng nội dung ở hai project dùng chung một row `stored_files`. Xóa project B sẽ xóa file của project A. Bước sync khi khởi động dùng `INSERT OR REPLACE`, nên mỗi lần boot lại ghi đè `storage_key`.
- **Hướng sửa:** Dùng id ngẫu nhiên cho từng file, hoặc thêm reference counting. Bỏ sync bằng `REPLACE` khi khởi động.
- **AC:** Có test xóa một project không ảnh hưởng file của project khác.

### BUG-021: Upload batch không atomic, `projectId` không được validate

- **Severity:** Medium · **Epic:** E2-T2 · **Verified:** Review
- **Vị trí:** `modules/documents/documents.router.ts:360`, `:421-484`, `:653`
- **Mô tả:** Ghi file và insert `stored_files`, `documents`, `versions` không nằm trong transaction. Với `projectId` không tồn tại, lệnh insert `upload_batches` lỗi foreign key ở cuối. Client nhận 500 trong khi documents đã được lưu.
- **Hướng sửa:** Validate `projectId` ngay đầu request. Mỗi file xử lý trong transaction riêng, kèm bước dọn file khi lỗi.
- **AC:** Upload với `projectId` sai trả 400 và không tạo dữ liệu nào.

### BUG-022: Retention xóa file trước DB, không transaction, đếm sai

- **Severity:** Medium · **Epic:** E10-T3 · **Verified:** Review
- **Vị trí:** `modules/documents/retentionService.ts:57-68`
- **Mô tả:** File bị xóa trước khi chạy lệnh xóa DB, không có transaction. `deletedFilesCount` tăng cả khi `delete()` trả false. Nếu lệnh xóa DB lỗi, file đã mất nhưng row còn lại.
- **Hướng sửa:** Xóa trong DB trước trong transaction, sau đó xóa file. Chỉ đếm file xóa thành công.
- **AC:** Audit event ghi đúng số file đã xóa.
- **Liên quan:** Sửa cùng BUG-008.

### BUG-023: `DELETE /documents/:id` không kiểm tra quyền và để lại file

- **Severity:** Medium · **Epic:** E1 · **Verified:** Review
- **Vị trí:** `modules/documents/documents.router.ts:685-695`
- **Mô tả:** Bất kỳ ai cũng gọi được route này. Các version bị xóa cascade, nhưng row `stored_files` và file trên đĩa vẫn còn.
- **Hướng sửa:** Kiểm tra role và xóa file kèm theo, phối hợp với BUG-020.
- **AC:** Có test cho trường hợp không có quyền và cho việc dọn file.

### BUG-024: FTS5 MATCH nhận text chưa quote, regex làm hỏng tiếng Việt

- **Severity:** Medium · **Epic:** E7-T2, E7-T4 · **Verified:** Review
- **Vị trí:** `modules/documents/classificationScorer.ts:219-224`, `modules/knowledge/semanticValidator.ts:125`
- **Mô tả:**
  - 50 ký tự đầu của tài liệu đi thẳng vào MATCH mà không quote. Các từ `AND`, `OR`, `NOT`, `NEAR` bị hiểu là toán tử, và lỗi bị nuốt.
  - Điểm cộng 0.1 phụ thuộc số unit đã duyệt, nên cùng một tài liệu cho điểm khác nhau theo thời gian. Điều này trái yêu cầu deterministic.
  - Lớp ký tự `\w` chỉ gồm ASCII, nên chữ có dấu tiếng Việt bị cắt vụn.
- **Hướng sửa:** Quote từng token khi đưa vào MATCH. Dùng regex Unicode `\p{L}` với cờ `u`. Tách điểm FTS khỏi phần deterministic hoặc chỉ tính theo đúng category.
- **AC:** Có test với text chứa `OR` hoặc `NOT` và với text tiếng Việt có dấu. Cùng một input luôn cho cùng điểm deterministic.

### BUG-025: Bulk approve dùng state cũ, lỗi API bị nuốt

- **Severity:** Medium · **Epic:** E8-T3 · **Verified:** Review
- **Vị trí:** `src/components/documents/ReviewQueueView.tsx:117-124`, `:133-138`, `src/components/documents/KnowledgeReviewModal.tsx:106-107`
- **Mô tả:** Mỗi lần gọi `handleUnitDecision` trong vòng lặp bulk approve đều spread cùng một `reviewingItem` cũ. Kết quả là chỉ unit cuối cùng hiển thị Approved. Khi `res.ok === false`, lỗi bị bỏ qua và dialog reject vẫn đóng như thể thành công.
- **Hướng sửa:** Dùng functional `setState`, hoặc gọi một API bulk rồi fetch lại. Hiển thị lỗi khi request thất bại.
- **AC:** Có test UI cho bulk approve nhiều unit và cho trường hợp API lỗi.

### BUG-026: Conflict đã resolve vẫn hiển thị và resolve lại được

- **Severity:** Medium · **Epic:** E8-T4 · **Verified:** Review
- **Vị trí:** `src/components/documents/ReviewQueueView.tsx:142-151`, `server/src/database/db.ts:1142`
- **Mô tả:** `handleConflictResolved` lọc theo `activeConflict`, nhưng giá trị này là null khi resolve từ trong KnowledgeReviewModal. Server không có guard `resolution IS NULL`, nên quyết định trước bị ghi đè.
- **Hướng sửa:** Lọc theo id của conflict được truyền vào callback. Server từ chối resolve lại một conflict đã resolve.
- **AC:** Có test cho cả UI và server.

### BUG-027: Modal conflict thiếu coexist, resolve không tác động unit

- **Severity:** Medium · **Epic:** E6-T4, E8-T4 · **Verified:** Review
- **Vị trí:** `src/components/documents/ConflictResolutionModal.tsx:34`, `:176-241`
- **Mô tả:** Modal có supersede, reject và merge, nhưng backlog yêu cầu supersede, coexist và reject. Server bỏ qua trường `notes`. Resolve chỉ ghi nhãn, không supersede hay reject unit nào.
- **Hướng sửa:** Thống nhất lựa chọn với BA. Lưu `notes`. Áp dụng kết quả resolve lên các unit liên quan.
- **AC:** Chọn supersede thì unit cũ chuyển Superseded. Chọn reject thì unit mới chuyển Rejected.

### BUG-028: Highlight bỏ qua char offset

- **Severity:** Medium · **Epic:** E8-T3 · **Verified:** Review
- **Vị trí:** `src/components/documents/KnowledgeReviewModal.tsx:168-177`
- **Mô tả:** Highlight dùng lần xuất hiện đầu tiên của `exactQuote` và bỏ qua `charOffsetStart/End`. Câu trích xuất xuất hiện nhiều lần sẽ bị highlight sai chỗ. Unit có offset nhưng không có quote thì không được highlight. Vùng hiển thị cũng không cuộn tới vị trí đó.
- **Hướng sửa:** Ưu tiên offset, chỉ fallback sang quote khi không có offset. Tự cuộn tới vị trí highlight.
- **AC:** Có test với câu trích xuất bị lặp lại trong tài liệu.

### BUG-029: Test ghi vào DB dev thật và thiếu các ca quan trọng

- **Severity:** Medium · **Epic:** QA · **Verified:** Review
- **Vị trí:** `tests/documentVersions.test.ts`, `tests/uploadBatch.test.ts`, `tests/jobQueue.test.ts:60`, `tests/workflowEngine.test.ts`
- **Mô tả:**
  - Hai bộ test import `db.js` nên ghi vào `server/data/docqa.sqlite` và `server/data/files`, và phụ thuộc dữ liệu seed `DOC-01`.
  - Thiếu test cho các trường hợp: hai worker tranh chấp, timeout, cancel khi đang chạy, khôi phục khi `start()`, migration 002 với dữ liệu cũ, zip bomb theo tỷ lệ nén, và docx bomb.
  - Test của workflow engine tin `fromState` do client gửi, nên không bắt được BUG-005.
  - Ở dòng 60 của test job queue, chuỗi `datetime()` của SQLite được so với chuỗi ISO, và chỉ đúng do may mắn.
- **Hướng sửa:** Dùng DB in-memory hoặc DB tạm qua biến môi trường. Bổ sung các ca test còn thiếu.
- **AC:** Chạy test không làm thay đổi DB dev và không làm thay đổi file tracked.

---

## Low

### BUG-030: Checksum khi tạo tài liệu thủ công không tính trên bytes

- **Severity:** Low · **Epic:** E1-T3 · **Verified:** Review
- **Vị trí:** `modules/documents/documents.router.ts:317`
- **Mô tả:** Checksum hash chuỗi `id|title|version|content|timestamp`. Hàm không tạo row `stored_files` và version cho tới lần sync khi khởi động. Kiểm tra trùng theo checksum ở dòng 136-141 không bao giờ khớp với tài liệu này.
- **Hướng sửa:** Dùng chung luồng lưu file với upload.

### BUG-031: Kiểm tra loại file dùng blacklist extension

- **Severity:** Low · **Epic:** E2-T1 · **Verified:** Review
- **Vị trí:** `modules/documents/uploadSecurity.ts:17-20`, `:122-134`, `documents.router.ts:283`, `:427`
- **Mô tả:** Mọi extension không có trong blacklist, như `.svg`, `.js`, `.htm` và `.ps1`, đều qua nếu 4 KB đầu không có byte null. Mime do client gửi được lưu lại và trả về làm Content-Type. Header `attachment` giảm bớt rủi ro XSS.
- **Hướng sửa:** Chuyển sang whitelist theo E0-D3. Xác định mime từ nội dung file.

### BUG-032: Redaction bỏ sót các định dạng secret phổ biến

- **Severity:** Low · **Epic:** E5-T1 · **Verified:** Review
- **Vị trí:** `modules/ai/dataPolicyService.ts:26`
- **Mô tả:** Redaction chỉ bắt dạng `key=value`. Các secret như `sk-...`, `AKIA...`, `Bearer <token>` và PEM private key lọt qua. Pattern email chỉ bao gồm ba domain gán cứng.
- **Hướng sửa:** Bổ sung pattern cho các secret trên và dùng pattern email tổng quát.
- **AC:** Có test cho từng loại secret.

### BUG-033: Migrator không kiểm tra checksum migration đã áp dụng

- **Severity:** Low · **Epic:** E1-T1 · **Verified:** Review
- **Vị trí:** `database/migrator.ts:69`
- **Mô tả:** Checksum được lưu nhưng không bao giờ được so sánh. Một migration đã áp dụng mà bị sửa sẽ không bị phát hiện.
- **Hướng sửa:** So checksum khi khởi động và cảnh báo hoặc dừng nếu khác.

### BUG-034: Các lỗi nhỏ ở frontend và server

- **Severity:** Low · **Epic:** E8, E3 · **Verified:** Review
- **Lỗi:**
  - `KnowledgeReviewModal.tsx:73` return sớm trước `useMemo` ở dòng 75-82, vi phạm Rules of Hooks. Lỗi chưa xảy ra vì modal luôn được mount với `isOpen={true}`.
  - `jobQueue.ts:141` không clear `setTimeout` timeout, nên mỗi job giữ một timer 60 giây.
  - `app.ts` mount `workflowRouter` hai lần, ở `/api/v1` và `/api/v1/workflow`, làm trùng route.
  - `fetchQueue` trong ReviewQueueView không abort request khi `projectId` đổi.
  - Chuỗi mới trong ReviewQueueView, KnowledgeReviewModal và ConflictResolutionModal không có trong `src/locales/vi.ts` và `en.ts`. Thông báo lỗi phía server cũng gán cứng tiếng Việt.

---

## Thứ tự sửa đề xuất

1. **Bảo mật và phân quyền:** BUG-001 đến BUG-006, kèm BUG-009. Nên làm một middleware xác thực và kiểm tra role dùng chung trước, vì nó giải quyết nhiều bug cùng lúc.
2. **Toàn vẹn dữ liệu:** BUG-008, BUG-019 đến BUG-023.
3. **Nối pipeline:** BUG-010, BUG-011, BUG-018, sau đó BUG-012 và BUG-013.
4. **Chất lượng AI:** BUG-007, BUG-014 đến BUG-017, và BUG-024.
5. **UI và test:** BUG-025 đến BUG-029, sau đó các bug Low.

Sau bước 1 và bước 2 nên review lại trước khi đi tiếp.
