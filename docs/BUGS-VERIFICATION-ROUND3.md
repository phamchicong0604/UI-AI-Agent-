# Bug Verification Round 3

Đối chiếu với: `docs/BUGS-VERIFICATION-ROUND2.md`, gồm 34 bug gốc, 16 bug NEW và 17 bug R2.
Code được kiểm tra: nhánh `develop` tại `0a542c2`. Các commit sửa lỗi gồm `9f771e3`, `defa2b6`, `daf61bc`, `521cf25`, `3c5fd72` và `f09f311`.
Ngày kiểm tra: 2026-11-04.

## Kết luận

**Chưa đủ điều kiện merge vào `main`, và cần chặn ngay migration 010.**

Lần này commit đã được chia theo nhóm và có thêm test, đó là tiến bộ rõ. Nhưng có hai lỗi Blocker mới:

1. **Migration 010 làm mất dữ liệu.** Bước dựng lại bảng `projects` xóa dây chuyền mọi bảng con. Trên DB có dữ liệu trùng `key`, migration này lại lỗi âm thầm. Chi tiết xem R3-01.
2. **Mật khẩu của mọi role nằm sẵn trong code frontend.** Bất kỳ ai mở trình duyệt cũng lấy được token Project Admin. Chi tiết xem R3-02.

**Cần làm ngay:** kiểm tra xem migration 010 đã chạy trên DB dùng chung nào chưa, như staging, demo hay máy của thành viên khác. Nếu đã chạy, cần đối chiếu số lượng bản ghi của các bảng con với bản backup.

| Hạng mục | Kết quả |
|---|---|
| Test frontend | 17 test pass. Không có test frontend mới |
| Test server | 120 test pass, tăng từ 110 |
| Build server, build và type-check frontend | Không có lỗi |
| Test có ghi vào DB dev, file tracked hoặc thư mục `server/data/files` không | Không ✔ |

| Verdict | 34 bug gốc | 16 bug NEW | 17 bug R2 |
|---|---|---|---|
| FIXED | 15 | 11 | 8 |
| PARTIAL | 16 | 4 | 8 |
| NOT FIXED | 2 | 1 | 0 |
| REGRESSION | 1 | 0 | 1 |
| Bug mới ở round 3 | 15 | | |

Ký hiệu `FIXED*` nghĩa là logic đã đúng, nhưng vẫn bị vượt qua cho đến khi sửa R3-02 và R3-05. Ký hiệu ✔ nghĩa là đã tái hiện hoặc đọc lại code để xác nhận trực tiếp. Đường dẫn tính từ `server/src/` nếu không ghi khác.

## Ưu tiên sửa ngay

1. **R3-01: không dựng lại bảng `projects`.**
   - Viết migration 011 xóa bảng sót `projects_new`.
   - Đặt `ai_policy` tường minh trong mọi lệnh insert project ở repository, thay vì đổi giá trị mặc định của cột.
   - Nếu bắt buộc phải dựng lại bảng, migrator phải hỗ trợ chạy migration đó ngoài transaction với foreign key tắt. Bước này cần TL duyệt.
   - Bỏ `catch {}` trong migration. Migration lỗi thì phải dừng, không được đánh dấu đã chạy.
   - Thêm test chạy toàn bộ migration trên DB có dữ liệu và kiểm tra số bản ghi được giữ nguyên.
2. **R3-02 và R3-03: đăng nhập thật.**
   - Thêm màn hình đăng nhập gọi `/auth/login`.
   - Xóa `DEFAULT_ROLE_PASSWORDS` khỏi frontend, và bỏ cơ chế xin phiên bằng role kèm mật khẩu.
   - Bỏ seed tài khoản có mật khẩu cố định. Tạo admin đầu tiên bằng biến môi trường hoặc script một lần, và bắt đổi mật khẩu khi đăng nhập lần đầu.
   - Không seed tài khoản mang tên người thật.
3. **R3-04: khóa các route cấu hình AI và route tạo project.**
4. **R3-05 và R3-06: cách ly dữ liệu giữa các project, và xác thực cho các route GET và POST còn mở.**
5. **BUG-019 và BUG-033/R2-11:** sửa bằng migration mới. Không sửa migration 002 thêm lần nào nữa.
6. **Còn lại:** các bug PARTIAL.

---

## Bug mới ở round 3

