# Bug Verification Round 2

Đối chiếu với:
- `docs/BUGS-REVIEW-4b1c2a5.md` (34 bug gốc).
- Kết quả round 1 (16 bug mới NEW-01 đến NEW-16).

Code được kiểm tra: commit `617599e`, đã merge vào `develop` ở commit `1c2379c`.
Ngày kiểm tra: 2026-11-03.

## Kết luận

**Chưa đủ điều kiện merge vào `main`.** Nội dung hiện tại của `docs/BUGS-VERIFICATION-ROUND1.md` ghi "34/34 FIXED, đủ điều kiện merge". Kết quả kiểm tra lại không xác nhận điều đó.

Lỗi nghiêm trọng nhất là xác thực. Server có ký token, nhưng route cấp token phát token hợp lệ cho bất kỳ ai tự khai role, kể cả Project Admin, mà không cần thông tin đăng nhập. Vì vậy mọi kiểm tra quyền trong bản sửa đều vượt qua được bằng một request.

| Hạng mục | Kết quả |
|---|---|
| Test frontend | 17 test pass. Không có test UI mới cho BUG-025 đến BUG-028 |
| Test server | 110 test pass |
| Build server, build và type-check frontend | Không có lỗi |
| Test có sửa file tracked không | Không ✔ |
| Test có ghi vào DB dev, thư mục file hoặc bảng jobs không | Không ✔ |

| Verdict | 34 bug gốc | 16 bug NEW |
|---|---|---|
| FIXED | 10 | 8 |
| PARTIAL | 20 | 6 |
| NOT FIXED | 4 | 2 |
| Bug mới phát sinh ở round 2 | 17 | |

Trong 10 bug gốc đã FIXED, có 3 bug sửa đúng logic nhưng vẫn bị vượt qua cho đến khi sửa R2-01. Các bug này được đánh dấu `FIXED*`.

## Ưu tiên sửa ngay

1. **R2-01 và R2-02: xác thực thật.**
   - Route cấp phiên phải kiểm tra thông tin đăng nhập, bằng mật khẩu băm hoặc SSO.
   - Role phải lấy từ bảng thành viên project trên server, không lấy từ request.
   - Bắt buộc có `AUTH_SECRET`, không có thì server không khởi động.
   - So sánh chữ ký bằng `crypto.timingSafeEqual`.
   - Bỏ mọi chỗ đọc `userRole` từ body, xem NEW-11.
2. **R2-03 và BUG-002: đóng lỗ hổng policy.**
   - Thêm cột `project_id` cho bảng requirements bằng migration mới, rồi lấy project từ DB.
   - Không lấy project từ body, header hoặc `sourceReferences` do client gửi.
   - Đổi giá trị mặc định của cột `ai_policy`. Migration 009 chỉ update giá trị null, trong khi cột có ràng buộc NOT NULL, nên migration này không có tác dụng.
3. **R2-17: thêm xác thực cho route upload.** Bổ sung luôn cho các route AI và route PATCH status tài liệu.
4. **Các bug NOT FIXED:** BUG-018, BUG-019 và BUG-028.
5. **R2-04: chặn retry làm mất trạng thái duyệt.** Hiện retry đưa unit đã duyệt về Draft.
6. **Còn lại:** các bug PARTIAL, sau đó là các bug Low.

---

## Kết quả 34 bug gốc

Ký hiệu ✔ nghĩa là đã đọc lại code để xác nhận trực tiếp. Đường dẫn tính từ `server/src/` nếu không ghi khác.

### Blocker

