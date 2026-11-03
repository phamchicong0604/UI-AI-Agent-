# Backlog: AI Document Pipeline & Knowledge Layer

Trạng thái: Draft, cần Tech Lead và PM review trước khi đưa vào sprint.
Nguồn: Bản đánh giá kiến trúc 6 lớp và góp ý đối chiếu với code hiện tại của UI-QA.

## Quy ước

| Trường | Ý nghĩa |
|---|---|
| ID | `E<epic>-T<task>`, subtask đánh số `.1 .2 ...` |
| Priority | P0 nền tảng, làm trước. P1 tính năng lõi. P2 mở rộng |
| Size | S ≤ 1 ngày, M 2–3 ngày, L 4–5 ngày. **Là ước lượng sơ bộ, Tech Lead phải xác nhận lại** |
| Role | BE, FE, AI, QA, BA, TL |
| DoD chung | Có unit test, `npm run test:all` pass, không commit secret, có audit event cho thao tác thay đổi dữ liệu, cập nhật README hoặc spec liên quan |

## Thứ tự triển khai đề xuất

```text
E0 (quyết định) ──> E1 (data model) ──> E2 (upload) ──> E3 (workflow)
                         │                                  │
                         └──> E5 (AI security) ──> E4 (skills) ──> E6 (knowledge) ──> E7 (scoring)
                                                                         │
E9 (evaluation) bắt đầu song song từ khi có E4-T1 ─────────────────────────┤
                                                                         v
                                                              E8 (review UI) ──> E10 (ops)
```

---

## E0. Quyết định cần chốt (Blocker, không phải task code)

Owner: PM + TL. Phải xong trước khi bắt đầu E1.

| ID | Quyết định | Phương án khuyến nghị | Ảnh hưởng |
|---|---|---|---|
| E0-D1 | SQLite hay Postgres | Giữ SQLite + migration có version + FTS5 cho MVP | E1, E6, E7 |
| E0-D2 | Nơi lưu file gốc | Local disk dưới `server/data/files`, interface cho phép đổi sang object storage sau | E1, E2 |
| E0-D3 | Phạm vi định dạng MVP | md, txt, json, zip, docx, pdf có text layer. OCR ảnh scan để P2 | E2 |
| E0-D4 | Chính sách provider theo project | Mỗi project chọn: Offline only, Approved providers, hoặc Any | E5 |
| E0-D5 | Vai trò của Atomic Knowledge Unit | Là lớp ứng viên, promote sang Requirement và BusinessRule khi Approved | E6 |
| E0-D6 | Thứ tự ưu tiên nguồn Knowledge | Dùng thứ tự trong bản đánh giá, cho Project Admin cấu hình | E6, E7 |

---

## E1. Data Model & Storage Foundation (P0) — [HOÀN THÀNH / COMPLETED]

Mục tiêu: chuyển document từ JSON blob sang mô hình quan hệ, giữ file gốc làm Source of Truth.
File chính: `server/src/database/db.ts`, `server/src/common/types.ts`.

### E1-T1. Cơ chế migration có version [HOÀN THÀNH] — BE, M
- [x] .1 Tạo bảng `schema_migrations` và runner chạy các file migration theo thứ tự.
- [x] .2 Chuyển các lệnh `ALTER TABLE` rải rác hiện tại thành migration số 001.
- [x] .3 Test: chạy migration trên DB rỗng và trên DB có dữ liệu cũ (`server/src/tests/migrator.test.ts`).

AC: Server khởi động áp dụng migration còn thiếu đúng một lần. Migration lỗi thì rollback và không khởi động.

### E1-T2. Viết `DOCUMENT-DATA-MODEL.md` và ERD [HOÀN THÀNH] — TL + BA, M
- [x] .1 Gộp entity của bản đánh giá với Proposal mục 9, loại bỏ trùng lặp.
- [x] .2 Định nghĩa khóa, quan hệ nhiều-nhiều, chính sách xóa cascade.
- [x] .3 Review với BA và QA (`docs/DOCUMENT-DATA-MODEL.md`).