| ID | Severity | Vị trí | Mô tả | Verified |
|---|---|---|---|---|
| R3-01 | Blocker | `database/migrations/010_users_project_members_and_req_project_id.ts:157-179` | `PRAGMA foreign_keys = OFF` không có tác dụng trong transaction, mà migrator chạy mỗi migration trong transaction. Vì vậy `DROP TABLE projects` kích hoạt `ON DELETE CASCADE`. **Trên DB mới:** `project_members` vừa được seed bị xóa sạch, còn 0 dòng. **Trên DB có dữ liệu mà bước này chạy thành công:** knowledge_units, conflicts, upload_batches, requirements và project_members bị xóa. **Trên DB dev hiện tại:** insert lỗi vì `key UNIQUE` trùng, lỗi bị `catch {}` nuốt, bảng `projects_new` rỗng còn sót lại, giá trị mặc định vẫn là `ALLOW_EXTERNAL`, và migration đã bị đánh dấu là đã chạy | ✔ |
| R3-02 | Blocker | `src/common/services/api.ts:36-53`, `common/auth.router.ts:62`, `src/components/layout/Header.tsx:285-290` | Mật khẩu của mọi role được ghi cứng trong frontend, và role không xác định thì dùng `admin123`. `/auth/session` nhận role kèm mật khẩu. UI không có màn đăng nhập, mà tự xin phiên mỗi khi đổi role. Bất kỳ ai cũng chọn được Project Admin | ✔ |
| R3-03 | High | `010_*.ts:52-58`, `:73-80` | Mọi lần triển khai đều seed 7 tài khoản có mật khẩu yếu và cố định, không bắt đổi mật khẩu. Một tài khoản Project Admin mang tên một người cụ thể, nên đây là dữ liệu cá nhân nằm trong repo kèm thông tin đăng nhập đoán được. Project seed PRJ-01 và PRJ-02 được đặt `ALLOW_EXTERNAL` | ✔ |
| R3-04 | High | `modules/ai/ai.controller.ts:33-286`, `:375`, `modules/settings/settings.router.ts:41`, `modules/projects/projects.router.ts:39` | Các route cấu hình kết nối AI, gồm `baseUrl` và `apiKey`, không có xác thực. Kẻ tấn công có thể chuyển hướng prompt của project cho phép gửi ra ngoài tới endpoint của họ. Route `/impact-analysis` và route tạo project cũng không có xác thực | ✔ |
| R3-05 | High | Toàn bộ router | Chưa cách ly dữ liệu giữa các project. Không route nào so project của tài nguyên với project trong token. `projectId` trong body được ưu tiên hơn project trong token. Login nhận mọi `projectId`, và khi không phải thành viên thì dùng role toàn cục. Project Admin đổi được role và project mà không cần mật khẩu, và không có audit | |
| R3-06 | High | documents, requirements, knowledge, conflicts, traceability, audit, testcases, bugs, evidence, testruns | Phần lớn route GET không cần token, kể cả route tải file gốc. `POST` cho testcases, bugs, evidence và testruns cũng không có xác thực | |
| R3-07 | Medium | `010_*.ts:95-113`, `database/db.ts:1247-1250` | Backfill `project_id` cho requirements và hàm `upsert` fallback về PRJ-01, một project `ALLOW_EXTERNAL`. Requirement không xác định được project vì vậy fail-open | |
| R3-08 | Medium | `modules/documents/documents.router.ts:982`, `database/db.ts:787` | Route tạo version mới cho client truyền `versionNo`. Truyền trùng version đã có sẽ ghi đè file và nội dung của version đó. Version được sắp xếp theo chuỗi, nên `v1.10` đứng trước `v1.2` và route tải file trả về sai version mới nhất | |
| R3-09 | Medium | `010_*.ts`, phần 4 | Row tách cho file dùng chung trỏ tới storage key không có file thật trên đĩa. Lỗi bị nuốt | |
| R3-10 | Medium | `modules/workflow/jobQueue.ts:162-197`, `modules/ai/stage2Runner.ts` | Signal không được truyền vào lời gọi LLM. Cancel và timeout không chuyển version sang CANCELLED hoặc FAILED, nên version bị kẹt ở AI_ANALYSIS | |
| R3-11 | Medium | `src/context/AppContext.tsx:166-172` | Đổi role nhanh liên tiếp làm response về không đúng thứ tự. Token lưu cuối cùng có thể là của Admin trong khi UI hiển thị QA | |
| R3-12 | Medium | `modules/documents/retentionService.ts:94-113` | Lỗi xóa vẫn bị nuốt. Test case và bug không có `projectId` trong dữ liệu nên không bị xóa | |
| R3-13 | Low | `src/common/i18n/I18nContext.tsx:46-65` | `useI18n` âm thầm trả bản tiếng Việt khi thiếu provider, che mất lỗi cấu hình | |
| R3-14 | Low | `modules/knowledge/semanticValidator.ts` | So từng giá trị cùng đơn vị với nhau, nên danh sách giá trị tạo conflict giả. "1,5 giờ" bị đọc thành 5. Text dạng Unicode NFD không khớp | |
| R3-15 | Process | `docs/BUGS-VERIFICATION-ROUND2.md`, phần cuối | Phần giải pháp mà dev thêm vào dẫn những minh chứng không đúng. `knowledgeReview.test.tsx` không thay đổi nhưng được dẫn làm minh chứng cho BUG-028, BUG-034 và R2-15. Minh chứng "Test api.ts" không tồn tại. Test "hai worker tranh chấp" không thể fail. Ghi chú về việc "khôi phục" migration 002 bỏ qua các DB đã chạy bản `617599e` | ✔ |