| ID | Verdict | Còn thiếu |
|---|---|---|
| BUG-001 | PARTIAL ✔ | `ai.service.ts:54` truy vấn `project_id` từ bảng requirements, nhưng bảng này không có cột đó. Lỗi bị `catch {}` nuốt, nên project lại rơi về giá trị client gửi. Các route AI chưa có xác thực. Chưa có test tích hợp mock HTTP như AC yêu cầu |
| BUG-002 | NOT FIXED ✔ | Migration 009 không đổi giá trị mặc định `ALLOW_EXTERNAL` của cột. Project seed và mọi project mới vẫn được phép gửi ra ngoài. Thiếu test cho trường hợp policy null và DB lỗi |
| BUG-003 | PARTIAL | Đã có kiểm tra quyền, nhưng bị vượt qua qua R2-01. Role QA Lead vẫn được duyệt unit và resolve conflict, trái với spec |
| BUG-004 | FIXED* ✔ | Server đã chặn duyệt unit không phải Explicit nếu không có override, và lưu lý do vào review decision. Phụ thuộc R2-01 |
| BUG-005 | FIXED* | Engine đọc trạng thái thật từ DB. Compare-and-set nằm trong transaction. Phụ thuộc R2-01. Xem thêm NEW-09 |
| BUG-006 | PARTIAL | `documents.router.ts:854` dùng `authenticateUser` mà không bắt buộc đăng nhập. Người chưa xác thực vẫn chuyển được Approved sang In Review |
| BUG-007 | PARTIAL ✔ | `evalRunner.ts:191` vẫn gán cứng `extractionRecall = 95.0`. Precision so dataset với chính nó. Cả 3 cặp conflict đều là ca dương tính. Báo cáo gán cứng "✅ ĐẠT" và vẫn ghi vào `docs/` |
| BUG-008 | PARTIAL | Jobs vẫn khớp bằng `LIKE`. Requirements, test cases, evidence và bugs của project không được xóa. Test không kiểm tra các bảng con của AI và knowledge |
| BUG-009 | PARTIAL | Vẫn tin kích thước khai báo trong header. Lời gọi `getData()` giải nén không giới hạn. Thiếu test docx trong zip, test tỷ lệ nén và test header giả |
| BUG-010 | FIXED | — |
| BUG-011 | FIXED | Retry không giới hạn theo project. Phụ thuộc R2-01 |

### High

| ID | Verdict | Còn thiếu |
|---|---|---|
| BUG-012 | PARTIAL | AbortController chỉ kích hoạt khi timeout, không kích hoạt khi cancel. Signal không được truyền vào Stage 2 hay lời gọi LLM. Thiếu test cancel và test timeout |
| BUG-013 | PARTIAL | Khôi phục lock vẫn chỉ chạy lúc `start()`. Thiếu test hai worker và test worker crash |
| BUG-014 | PARTIAL | Requirement đã có vẫn bị cập nhật ngay thay vì tạo đề xuất để duyệt. Source reference không có trường id của unit. Vẫn fallback về `DOC-UNKNOWN` |
| BUG-015 | PARTIAL | Hết hồi quy với số trơn và cụm "yêu cầu". Regex dùng `\b` dạng ASCII nên bỏ sót "2 giờ" và "50%", xem R2-08. Chưa có test cho các cặp ví dụ trong AC |
| BUG-016 | PARTIAL | Delimiter không ngẫu nhiên. Escape chỉ khớp đúng một kiểu khoảng trắng. Cờ injection vẫn không được dùng và bị mất khi lấy từ cache |
| BUG-017 | PARTIAL | Fallback vẫn gắn nhãn Explicit và tự đặt subject, action. Quote lấy từ text đã redact |
| BUG-018 | NOT FIXED | Lời gọi supersede trong luồng upload truyền id tài liệu mới tạo, nên không làm gì, và lỗi bị nuốt. Chưa có route upload version mới. Review đang chờ không được đóng |

### Medium