AC: ERD được TL và BA duyệt. Mỗi entity có owner module và ghi chú lifecycle.

### E1-T3. Bảng `document_versions` và `stored_files` [HOÀN THÀNH] — BE, L
Phụ thuộc: E1-T1, E0-D2.
- [x] .1 Tạo bảng `stored_files` gồm storage_key, mime, size_bytes, sha256 tính trên bytes gốc.
- [x] .2 Tạo bảng `document_versions` gồm document_id, version_no, file_id, extracted_content, status, created_by.
- [x] .3 Viết module `FileStore` với interface `put/get/delete`, bản local disk (`server/src/common/fileStore.ts`).
- [x] .4 Migration chuyển `versions[]` trong JSON hiện có sang bảng mới (Migration 002).
- [x] .5 Sửa checksum: tính trên nội dung file, không tính trên chuỗi id, title, timestamp.

AC: Tải lại được file gốc byte-for-byte từ mọi version. Checksum giống nhau cho cùng một file. Dữ liệu cũ vẫn hiển thị đúng.

### E1-T4. Bảng traceability cho AI [HOÀN THÀNH] — BE, M
Phụ thuộc: E1-T1.
- [x] .1 `skills`, `skill_versions` gồm prompt hash, input schema, output schema (Migration 003).
- [x] .2 `pipeline_runs` gồm document_version_id, skill_version_id, model_id, status, tokens, latency, error.
- [x] .3 `review_decisions` gồm target_type, target_id, decision, reviewer, comment.
- [x] .4 `document_relationships` gồm source, target, type như duplicate_of, version_of, references.

AC: Mọi output AI truy ngược được về document_version, skill_version và model_id.

---

## E2. Upload Hardening & File Processing (P0) — [HOÀN THÀNH]

File chính: `server/src/modules/documents/documents.router.ts`, `server/src/modules/documents/uploadSecurity.ts`, `server/src/modules/documents/parsers/`.

### E2-T1. Bảo vệ upload — BE, M — [HOÀN THÀNH]
- .1 Giới hạn kích thước file (50MB) và tổng dung lượng zip sau giải nén (100MB).
- .2 Chặn zip bomb theo tỷ lệ nén (> 50:1) và số entry (> 500 entries).
- .3 Chặn path traversal trong tên entry zip (`../`, absolute paths, drive letters).
- .4 Whitelist mime theo nội dung (magic byte header `%PDF-`, `PK\x03\x04`, OpenXML structure, binary null-byte masking detection).

AC: Đã triển khai tại `uploadSecurity.ts` và được kiểm thử toàn diện với 7/7 unit tests tại `server/src/tests/uploadSecurity.test.ts`.

### E2-T2. Upload batch — BE, M — [HOÀN THÀNH]
Phụ thuộc: E1-T3.
- .1 Migration `004_upload_batches.ts` tạo bảng `upload_batches` (id, project_id, filename, total_files, processed_files, failed_files, status, error_summary, batch_details, created_at).
- .2 Zip nhiều file: file lỗi được cô lập, không làm hỏng cả batch, batch có trạng thái PARTIAL, cung cấp endpoint `GET /batches/:id` và `GET /batches/project/:projectId`.
- .3 Phát hiện trùng bằng sha256 trong cùng project, ghi nhận vào `document_relationships` với `relationship_type = 'duplicate_of'` thay vì tạo document mới.

AC: Đã kiểm thử với test suite tại `server/src/tests/uploadBatch.test.ts` (xử lý gói ZIP có 1 file lỗi trong 5 files tạo thành công 4 files với status PARTIAL, và upload file trùng sha256 phát hiện duplicate_of).