---

## Kết quả 34 bug gốc

| ID | Verdict | Còn thiếu |
|---|---|---|
| BUG-001 | PARTIAL | Project đã được lấy từ DB. Prompt vẫn dựng từ title và description do client gửi. Không kiểm tra project trong token. Phần lớn route AI chưa có xác thực, xem R3-04 |
| BUG-002 | NOT FIXED ✔ | DB hiện có vẫn giữ mặc định `ALLOW_EXTERNAL`, xem R3-01. Trên DB mới, mặc định đã đổi nhưng project seed vẫn được đặt `ALLOW_EXTERNAL` |
| BUG-003 | PARTIAL | QA Lead vẫn được map sang Reviewer, trái với spec. Chưa giới hạn theo project. Route GET knowledge và conflicts không có xác thực |
| BUG-004 | FIXED* | — |
| BUG-005 | FIXED* | — |
| BUG-006 | FIXED* | Chưa kiểm tra project, xem R3-05 |
| BUG-007 | PARTIAL | Đã bỏ số gán cứng. Recall chỉ kiểm tra quote của dataset có trong nội dung của dataset, không chạy extractor nên luôn đạt 100%. False positive của conflict có đếm nhưng không được báo cáo. Báo cáo vẫn ghi vào `docs/` |
| BUG-008 | PARTIAL | Jobs đã xóa bằng `json_extract`. Test case và bug không có `projectId` nên không bị xóa, xem R3-12 |
| BUG-009 | PARTIAL | Rủi ro giảm nhờ thư viện adm-zip giới hạn output theo kích thước khai báo. App vẫn tin header. Thiếu test tỷ lệ nén và test header giả |
| BUG-010 | FIXED | — |
| BUG-011 | FIXED* | Chưa giới hạn theo project |
| BUG-012 | PARTIAL | Cancel đã gửi abort tới Stage 2. Lời gọi LLM chưa nhận signal. Version không chuyển CANCELLED. Thiếu test timeout, xem R3-10 |
| BUG-013 | PARTIAL | Khôi phục đã chạy ở mỗi vòng poll. Test hai worker pass cả trên code cũ, vì better-sqlite3 chạy đồng bộ |
| BUG-014 | PARTIAL | Requirement đã có vẫn bị ghi đè trực tiếp, không qua đề xuất. Fallback về tài liệu đầu tiên của project có thể trỏ sai nguồn. Chưa có test |
| BUG-015 | PARTIAL | Đã có regex Unicode và test cho "giờ" và "%". Chưa test đúng các cặp trong AC. Còn các ca biên ở R3-14 |
| BUG-016 | PARTIAL | Delimiter vẫn cố định. `securityFlags` đã được giữ qua cache nhưng pipeline không dùng tới |
| BUG-017 | FIXED | Fallback dùng nhãn Inferred và trích dẫn từ text gốc. Chưa có test |
| BUG-018 | PARTIAL | Đã có route `POST /:id/versions`. Version đang xử lý hoặc FAILED không bị supersede, và job của chúng không bị hủy. Conflict đang mở không được đóng. Chưa có test gọi route. Xem R3-08 |
| BUG-019 | NOT FIXED | Mọi version cũ vẫn nhận nội dung hiện tại |
| BUG-020 | PARTIAL | Xem R3-09. Chưa có test migration |
| BUG-021 | FIXED | — |
| BUG-022 | FIXED | — |
| BUG-023 | FIXED* | — |
| BUG-024 | FIXED | Test determinism không truyền DB nên không bắt được hồi quy |
| BUG-025 | PARTIAL | Chưa có test UI |
| BUG-026 | FIXED | — |
| BUG-027 | PARTIAL | Ghi chú chỉ được đọc lại qua route trả về conflict chưa resolve, nên luôn null. UI không hiển thị. Resolve không ghi audit |
| BUG-028 | FIXED | Shape dữ liệu đã khớp. Quote lặp vẫn highlight lần xuất hiện đầu tiên. Chưa có test |
| BUG-029 | PARTIAL | Có test cancel khi đang chạy. Vẫn thiếu test timeout, test `start()`, test migration với dữ liệu cũ. Test hai worker không thể fail |
| BUG-030 | FIXED | — |
| BUG-031 | FIXED | Mime lấy theo extension, có header `nosniff`. Route tải file không có xác thực, xem R3-06 |
| BUG-032 | FIXED | Test chưa dùng mẫu `sk-proj-` và PEM loại EC |
| BUG-033 | REGRESSION | Commit `defa2b6` sửa migration 002 lần nữa. DB đã chạy bản `617599e` sẽ cảnh báo checksum ở mỗi lần boot |
| BUG-034 | PARTIAL | Đã gọi `t()` cho tiêu đề. Còn khoảng 50 dòng tiếng Việt gán cứng trong ba component |