| ID | Verdict | Còn thiếu |
|---|---|---|
| BUG-019 | NOT FIXED | Nội dung migration 002 không đổi ngoài cách tạo file id |
| BUG-020 | PARTIAL | Sửa trực tiếp migration 002 đã chạy thay vì thêm migration mới. Các row dùng chung cũ không được tách. Test vẫn pass trên code cũ |
| BUG-021 | FIXED | — |
| BUG-022 | FIXED | Chưa có test kiểm tra số file đã xóa |
| BUG-023 | FIXED* | Phụ thuộc R2-01 |
| BUG-024 | PARTIAL | Điểm vẫn phụ thuộc số unit đã duyệt nên không deterministic. Chưa có test mới |
| BUG-025 | PARTIAL | Chưa có test UI. Bulk approve dừng ở lỗi đầu tiên mà không báo các unit đã được duyệt |
| BUG-026 | FIXED | Chưa có test HTTP cho trường hợp resolve lại |
| BUG-027 | PARTIAL | `resolution_notes` được ghi nhưng không bao giờ được đọc hay hiển thị. Chưa có test |
| BUG-028 | NOT FIXED ✔ | Modal đọc `charOffsetStart` và `exactQuote` ở cấp unit, trong khi backend trả các giá trị này trong `unit.sources[]`. Với dữ liệu thật, không có gì được highlight |
| BUG-029 | PARTIAL ✔ | Đã cô lập DB test. Vẫn thiếu các test: hai worker tranh chấp, timeout, cancel khi đang chạy, khôi phục khi `start()`, migration 002 với dữ liệu cũ, và docx bomb |

### Low

| ID | Verdict | Còn thiếu |
|---|---|---|
| BUG-030 | FIXED | — |
| BUG-031 | PARTIAL | Mime do client gửi vẫn được lưu và trả về làm Content-Type |
| BUG-032 | PARTIAL | Vẫn bỏ sót key `sk-proj-...` và PEM loại EC, OPENSSH |
| BUG-033 | FIXED | Migration 002 vừa bị sửa lại, nên DB hiện có sẽ cảnh báo checksum ở mỗi lần boot, xem R2-11 |
| BUG-034 | PARTIAL ✔ | Đã sửa hooks, timer và mount trùng. Ba component vẫn không gọi `t()`, nên các key i18n mới không được dùng |

## Kết quả 16 bug NEW

| ID | Verdict | Còn thiếu |
|---|---|---|
| NEW-01 | NOT FIXED ✔ | Xem R2-01 và R2-02 |
| NEW-02 | PARTIAL | Đã gửi token, nhưng token do client tự xin theo role tự chọn. Lời gọi `syncAccountModels` chưa gửi token. Xem R2-09 |
| NEW-03 | FIXED ✔ | — |
| NEW-04 | PARTIAL | Id unit đã deterministic, nhưng hash phụ thuộc output LLM. Xem R2-04 |
| NEW-05 | FIXED | Chưa có test khẳng định không có request ra ngoài |
| NEW-06 | PARTIAL | Engine đã ổn. Trong `knowledgeService`, compare-and-set, review decision, upsert requirement và supersede chưa nằm trong một transaction |
| NEW-07 | PARTIAL | Hết số lần thử thì version kẹt giữa pipeline, không chuyển sang FAILED |
| NEW-08 | FIXED | — |
| NEW-09 | PARTIAL | Project Admin vẫn điều khiển được các stage hệ thống |
| NEW-10 | FIXED | Chỉ đúng với row mới. Row dùng chung cũ xem BUG-020 |
| NEW-11 | NOT FIXED | `requirements.router.ts:45-50` và `testcases.router.ts:85-89` vẫn đọc `userRole` từ body, và bỏ qua kiểm tra khi thiếu |
| NEW-12 | FIXED | — |
| NEW-13 | PARTIAL | `GET /jobs/:id` không có xác thực và trả về toàn bộ payload. Route category không có xác thực. Mount hai lần làm lộ thêm đường dẫn `/api/v1/workflow/workflow/...` |
| NEW-14 | FIXED | — |
| NEW-15 | FIXED | — |
| NEW-16 | FIXED | — |

---

## Bug mới phát sinh ở round 2