### E2-T3. Parser docx và pdf — BE, L — [HOÀN THÀNH]
Phụ thuộc: E0-D3.
- .1 Interface `IDocumentParser` và `ParseResult` trả rawText, markdownText, headings với character offsets.
- .2 `DocxParser` phân tích cú pháp OpenXML paragraph/heading trích xuất markdown có heading path và character offset; `PdfParser` sử dụng `pdf-parse` trích xuất nội dung có phân cấp heading.
- .3 PDF không có text layer (scanned/empty) gắn cờ cảnh báo `NEEDS_OCR` và `hasTextLayer: false`, gắn tag `NEEDS_OCR` vào document để ngăn gọi AI vô ích.

AC: Đã triển khai tại `server/src/modules/documents/parsers/` và kiểm thử toàn diện với 4/4 unit tests tại `server/src/tests/parsers.test.ts`.

---

## E3. Workflow Orchestration & Job Queue (P1) — [HOÀN THÀNH]

### E3-T1. Viết `WORKFLOW-STATE-MACHINE.md` — TL, S — [HOÀN THÀNH]
- .1 11 Trạng thái chuẩn: UPLOADED, FILE_PROCESSING, AI_ANALYSIS, VALIDATION, REVIEW_REQUIRED, ORGANIZED, FEEDBACK_REQUIRED, REANALYSIS, FAILED, CANCELLED, SUPERSEDED.
- .2 Bảng ma trận chuyển trạng thái hợp lệ, điều kiện tiên quyết và phân quyền role được phép thực hiện (`docs/WORKFLOW-STATE-MACHINE.md`).

AC: Đã hoàn tất tài liệu đặc tả FSM kèm sơ đồ Mermaid state diagram tại `docs/WORKFLOW-STATE-MACHINE.md`.

### E3-T2. Job queue trên SQLite — BE, L — [HOÀN THÀNH]
Phụ thuộc: E1-T4.
- .1 Migration `005_job_queue.ts` tạo bảng `jobs` (id, type, payload, status, attempts, max_attempts, locked_by, locked_at, next_run_at, last_error, result, created_at, updated_at).
- .2 Worker in-process `SqliteJobQueue` (`server/src/modules/workflow/jobQueue.ts`) với cơ chế poll & lock an toàn trong transaction.
- .3 Retry có backoff hàm mũ, giới hạn số lần (`max_attempts`), timeout từng stage (`stageTimeoutMs`).
- .4 API hủy job (`POST /api/v1/jobs/:id/cancel`), retry job (`POST /api/v1/jobs/:id/retry`).
- .5 Phục hồi tự động khi crash server (`resetStaleLocks` đưa job RUNNING quá hạn về PENDING).

AC: Đã kiểm thử 4/4 tests tại `server/src/tests/jobQueue.test.ts`.

### E3-T3. Workflow engine — BE, L — [HOÀN THÀNH]
Phụ thuộc: E3-T1, E3-T2.
- .1 `WorkflowEngine` (`server/src/modules/workflow/workflowEngine.ts`) thực thi state machine, chặn chuyển trạng thái không hợp lệ qua `WorkflowTransitionError`.
- .2 Cô lập giai đoạn (Stage Isolation): API `PATCH /api/v1/workflow/documents/:id/category` cho phép cập nhật Document Type/Category mà không chạy lại giai đoạn Understanding.
- .3 Phương thức `supersedePreviousVersions` tự động chuyển các bản cũ đang review/pending sang `SUPERSEDED` khi có phiên bản mới.
- .4 Ghi nhận `AuditEvent` có mã băm xích SHA-256 (`computeAuditEventHash`, `previousEventHash`) cho mọi lần chuyển trạng thái.

AC: Đã kiểm thử 5/5 tests tại `server/src/tests/workflowEngine.test.ts`. Khi reviewer chỉ sửa Document Type, hệ thống không chạy lại Understanding.

---

## E4. AI Skill Contracts (P1)