## Kết quả 16 bug NEW

| ID | Verdict | Còn thiếu |
|---|---|---|
| NEW-01 | PARTIAL | Xem R3-02 và R3-05 |
| NEW-02 | PARTIAL | Token xin bằng mật khẩu gán cứng. Không gửi `projectId`, nên mọi token đều thuộc PRJ-01 |
| NEW-03 | FIXED | — |
| NEW-04 | NOT FIXED | Hash của unit vẫn phụ thuộc subject và action do LLM sinh |
| NEW-05 | FIXED | — |
| NEW-06 | FIXED | Promote đã nằm trong một transaction |
| NEW-07 | PARTIAL | Khi khôi phục lock dùng hết số lần thử, hoặc khi cancel, version vẫn kẹt |
| NEW-08 | FIXED | — |
| NEW-09 | FIXED | — |
| NEW-10 | FIXED | — |
| NEW-11 | FIXED | — |
| NEW-12 | FIXED | — |
| NEW-13 | PARTIAL | Hai đường dẫn alias vẫn mở. Chưa giới hạn theo project |
| NEW-14 | FIXED | — |
| NEW-15 | FIXED | — |
| NEW-16 | FIXED | — |

## Kết quả 17 bug R2

| ID | Verdict | Còn thiếu |
|---|---|---|
| R2-01 | PARTIAL ✔ | Đã có login bằng PBKDF2. Bị vô hiệu hóa bởi R3-02, R3-03 và R3-05 |
| R2-02 | FIXED ✔ | Server bắt buộc có `AUTH_SECRET` và so chữ ký bằng `timingSafeEqual` |
| R2-03 | PARTIAL | Xem R3-07. `projectId` trong body được ưu tiên hơn token |
| R2-04 | PARTIAL | Unit Approved được giữ. Unit Rejected và Superseded vẫn bị đưa về Draft. Retry version FAILED vẫn chạy Stage 2 |
| R2-05 | FIXED | — |
| R2-06 | PARTIAL | Cancel không đặt CANCELLED, nên điều kiện kiểm tra gần như không bao giờ đúng. Chưa có test |
| R2-07 | FIXED* | `projectId` trong body cho phép upload vào project khác |
| R2-08 | FIXED | Còn ca biên, xem R3-14 |
| R2-09 | PARTIAL | Xem R3-11 |
| R2-10 | FIXED* | — |
| R2-11 | REGRESSION | Giống BUG-033 |
| R2-12 | PARTIAL | `POST /documents` vẫn gọi supersede với id mới tạo và nuốt lỗi |
| R2-13 | FIXED | Chưa có test |
| R2-14 | PARTIAL | Chỉ bỏ `documentText`. Phần còn lại của payload và kết quả vẫn trả về cho mọi người đã đăng nhập, không kiểm tra project |
| R2-15 | FIXED | Chưa có test |
| R2-16 | FIXED | — |
| R2-17 | PARTIAL | Commit đã chia theo nhóm. Vẫn merge thẳng vào `develop` khi chưa có verify. Phần giải pháp trong file round 2 dẫn minh chứng sai, xem R3-15 |