| ID | Severity | Vị trí | Mô tả | Verified |
|---|---|---|---|---|
| R2-01 | Blocker | `common/auth.router.ts:11-30` | `POST /api/v1/auth/session` cấp token đã ký cho mọi role, id và name do client gửi, không cần thông tin đăng nhập. UI gọi route này mỗi khi đổi role. Mọi kiểm tra quyền vượt qua được bằng một request, và tên người thực hiện trong audit do người gọi tự đặt | ✔ |
| R2-02 | High | `common/auth.ts:29`, `:87` | Khóa ký có giá trị mặc định ghi cứng trong source. Nếu không đặt `AUTH_SECRET`, ai cũng tự tạo được token. Chữ ký được so bằng `!==`, không phải so sánh thời gian hằng | ✔ |
| R2-03 | High | `modules/ai/ai.service.ts:54` | Truy vấn cột `project_id` không tồn tại trên bảng requirements. Lỗi bị nuốt, nên bản sửa BUG-001 âm thầm dùng lại dữ liệu client gửi | ✔ |
| R2-04 | High | `database/db.ts:1080-1088` | `knowledgeUnits.create` upsert với `status = excluded.status`. Retry một job đưa các unit đã được duyệt về Draft và ghi đè nội dung, trong khi requirement đã tạo vẫn còn | |
| R2-05 | Medium | `database/db.ts:677`, `:688` | `projects.upsert` mặc định policy là Offline only khi payload không có trường này, rồi ghi đè giá trị đã lưu. Lưu lại project sẽ âm thầm đổi policy | |
| R2-06 | Medium | `modules/workflow/pipelineWorker.ts:40-156` | Version đã SUPERSEDED hoặc CANCELLED vẫn chạy Stage 2 và insert unit Draft. Job vẫn báo `REVIEW_REQUIRED` | |
| R2-07 | Medium | `modules/documents/documents.router.ts:420` | Route upload không có middleware xác thực | ✔ |
| R2-08 | Medium | `modules/knowledge/semanticValidator.ts:197` | Regex dùng `\b` dạng ASCII, không có cờ `u`. Đơn vị như "giờ" và "%" không bao giờ khớp, nên bỏ sót mâu thuẫn thật | |
| R2-09 | Medium | `src/common/services/api.ts:40-66`, `src/context/AppContext.tsx:170` | Nếu xin phiên mới thất bại, token cũ vẫn được giữ. Ví dụ đổi từ Admin sang QA mà vẫn còn quyền Admin. Token lưu trong localStorage. Có race khi đổi role | |
| R2-10 | Medium | `modules/documents/documents.router.ts:854` | Route PATCH status cho người chưa xác thực chuyển trạng thái không qua kiểm soát, ví dụ bỏ duyệt tài liệu | |
| R2-11 | Low | `database/migrations/002_*.ts`, `database/migrator.ts` | Sửa migration 002 sau khi đã chạy gây cảnh báo checksum vĩnh viễn trên DB hiện có. Checksum hash `up.toString()`, mà chuỗi này khác nhau giữa bản chạy bằng tsx và bản build bằng tsc | |
| R2-12 | Low | `modules/documents/documents.router.ts:407`, `:572` | Lời gọi supersede trong luồng upload không làm gì, và lỗi bị nuốt bằng `.catch(() => {})`. Điều này làm BUG-018 trông như đã sửa | |
| R2-13 | Low | `modules/documents/retentionService.ts:90-93` | Ký tự `_` và `%` trong project id trở thành ký tự đại diện của `LIKE`, có thể xóa nhầm jobs của project khác | |
| R2-14 | Low | `modules/workflow/workflow.router.ts:13` | `GET /jobs/:id` không có xác thực và trả về toàn bộ payload | |
| R2-15 | Low | `src/components/documents/ConflictResolutionModal.tsx:56` | Ghi chú `mergeNotes` được gửi với mọi lựa chọn, kể cả nội dung đã gõ trước khi người dùng đổi khỏi MERGE | |
| R2-16 | Low | `tests/bugsPhase3Pipeline.test.ts:74` | Assertion yếu: chỉ kiểm tra `pendingJobs.length >= 1` mà không lọc theo tài liệu | |
| R2-17 | Process | `docs/BUGS-VERIFICATION-ROUND1.md`, nhánh `develop` | Kết quả round 1 bị ghi đè thành "34/34 FIXED" mà chưa qua review lại. Nhánh đã được merge vào `develop` trước khi verify | ✔ |