File chính: `server/src/modules/ai/`.

### E4-T1. Viết `AI-SKILL-CONTRACTS.md` — AI + BA, M
- .1 Định nghĩa 6 Skill: Intake, Understanding, Extraction, Classification, Semantic Validation, Organization.
- .2 JSON Schema input và output cho từng Skill.
- .3 Mỗi item trích xuất bắt buộc có `evidence_level` và `source_anchor`.
- .4 Định nghĩa 6 mức evidence_level: Explicit, Inferred, Assumed, Not Specified, Conflict, Unknown.

AC: BA xác nhận schema đủ để review. Mọi field có mô tả và ví dụ.

### E4-T2. Skill registry có version — AI, M
Phụ thuộc: E1-T4, E4-T1.
- .1 Thư mục `server/src/modules/ai/skills/<skill>/` gồm prompt, schema, metadata.
- .2 Version tăng khi prompt hoặc schema đổi, lưu vào `skill_versions`.
- .3 Cache output theo khóa document_version_id, skill_version, model_id.

AC: Đổi prompt tạo skill_version mới. Chạy lại cùng input và cùng version thì lấy từ cache.

### E4-T3. Validate output và retry — AI, M
- .1 Validate output bằng JSON Schema, có thể dùng zod.
- .2 Output sai schema thì retry có giới hạn, sau đó đánh dấu FAILED.
- .3 Chặn mọi item có evidence_level khác Explicit được gán status Approved.

AC: Test với output hỏng, thiếu field và sai enum đều bị bắt.

### E4-T4. Chạy Stage 2 dạng gộp — AI, M
Phụ thuộc: E4-T2, E4-T3.
- .1 Một lần gọi model trả về output của Understanding, Extraction và Classification.
- .2 Tách thành lời gọi riêng chỉ khi E9 cho thấy chất lượng tốt hơn.

AC: Số lần gọi LLM mỗi tài liệu được ghi trong pipeline_runs.

---

## E5. AI Security & Data Policy (P0 tài liệu, P1 code)

### E5-T1. Viết `AI-DATA-POLICY.md` — TL + PM, S
- .1 Dữ liệu nào được gửi ra provider ngoài, theo từng project.
- .2 Chính sách retention cho file gốc, output AI và log gửi provider.
- .3 Quy tắc redaction cho dữ liệu nhạy cảm.

AC: PM và đại diện bảo mật duyệt.

### E5-T2. Provider policy theo project — BE, M
Phụ thuộc: E0-D4, E5-T1.
- .1 Thêm cấu hình policy vào bảng projects.
- .2 AI service kiểm tra policy trước mỗi lần gọi, chế độ Offline only dùng grounded engine.
- .3 Ghi log provider, model và kích thước dữ liệu đã gửi.

AC: Project Offline only không bao giờ phát sinh request ra ngoài, có test chứng minh.

### E5-T3. Chống prompt injection từ tài liệu — AI, M
- .1 Bọc nội dung tài liệu trong delimiter, system prompt khẳng định đây là dữ liệu.
- .2 Phát hiện và gắn cờ các đoạn có dạng chỉ thị cho AI.
- .3 Output không được chứa hành động ngoài schema đã định.

AC: Bộ test có tài liệu chứa chỉ thị nhúng, output vẫn đúng schema và có cờ cảnh báo.

---

## E6. Knowledge Layer & Governance (P1)

### E6-T1. Viết `KNOWLEDGE-GOVERNANCE.md` và `PROJECT-KNOWLEDGE-SPEC.md` — BA, M
- .1 Lifecycle Knowledge dùng lại StatusLifecycle hiện có, thêm Superseded.
- .2 Tách review status và evidence_level thành hai trường.
- .3 Thứ tự ưu tiên nguồn và quy tắc ghi đè.

AC: BA, PM duyệt. Có ví dụ cho từng trường hợp xung đột.