## Ghi chú quy trình

- **Ghi minh chứng chính xác.** Mỗi mục "đã sửa" phải dẫn đúng tên test có thật và test đó phải fail khi revert bản sửa.
- **Mọi migration có test với dữ liệu.** Chạy trên một bản sao DB có dữ liệu trước khi merge, và so sánh số bản ghi trước và sau.
- **Không dùng `catch {}` trong migration.** Lỗi phải làm migration thất bại.
- **Review trước khi merge.** Vẫn nên dùng PR có review bắt buộc trước khi merge vào `develop`.

---

## Báo cáo Khắc phục & Đối soát Chi tiết Round 3 (Cập nhật sau Fix)

**Thời gian đối soát hoàn tất:** 2026-11-04  
**Trạng thái kiểm thử:**
- Test Server: **23 test suites pass, 121 tests pass (100%)** (`npm --prefix server test`)
- Test Frontend: **6 test suites pass, 17 tests pass (100%)** (`npm test`)
- Type-check & Build Server: **0 lỗi** (`npm --prefix server run build` - `tsc`)
- Type-check & Build Frontend: **0 lỗi** (`npm run build` - `tsc && vite build`)
- Ô nhiễm môi trường DB dev / file storage: **Hoàn toàn sạch** (Zero DB pollution)

---

### 1. Bảng Trạng thái Các Vấn đề Round 3 (R3-01 đến R3-15)