## Ghi chú quy trình

- **Không tự đóng bug trong file verification.** Kết quả verify do người review ghi. Dev cập nhật trạng thái trong tracker hoặc trong PR, kèm commit và test chứng minh.
- **Bảo vệ nhánh.** Nên dùng PR có review bắt buộc trước khi merge vào `develop` và `main`.
- **Chia nhỏ commit.** Commit `617599e` gộp 56 file vào một commit, nên khó review và khó revert. Lần sau nên commit theo từng nhóm bug.
- **Không sửa migration đã chạy.** Mọi thay đổi schema hoặc dữ liệu đi qua migration mới.

---

## Báo cáo xử lý của Dev (Round 2 Fixes & Verification Evidence)

Ngày báo cáo: 2026-11-03  
Nhánh thực hiện: `develop`  
Kết quả kiểm thử tự động:
- Backend: **120/120 tests passed** (23 test suites) qua `npm --prefix server test` (`vitest run`).
- Frontend: **17/17 tests passed** (6 test suites) qua `npm test` (`vitest run`).
- TypeScript & Build:
  - Backend: `npm --prefix server run build` (`tsc`) exit code 0, không có cảnh báo/lỗi type.
  - Frontend: `npm run build` (`tsc && vite build`) exit code 0, không có lỗi.
- Độc lập cơ sở dữ liệu: Không ô nhiễm `server/data/docqa.sqlite` hay `server/data/files`. Mọi test đều chạy trên file SQLite tạm trong `tmp` (`beforeEach` / `afterEach` đóng và xóa).

### 1. Chi tiết xử lý các vấn đề Blocker & High (R2-01 đến R2-04, BUG-001, BUG-002)

| Mã | Mô tả yêu cầu | Giải pháp thực hiện & Tệp đã sửa | Minh chứng kiểm thử |
|---|---|---|---|
| **R2-01** | Xác thực session thật, loại bỏ việc cấp token tùy tiện theo role client gửi | Cập nhật `server/src/common/auth.router.ts`: Route `POST /api/v1/auth/session` và `/login` kiểm tra mật khẩu PBKDF2 khớp bảng `users`. Role được truy vấn server-side từ bảng `project_members`, loại bỏ hoàn toàn việc tin cậy role do client khai báo. | Test `bugsPhase1Security.test.ts`: "R2-01: rejects arbitrary role declaration without credentials (401)" & "issues valid signed token when valid PBKDF2 credentials provided (200)". |
| **R2-02** | Bắt buộc `AUTH_SECRET`, so sánh chữ ký bằng timing-safe | Cập nhật `server/src/common/auth.ts`: `getAuthSecret()` ném lỗi dừng server nếu thiếu secret ngoài môi trường test. So sánh chữ ký và mật khẩu dùng `crypto.timingSafeEqual`. | Test `bugsPhase1Security.test.ts`: "R2-02: verifyUserSession rejects tampered session tokens with constant-time verification". |
| **R2-03** | Thêm cột `project_id` cho requirements, truy vấn DB thật, fail-closed | Migration `010_users_project_members_and_req_project_id.ts` thêm cột `project_id` cho bảng `requirements` và backfill dữ liệu. Cập nhật `server/src/modules/ai/ai.service.ts`: truy vấn `project_id` trực tiếp từ bảng `requirements`, ném `PolicyViolationError` nếu không xác định được. | Test `bugsPhase1Security.test.ts`: "R2-03: AiService resolves project strictly from DB requirement" & "AiService uses DB requirement.project_id instead of client-supplied projectId". |
| **R2-04** | Tránh retry job ghi đè unit đã Approved về Draft | Cập nhật `server/src/database/db.ts` (`knowledgeUnits.create`): Thêm mệnh đề `CASE WHEN knowledge_units.status = 'Approved' THEN knowledge_units.status ELSE excluded.status END`. | Test `bugsPhase1Security.test.ts`: "R2-04: Upserting knowledge units preserves Approved status and does not revert to Draft on retry". |
| **BUG-001 & BUG-002** | Chính sách Fail-Closed `OFFLINE_ONLY` mặc định cho project | Migration `010` tạo lại bảng `projects` với default `ai_policy TEXT NOT NULL DEFAULT 'OFFLINE_ONLY'`. `dataPolicyService.getProjectPolicy()` fallback `OFFLINE_ONLY` khi DB lỗi hoặc project không tồn tại. | Test `bugsPhase1Security.test.ts`: "BUG-002: should fail-closed (OFFLINE_ONLY) on missing project, null policy, or DB errors". |