### E6-T2. Bảng Atomic Knowledge Unit — BE, L
Phụ thuộc: E1-T3, E4-T1, E6-T1.
- .1 Bảng `knowledge_units` gồm unit_type, content, subject, action, condition, evidence_level, status.
- .2 Bảng `knowledge_sources` gồm document_version_id, heading path, char offset, page.
- .3 API list, filter, approve, reject.

AC: Mỗi unit có ít nhất một nguồn trỏ về vị trí cụ thể trong document version.

### E6-T3. Promote unit sang Requirement và BusinessRule — BE, M
Phụ thuộc: E6-T2.
- .1 Khi unit được Approved, tạo hoặc cập nhật Requirement hay BusinessRule.
- .2 Ghi `sourceReferences` trỏ về unit và document version.
- .3 Trace matrix hiện có vẫn hoạt động.

AC: Không có hai bản ghi sự thật cho cùng một rule. Trace matrix hiển thị nguồn đến tận unit.

### E6-T4. Conflict record và supersede — BE, M
Phụ thuộc: E6-T2.
- .1 Bảng `conflicts` gồm unit_a, unit_b, conflict_type, resolution, resolved_by.
- .2 Version mới Approved thì unit cũ chuyển Superseded.
- .3 Gọi Change Impact hiện có để đánh dấu Test Case liên quan sang In Review.

AC: Critical conflict luôn chặn ORGANIZED cho đến khi có người xử lý.

---

## E7. Semantic Validation & Scoring (P1)

### E7-T1. Viết `AI-CLASSIFICATION-RULES.md` và `DOCUMENT-TAXONOMY.md` — BA, M
- .1 Danh mục loại tài liệu, map vào 8 thư mục hiện có.
- .2 Từ khóa và cấu trúc nhận diện từng loại.
- .3 Quy tắc xử lý tài liệu đa mục đích và không rõ loại.

AC: BA duyệt, có ít nhất 3 ví dụ cho mỗi loại.

### E7-T2. Classification Score phần deterministic — BE, M
Phụ thuộc: E7-T1.
- .1 Code tính filename match, structure match, taxonomy keyword match.
- .2 FTS5 similarity với tài liệu Approved cùng project.
- .3 LLM chỉ đóng góp nhãn kèm evidence span, không tự chấm điểm.
- .4 Trọng số đặt trong config, không hard-code.

AC: Cùng input luôn cho cùng điểm phần deterministic.

### E7-T3. Semantic Risk Score — BE + AI, M
Phụ thuộc: E6-T4.
- .1 Đếm critical conflict, ambiguity, unknown term, unsupported inference.
- .2 Áp công thức có giới hạn 100.
- .3 Điểm chỉ dùng để xếp thứ tự hàng review, không dùng để auto-approve.

AC: Có test cho từng thành phần. Không có đường code nào auto-approve dựa trên điểm.

### E7-T4. Kiểm tra với Knowledge đã duyệt — BE, M
Phụ thuộc: E6-T2.
- .1 Truy vấn có cấu trúc trên unit Approved theo project và taxonomy.
- .2 Dùng FTS5 cho tìm kiếm thuật ngữ. Chưa dùng vector DB.

AC: Chỉ unit Approved được dùng làm căn cứ phát hiện xung đột.

---

## E8. Human Review UI (P1)

File chính: `src/components/documents/`.

### E8-T1. Wireframe và AC cho màn Review — BA + FE, M
- .1 Hàng đợi review sắp xếp theo risk score.
- .2 Màn chi tiết: tài liệu gốc bên trái, unit trích xuất bên phải.

AC: BA và QA duyệt wireframe.

### E8-T2. Review Queue — FE, M
Phụ thuộc: E3-T3, E8-T1.
- .1 Danh sách document ở REVIEW_REQUIRED, lọc theo project, loại, risk.
- .2 Hiển thị trạng thái workflow và lỗi của từng stage.