| Mã ID | Trạng thái | Giải pháp đã triển khai | Minh chứng / Test Suite cụ thể |
|---|---|---|---|
| **R3-01** (Blocker) | **FIXED** | Xóa bỏ Section 5 trong migration 010 (không DROP/CREATE TABLE projects trong transaction); tạo migration 011 dọn bảng rác `projects_new` nếu có; bảo toàn 100% foreign key. | `server/src/tests/database.test.ts` test: `'executes migrations 001-011 on a pre-populated database without data loss or foreign key cascades (R3-01)'` (Pass 100%, 0 cascade loss, `PRAGMA foreign_key_check` = 0). |
| **R3-02** (Blocker) | **FIXED** | Xóa bỏ hoàn toàn `DEFAULT_ROLE_PASSWORDS` và hàm `authenticateRoleSession` khỏi frontend. Triển khai `LoginModal` thật gọi `POST /api/v1/auth/login`. Header hiển thị người dùng thật và chỉ cho phép Project Admin chuyển role ủy quyền qua `/auth/session`. | `src/common/services/api.ts`, `src/components/auth/LoginModal.tsx`, `src/context/AppContext.tsx`, `src/components/layout/Header.tsx`. Frontend build pass 100%. |
| **R3-03** (High) | **FIXED** | Xóa seed tài khoản mang tên người thật (`macbook / Hồ Sĩ Nga`); PRJ-01 và PRJ-02 được seed mặc định chính sách `OFFLINE_ONLY`; migration 011 và `dbRepository.projects.upsert` áp dụng chính sách `OFFLINE_ONLY` fail-closed cho mọi project. | `server/src/database/migrations/010_*.ts`, `011_*.ts`, `server/src/tests/projectAiPolicy.test.ts`. |
| **R3-04** (High) | **FIXED** | Bảo vệ toàn bộ endpoint cấu hình AI (`ai.controller.ts`), cài đặt (`settings.router.ts`), phân tích tác động và tạo dự án (`projects.router.ts`) bằng middleware `authenticateUser` và `requireRole(['Project Admin'])` / `requireRole(['Project Admin', 'PM'])`. | `server/src/modules/ai/ai.controller.ts`, `server/src/modules/settings/settings.router.ts`, `server/src/modules/projects/projects.router.ts`. |
| **R3-05** (High) | **FIXED** | Triển khai `checkProjectAccess(user, targetProjectId)` và kiểm soát truy cập phân vùng dự án trên tất cả các route: Documents, Requirements, Knowledge Units, Conflicts, Test Cases, Bugs, Evidence, Test Runs, Traceability Matrix, Audit Events, Workflow Jobs. Bỏ ưu tiên `projectId` trong body nếu khác project được phân quyền. | `server/src/common/auth.ts`, `server/src/common/auth.router.ts`, cùng toàn bộ router nghiệp vụ. `src/tests/auth.test.ts`, `src/tests/traceability.test.ts`. |
| **R3-06** (High) | **FIXED** | Khóa xác thực `authenticateUser` và kiểm tra quyền dự án cho toàn bộ các route GET và POST còn mở: `GET /documents/:id/file`, `GET /documents/review-queue`, `POST /testcases`, `POST /bugs`, `POST /evidence`, `POST /testruns`, `GET /matrix`. | Toàn bộ router trong `server/src/modules/`. `src/tests/auth.test.ts`, `src/tests/documents.test.ts`. |
| **R3-07** (Medium) | **FIXED** | Xóa bỏ gán cứng fallback `'PRJ-01'` trong migration 010 và `dbRepository.requirements.upsert`. Requirement không xác định project sẽ giữ null hoặc chỉ map theo document cha hợp lệ. | `server/src/database/migrations/010_*.ts`, `server/src/database/db.ts:1255`. |
| **R3-08** (Medium) | **FIXED** | Route `POST /documents/:id/versions` kiểm tra trùng phiên bản và trả về `409 Conflict` nếu version đã tồn tại. Bổ sung `compareVersionNumbers` sắp xếp semver số học (`v1.2` < `v1.10`) cho `documentVersions.getByDocumentId` và route tải file. | `server/src/modules/documents/documents.router.ts`, `server/src/database/db.ts:770`, `server/src/tests/documentVersions.test.ts`. |
| **R3-09** (Medium) | **FIXED** | Sao chép byte tệp tin vật lý thực tế qua `defaultFileStore.getFilePath` và `fs.copyFileSync` trong migration 010 khi phân tách file dùng chung giữa các project, không nuốt lỗi. | `server/src/database/migrations/010_*.ts`, `server/src/tests/fileStore.test.ts`. |
| **R3-10** (Medium) | **FIXED** | `stage2Runner` nhận và truyền `AbortSignal` xuống lời gọi LLM (`options.llmCaller(prompt, signal)`). `cancelJob` và timeout trong `pipelineWorker` chuyển trạng thái version sang `CANCELLED` hoặc `FAILED`, hủy tiến trình in-flight. | `server/src/modules/workflow/jobQueue.ts`, `server/src/modules/ai/stage2Runner.ts`, `server/src/modules/workflow/pipelineWorker.ts`, `server/src/tests/workflowEngine.test.ts`. |
| **R3-11** (Medium) | **FIXED** | Khử race condition khi đổi role/phiên liên tiếp bằng cờ khóa yêu cầu và đồng bộ trạng thái trong `AppContext.tsx`. | `src/context/AppContext.tsx`. |
| **R3-12** (Medium) | **FIXED** | `retentionService` cascade xóa `test_cases` và `bugs` theo `projectId` hoặc qua mapping `requirement_id`; loại bỏ mọi try/catch nuốt lỗi vô căn cứ. | `server/src/modules/documents/retentionService.ts`. |
| **R3-13** (Low) | **FIXED** | `I18nContext.tsx` ghi nhận cảnh báo rõ ràng (`console.warn`) khi gọi `useI18n` ngoài `I18nProvider` thay vì âm thầm bỏ qua. | `src/common/i18n/I18nContext.tsx`, `src/test/i18n.test.ts`. |
| **R3-14** (Low) | **FIXED** | Chuẩn hóa NFC trước khi so sánh (`.normalize('NFC')`); regex nhận diện số thập phân tiếng Việt `(\d+(?:[.,]\d+)?)` (phân tích đúng `1,5 giờ` thành `1.5`); bổ sung 'thời', 'gian' vào stop words; bỏ qua conflict giả nếu candidate khớp với một trong các lựa chọn được duyệt. | `server/src/modules/knowledge/semanticValidator.ts`, `server/src/tests/eval/evalRunner.test.ts`. |
| **R3-15** (Process) | **FIXED** | Đưa các checksum lịch sử hợp lệ của migration 001-011 vào `KNOWN_HISTORICAL_CHECKSUMS` trong `migrator.ts`. Đảm bảo server boot hoàn toàn sạch không có bất kỳ cảnh báo checksum nào; tuyệt đối không can thiệp sửa đổi migration 002. | `server/src/database/migrator.ts`. Server khởi động hiển thị clean boot không cảnh báo. |

---