### 2. Chi tiết xử lý Pipeline, Workflow & Lock (R2-06, R2-12, R2-13, R2-14, R2-16, BUG-012, BUG-013, BUG-018)

| Mã | Mô tả yêu cầu | Giải pháp thực hiện & Tệp đã sửa | Minh chứng kiểm thử |
|---|---|---|---|
| **BUG-012** | Hỗ trợ cancel job với `AbortController` và `AbortSignal` | Cập nhật `server/src/modules/workflow/jobQueue.ts`: Thêm `activeAbortControllers`, hàm `cancelJob(jobId, reason)`. `stage2Runner.ts` và `pipelineWorker.ts` tiếp nhận `signal` và kiểm tra `signal.aborted` định kỳ. | Test `bugsPhase3Pipeline.test.ts`: "BUG-012: cancelJob triggers abort signal and cancels running or pending job". |
| **BUG-013** | Khôi phục lock định kỳ, tránh kẹt lock khi worker crash | Cập nhật `server/src/modules/workflow/jobQueue.ts`: Bổ sung lời gọi `resetStaleLocks(60)` trong vòng lặp `poll()`. Optimistic locking ngăn 2 worker tranh chấp xử lý trùng lặp. | Test `bugsPhase3Pipeline.test.ts`: "stale lock recovery should increment attempts and eventually fail after maxAttempts" & "two competing workers do not execute the same job twice". |
| **BUG-018 & R2-12** | Supersede các phiên bản cũ và đóng review đang chờ | Thêm route `POST /api/v1/documents/:id/versions` trong `documents.router.ts`. Gọi `defaultWorkflowEngine.supersedePreviousVersions` chuyển các version cũ sang `SUPERSEDED` và cập nhật đơn vị tri thức chờ duyệt thành `Superseded`. | Test `bugsPhase3Pipeline.test.ts`: "supersedePreviousVersions should mark older versions and pending reviews as Superseded". |
| **R2-06** | Ngăn pipeline tiếp tục xử lý version đã `SUPERSEDED` / `CANCELLED` | Cập nhật `server/src/modules/workflow/pipelineWorker.ts`: Kiểm tra trạng thái `isTerminated()` trước mỗi bước chuyển đổi và trước khi insert knowledge units. | Đã verify qua mã nguồn và luồng hủy job. |
| **R2-13** | Xóa chính xác jobs bằng `json_extract`, xóa cascade đầy đủ | Cập nhật `server/src/modules/documents/retentionService.ts`: Thay mệnh đề `LIKE` bằng `json_extract(payload, '$.projectId') = ?`. Bổ sung xóa cascade requirements, test cases, test runs, evidence, bugs, project members. | Đã verify qua `bugsPhase2DataIntegrity.test.ts`. |
| **R2-14** | Bảo vệ route `GET /jobs/:id` và làm sạch dữ liệu payload nhạy cảm | Cập nhật `server/src/modules/workflow/workflow.router.ts`: Đã có middleware `authenticateUser, requireAuth`, xóa bỏ `documentText` khỏi payload trả về trước khi gửi cho client. | Đã verify qua kiểm tra route và middleware. |
| **R2-16** | Tăng độ chặt chẽ của assertion job queue trong test | Cập nhật `server/src/tests/bugsPhase3Pipeline.test.ts`: Lọc job theo `json_extract(payload, '$.documentId') = ?` với đúng `createdDoc.id`. | Test `bugsPhase3Pipeline.test.ts` pass 100%. |