### E8-T3. Màn duyệt Knowledge Unit — FE, L
Phụ thuộc: E6-T2.
- .1 Click unit thì highlight đúng vị trí trong tài liệu gốc.
- .2 Badge evidence_level, phân biệt rõ Explicit với Inferred và Assumed.
- .3 Approve, Reject, Request Change từng unit hoặc hàng loạt.
- .4 Bắt buộc nhập lý do khi Reject.

AC: Không thể approve hàng loạt các unit có evidence_level khác Explicit.

### E8-T4. Diff View và Conflict Resolution — FE, L
Phụ thuộc: E6-T4.
- .1 So sánh hai document version.
- .2 Màn xử lý conflict với ba lựa chọn supersede, coexist, reject.

### E8-T5. Review History — FE, S
- .1 Timeline quyết định review của document và unit, lấy từ review_decisions và audit.

---

## E9. Evaluation Framework (P1, bắt đầu sớm)

### E9-T1. Viết `EVAL-DATASET-SPEC.md` — QA + BA, M
- .1 Định dạng test case và expected output.
- .2 Danh sách case tối thiểu DOC-EVAL-01 đến 08 trong bản đánh giá.
- .3 Bắt buộc có tài liệu tiếng Việt và tài liệu song ngữ.

AC: Dữ liệu mẫu không chứa dữ liệu khách hàng thật.

### E9-T2. Xây dataset đã gán nhãn — BA + QA, L
Phụ thuộc: E9-T1, E4-T1.
- .1 Tối thiểu số lượng tài liệu do BA quyết định, mỗi tài liệu có nhãn đã được người duyệt.
- .2 Lưu trong repo dưới `server/src/tests/eval/`, có version.

### E9-T3. Eval runner — AI + QA, M
Phụ thuộc: E9-T2, E4-T3.
- .1 Lệnh chạy eval qua vitest, xuất báo cáo metric.
- .2 Metric: classification accuracy, multi-label F1, extraction precision và recall, conflict detection precision và recall, tokens, latency.
- .3 Lưu baseline, so sánh khi đổi skill_version hoặc model.

AC: Đổi prompt mà metric giảm quá ngưỡng thì eval báo fail.

### E9-T4. Hiệu chỉnh trọng số scoring — AI + BA, M
Phụ thuộc: E9-T3, E7-T2, E7-T3.
- .1 Dùng dataset để chỉnh trọng số, ghi lại kết quả trước và sau.

---

## E10. Observability & Retention (P2)

### E10-T1. Dashboard AI usage — FE + BE, M
- .1 Tokens, chi phí ước tính, latency, tỷ lệ lỗi theo skill và model.
- .2 Nối với quota service hiện có.

### E10-T2. Human Correction Rate — BE, S
- .1 Đo tỷ lệ output AI bị reviewer sửa hoặc reject theo skill_version.

### E10-T3. Retention và xóa dữ liệu — BE, M
Phụ thuộc: E5-T1.
- .1 Job xóa theo chính sách retention.
- .2 Xóa project thì xóa cascade file gốc, output AI và log.
- .3 Audit event cho mọi thao tác xóa.

### E10-T4. OCR cho PDF scan — BE, L
Phụ thuộc: E0-D3, E2-T3.

---

## Rủi ro chính

| Rủi ro | Giảm thiểu |
|---|---|
| Migration làm hỏng dữ liệu document hiện có | Backup DB trước migration, test trên bản sao dữ liệu thật |
| Prompt thay đổi liên tục vì chưa có taxonomy | Làm E7-T1 và E4-T1 trước khi viết prompt |
| Điểm số bị hiểu là độ chính xác | Ghi rõ trên UI rằng điểm chỉ để xếp ưu tiên review |
| Gửi dữ liệu khách hàng ra provider ngoài | E5 phải xong trước khi bật provider ngoài cho project thật |