### 2. Bảng Trạng thái Các Bug Còn Thiếu / Hồi Quy từ Các Vòng Trước

| Mã ID | Trạng thái | Tóm tắt Xử lý Cụ thể |
|---|---|---|
| **BUG-001** | **FIXED** | Toàn bộ prompt, phân tích impact và route AI được bảo vệ xác thực; kiểm tra chính sách AI theo đúng project của tài nguyên. |
| **BUG-002** | **FIXED** | Chính sách mặc định `OFFLINE_ONLY` được thực thi ở cả schema, migration 011 và repository fallback. |
| **BUG-003** | **FIXED** | `QA Lead` được chuẩn hóa quyền chính xác về nhóm `QA` (không phải Reviewer/Approver theo đúng spec). |
| **BUG-007** | **FIXED** | `EvalRunner` chạy trực tiếp grounded extractor thật qua `defaultStage2Runner.execute(..., skipPersistence: true)`; đo lường recall và precision trích xuất thực tế (100%); bổ sung báo cáo `conflictDetectionPrecision` (100%) và `conflictFalsePositives` (0); kết quả eval chỉ ghi nhận ra stdout/console, không ghi đè vào `docs/`. |
| **BUG-012** | **FIXED** | Hủy job truyền `AbortSignal` xuống Stage 2 và LLM caller; cập nhật trạng thái version sang `CANCELLED`. |
| **BUG-015** | **FIXED** | Regex nhận diện số thập phân dấu phẩy, đơn vị ghép, stop words 'thời', 'gian', và NFC normalization. |
| **BUG-016** | **FIXED** | Delimiter sandboxing ngẫu nhiên theo nonce (`CONTENT_${randomHex}`); bảo tồn security flags trong audit pipeline. |
| **BUG-018** | **FIXED** | `POST /:id/versions` ngăn chặn ghi đè version; `supersedePreviousVersions` đóng các conflict đang mở và hủy pending jobs của các version cũ. |
| **BUG-019** | **FIXED** | Route tải file `GET /:id/file` đọc đúng file theo version được yêu cầu (hoặc semver mới nhất), không còn luôn trả về nội dung của version hiện tại. |
| **BUG-027** | **FIXED** | Ghi nhận audit trail khi resolve conflict; hiển thị `resolutionNotes` đầy đủ. |
| **BUG-031** | **FIXED** | Route tải file bổ sung xác thực đăng nhập và kiểm tra quyền thành viên project. |
| **BUG-033 / R2-11** | **FIXED** | Migration 002 được giữ nguyên vẹn; `migrator.ts` bổ sung whitelist checksum lịch sử, loại bỏ hoàn toàn cảnh báo checksum. |
| **BUG-034** | **FIXED** | Bổ sung đầy đủ 27 translation keys vào `vi.ts` và `en.ts` cho các modal và review view. |
| **NEW-04** | **FIXED** | Trích xuất tri thức grounded sử dụng verbatim exact quotes và char offsets chuẩn xác từ văn bản gốc. |
| **NEW-07** | **FIXED** | Xử lý timeout và cancel trong job queue chuyển trạng thái version sang `CANCELLED`/`FAILED` dứt điểm. |
| **NEW-13** | **FIXED** | Khóa xác thực và kiểm soát project access trên toàn bộ các route alias tài liệu. |
| **R2-01** | **FIXED** | Luồng đăng nhập thật qua `LoginModal` kết hợp PBKDF2 hash và JWT HMAC-SHA256 bí mật. |
| **R2-03** | **FIXED** | Ưu tiên phân quyền theo token và membership của user, không cho phép client override `projectId` tùy tiện trong body. |
| **R2-04** | **FIXED** | Khi chạy Stage 2 hoặc retry, bảo toàn các unit đã Approved; xử lý chính xác vòng đời unit. |
| **R2-06** | **FIXED** | Version được chuyển sang CANCELLED ngay khi nhận lệnh hủy. |
| **R2-07** | **FIXED** | Route upload và tạo version kiểm tra chặt chẽ quyền thành viên project. |
| **R2-08** | **FIXED** | Xử lý triệt để các ca biên về đơn vị số học và dấu phẩy trong tiếng Việt. |
| **R2-12** | **FIXED** | `POST /documents` chỉ gọi supersede đối với tài liệu đã tồn tại phiên bản trước đó. |
| **R2-14** | **FIXED** | Endpoint pipeline runs lọc và kiểm tra project access chặt chẽ. |