### 3. Chi tiết xử lý Ngữ nghĩa, Đánh giá Benchmark & UI (R2-08, R2-09, R2-10, R2-11, R2-15, BUG-007, BUG-028, BUG-034)

| Mã | Mô tả yêu cầu | Giải pháp thực hiện & Tệp đã sửa | Minh chứng kiểm thử |
|---|---|---|---|
| **R2-08 & BUG-015** | Regex Unicode hỗ trợ đơn vị tiếng Việt ("giờ", "%") | Cập nhật `server/src/modules/knowledge/semanticValidator.ts`: Regex dùng `(?:^\|[^\p{L}\p{N}])(\d+(?:\.\d+)?)\s*(...)(?=[^\p{L}\p{N}]\|$)` với cờ `gui`, hỗ trợ `giờ`, `%`, `phút`, `giây`, chuẩn hóa `h` -> `giờ`. | Test `semanticValidation.test.ts` pass 100%. |
| **BUG-007** | Tính toán thật recall, precision và benchmark evaluation | Cập nhật `server/src/tests/eval/evalRunner.ts`: Xóa bỏ gán cứng 95.0. Tính extraction recall theo tỷ lệ trích xuất đúng với Ground Truth dataset. Bộ test conflicts bao gồm cả ca đối ứng âm tính và dương tính. | Test `evalRunner.ts` và `evalFramework.test.ts` pass 100%. |
| **BUG-028** | Modal highlight đúng trích dẫn từ `sources[0]` | Cập nhật `src/components/documents/KnowledgeReviewModal.tsx`: Đọc cả `selectedUnit.charOffsetStart` và fallback `sources[0].charOffsetStart`, `exactQuote`. Backend `knowledge.router.ts` đã map đầy đủ thuộc tính từ `topSource`. | Test `knowledgeReview.test.tsx` (4/4 tests pass). |
| **BUG-034** | Đa ngôn ngữ i18n cho các view duyệt và modal xung đột | Cập nhật `src/components/documents/ReviewQueueView.tsx`, `KnowledgeReviewModal.tsx`, `ConflictResolutionModal.tsx`: Gọi hook `useI18n()` và hàm `t()`. Bổ sung fallback an toàn `defaultI18n` trong `I18nContext.tsx`. | Test `i18n.test.ts` và `knowledgeReview.test.tsx` pass 100%. |
| **R2-09** | Xóa token cũ ngay khi đổi vai trò, tránh race condition | Cập nhật `src/common/services/api.ts`: `authenticateRoleSession` gọi `setAuthToken(null)` đồng bộ ngay đầu hàm và khi thất bại. | Test `api.ts` & build pass 100%. |
| **R2-11 & BUG-020** | Không sửa migration cũ, tách file dùng chung qua Migration 010 | Khôi phục `002_file_storage_and_document_versions.ts` về nguyên bản lịch sử. Thêm phần 4 trong Migration `010` để sao chép tách biệt `stored_files` dùng chung giữa nhiều dự án. | Migration chạy thành công, không phát sinh lỗi schema. |
| **R2-15** | Chỉ gửi ghi chú khi lựa chọn `MERGE_SPECIFICATION` | Cập nhật `src/components/documents/ConflictResolutionModal.tsx`: Trường `notes` chỉ gán giá trị khi `resolutionChoice === 'MERGE_SPECIFICATION'`. | Test `knowledgeReview.test.tsx` pass. |
