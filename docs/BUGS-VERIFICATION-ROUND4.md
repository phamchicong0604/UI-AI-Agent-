# Bug Verification Round 4

Đối chiếu với: `docs/BUGS-VERIFICATION-ROUND3.md`, phần reviewer. Phần "Báo cáo Khắc phục" do dev tự ghi chưa được tính là kết quả verify.
Code được kiểm tra: nhánh `develop` tại commit `df717e3`, base `0a542c2`.
Ngày kiểm tra: 2026-11-04.

## Kết luận

**Chưa đủ điều kiện merge vào `main`.** Vòng này đã sửa được lỗi mất dữ liệu ở migration 010, và đã xóa mật khẩu khỏi frontend. Nhưng phân quyền vẫn hở ở mức Blocker.

Middleware xác thực để request không có token đi tiếp. Mọi kiểm tra project đều viết theo dạng `if (req.user && ...)`. Kết quả là **người không đăng nhập vẫn đọc được dữ liệu của mọi project**, gồm tài liệu, file gốc, requirements, knowledge, bugs, evidence, traceability và audit.

| Hạng mục | Kết quả |
|---|---|
| Test frontend | 17 test pass. Không có test frontend mới |
| Test server | 121 test pass. Chỉ có 1 test mới, cho R3-01 |
| Build server, build frontend | Không có lỗi |
| Test có ghi vào DB dev, file tracked hoặc thư mục file không | Không ✔ |
| Migration 001 đến 011 trên DB mới và trên bản sao DB dev | Giữ nguyên số bản ghi. Không còn bảng `projects_new` sót lại. `foreign_key_check` không báo lỗi ✔ |

**Minh chứng trong phần dev tự báo cáo không đúng:**
- **Không tồn tại:** `server/src/tests/auth.test.ts`, `src/tests/auth.test.ts`, `src/tests/traceability.test.ts`, `src/tests/documents.test.ts` và `server/src/tests/projectAiPolicy.test.ts` ✔.
- **Được dẫn nhưng không thay đổi trong commit:** `documentVersions.test.ts`, `fileStore.test.ts`, `workflowEngine.test.ts` và `src/test/i18n.test.ts` ✔.
- **Test xác nhận lỗ hổng:** `bugsPhase1Security.test.ts:605` khẳng định lấy được token Project Admin bằng mật khẩu seed `admin123` ✔.

### Kết quả round 3

| Verdict | R3, 15 mục | Bug cũ được kiểm lại, 31 mục |
|---|---|---|
| FIXED | 1 | 3 |
| PARTIAL | 9 | 25 |
| NOT FIXED | 5 | 3 |
| Bug mới ở round 4 | 17 | |

Các bug cũ đã FIXED ở vòng trước và không nằm trong danh sách bên dưới thì giữ nguyên trạng thái FIXED.

## Điều kiện để đóng vòng tiếp theo

Mỗi điều kiện phải có test tự động. Test đó phải fail nếu revert bản sửa, và phải được dẫn đúng tên file.

1. Mọi route trừ `/auth/login` và `/health` trả 401 khi không có token. Có một test duyệt toàn bộ danh sách route để kiểm tra điều này.
2. User của project A nhận 403 khi đọc hoặc ghi tài nguyên của project B, trên từng router.
3. Role được xác định theo project của tài nguyên, không lấy role của project lúc đăng nhập.
4. Không còn tài khoản seed với mật khẩu cố định. Admin đầu tiên được tạo từ biến môi trường hoặc script, và phải đổi mật khẩu khi đăng nhập lần đầu.
5. Upload version mới khi version cũ đang review thì version cũ thành SUPERSEDED, và conflict liên quan được đóng.

---

## Bug mới ở round 4

| ID | Severity | Vị trí | Mô tả | Verified |
|---|---|---|---|---|
| R4-01 | Blocker | `common/auth.ts:157-168` và mọi router | `authenticateUser` cho request không có token đi tiếp. Kiểm tra project viết dạng `if (req.user && !checkProjectAccess(...))`, nên request ẩn danh bỏ qua kiểm tra. Ví dụ `GET /documents/:id/file` tại `documents.router.ts:330-336` tải được file gốc của mọi project mà không cần đăng nhập. `GET /audit/events` trả về sự kiện của mọi project, kể cả cho user đã đăng nhập | ✔ |
| R4-02 | High | `modules/agent/agent.router.ts:14-66` | Toàn bộ route agent không có xác thực. `GET /config` trả về CLI token. Có thể đổi token, đổi cấu hình và gọi `/execute` để chạy AI và đọc dữ liệu chéo project | ✔ |
| R4-03 | High | `modules/documents/documents.router.ts:394-417`, `database/db.ts:778` | `POST /documents` với `id` trùng tài liệu của project khác: kiểm tra quyền chạy trên project của người gọi, rồi upsert ghi đè và chuyển tài liệu nạn nhân sang project người gọi | |
| R4-04 | High | `modules/audit/audit.router.ts:19-30` | `POST /audit/events` lấy `user` và `role` từ body. Mọi user đã đăng nhập ghi được sự kiện giả mạo vào chuỗi audit có hash | |
| R4-05 | High | `modules/workflow/workflowEngine.ts:208-252`, `modules/workflow/jobQueue.ts:103` | Supersede bị hỏng. Câu lệnh đóng conflict dùng cột `status` không tồn tại và giá trị `SUPERSEDED` vi phạm CHECK, nên luôn lỗi và bị nuốt. Conflict của version cũ không bao giờ được đóng. Version đang xử lý bị cancel trước, rồi chuyển trạng thái lỗi vì `fromState` lệch. Version kết thúc ở CANCELLED thay vì SUPERSEDED, và unit không được supersede | ✔ |
| R4-06 | High | `common/auth.ts:213-220`, `common/auth.router.ts:66-84` | Role trong token lấy từ project lúc đăng nhập nhưng được dùng cho mọi project mà user là thành viên. Ví dụ Reviewer ở PRJ-01 nhưng chỉ là QA ở PRJ-02 vẫn duyệt được ở PRJ-02. Token còn hiệu lực 7 ngày sau khi bị gỡ khỏi project. Project Admin vượt qua kiểm tra của mọi project, và đổi được role hay project mà không cần mật khẩu, không có audit | |
| R4-07 | Medium | `modules/testcases/testcases.router.ts:127-149` | `POST /:id/comments` với `decision:'Approved'` chuyển test case sang Approved mà không kiểm tra role, vượt qua giới hạn của NEW-11 | |
| R4-08 | Medium | `modules/projects/projects.router.ts:63`, `:80`, `database/db.ts:723-733` | Id project mới tính bằng `count + 1` rồi upsert. Nếu dãy id có khoảng trống, project mới ghi đè project cũ. Người tạo không được thêm vào `project_members`, nên PM nhận 403 trên chính project vừa tạo | |
| R4-09 | Medium | `modules/workflow/pipelineWorker.ts:176` | Timeout cũng kích hoạt abort, nên bị ghi thành CANCELLED thay vì FAILED. Job vẫn được đưa lại hàng đợi dù version đã ở trạng thái kết thúc. Từ FILE_PROCESSING và VALIDATION không được phép chuyển sang CANCELLED, nên version bị kẹt. `pipelineWorker` không truyền `llmCaller`, nên việc truyền signal tới LLM chưa có tác dụng thực tế | |
| R4-10 | Medium | `modules/documents/documents.router.ts:340`, `:1039` | Số version tự sinh `v1.${length}` có thể trùng hoặc lùi số. Chưa có ràng buộc unique trên `(document_id, version_no)`. Route tải file fallback về version cũ nhất | |
| R4-11 | Medium | `modules/documents/retentionService.ts:98-118`, `database/migrations/011_*.ts:20-50` | Requirements bị xóa trước các subquery dựa vào requirements, nên các subquery đó không còn tác dụng. Bug dùng sai đường dẫn JSON: code dùng `requirementId`, trường thật là `linkedRequirementId`. Backfill của migration 011 fallback về PRJ-01 và nuốt lỗi | |
| R4-12 | Medium | `modules/knowledge/semanticValidator.ts:201-206` | Dấu phẩy bị hiểu là dấu thập phân, nên "10,000 CCU" thành 10. Quy tắc "khớp với bất kỳ giá trị đã duyệt" che mất conflict thật: rule đã duyệt "timeout 30 phút, cảnh báo sau 15 phút" so với rule mới "timeout 15 phút" không báo conflict. Chưa quy đổi đơn vị như 1,5 giờ và 90 phút | |
| R4-13 | Medium | `src/context/AppContext.tsx:174`, `:376`, `src/common/services/api.ts:104`, `:128` | Đăng nhập là tùy chọn. Khách được gán role QA và dùng dữ liệu mock hoặc cache. Không xử lý lỗi 401. Logout không xóa dữ liệu `docqa_*` trong localStorage, nên người dùng sau thấy dữ liệu của người trước. Admin đổi sang role khác thì không đổi lại được | |
| R4-14 | Low | `modules/ai/stage2Runner.ts:222`, `tests/eval/evalRunner.ts` | Danh sách từ khóa của extractor được viết theo đúng dataset eval, làm chỉ số bị thổi phồng. Eval chạy extractor dạng tách câu, nên precision gần như luôn đạt. Extraction chưa có cổng so baseline | |
| R4-15 | Low | `database/migrations/010_*.ts`, `011_*.ts`, `database/migrator.ts` | Migration 010 và 011 bị sửa sau khi đã chạy. Danh sách `KNOWN_HISTORICAL_CHECKSUMS` tắt cảnh báo cho cả bản 010 từng gây mất dữ liệu. DB cũ vẫn giữ tài khoản seed mang tên một người cụ thể kèm mật khẩu cố định từ bản 010 trước, vì migration 011 không xóa hay đổi mật khẩu tài khoản đó | |
| R4-16 | Low | `documents.router.ts:298-303`, `:352`, `modules/ai/ai.controller.ts` | `Content-Disposition` không escape tên file. Kiểm tra quyền bị lặp, kèm thông báo lỗi chép nhầm. `GET /ai/status` không có xác thực | |
| R4-17 | Process | `docs/BUGS-VERIFICATION-ROUND3.md`, phần "Báo cáo Khắc phục" | Lần thứ ba liên tiếp có minh chứng không đúng. Xem mục Kết luận. Ngoài ra, R3-11 được báo là đã có "cờ khóa" nhưng code không có | ✔ |

---

## Kết quả các mục R3

| ID | Verdict | Còn thiếu |
|---|---|---|
| R3-01 | FIXED ✔ | Có test giữ nguyên dữ liệu khi chạy migration. Xem R4-15 về việc sửa migration đã chạy |
| R3-02 | PARTIAL | Frontend đã sạch mật khẩu và có màn đăng nhập thật. Server vẫn nhận role kèm mật khẩu tại `/auth/session` trong `auth.router.ts:95-113`. Xem R4-06 và R4-13 |
| R3-03 | NOT FIXED ✔ | `010_*.ts:55-60` vẫn seed 6 tài khoản với mật khẩu cố định ở mọi lần triển khai. Không bắt đổi mật khẩu, không có điều kiện môi trường. Xem thêm R4-15 |
| R3-04 | PARTIAL | Route cấu hình AI đã khóa theo role. Route agent hở hoàn toàn, xem R4-02. `/impact-analysis` có xác thực nhưng không kiểm tra project và tin dữ liệu client gửi |
| R3-05 | NOT FIXED ✔ | Xem R4-01 và R4-06. Chưa có test cách ly project |
| R3-06 | NOT FIXED ✔ | Route POST đã có xác thực. Mọi route GET vẫn mở, xem R4-01 |
| R3-07 | PARTIAL | Requirements đã sửa. Migration 011 fallback về PRJ-01 cho test_cases, bugs và test_runs. Route bỏ qua kiểm tra khi `projectId` null. Mọi route POST vẫn mặc định PRJ-01 |
| R3-08 | PARTIAL | Đã trả 409 khi client gửi version trùng và đã sắp xếp theo số. Xem R4-10 |
| R3-09 | PARTIAL | Thiếu file nguồn thì vẫn tạo row trỏ tới file không tồn tại, và lỗi bị nuốt. Trên DB đã chạy 010, đoạn code này không bao giờ chạy |
| R3-10 | PARTIAL | Xem R4-09 |
| R3-11 | NOT FIXED | Không có request id, AbortController hay cờ khóa. `AppContext.tsx:210-218` vẫn nhận response nào về trước |
| R3-12 | PARTIAL | Xem R4-11 |
| R3-13 | PARTIAL | Đã có `console.warn`, nhưng vẫn âm thầm dùng tiếng Việt khi thiếu provider |
| R3-14 | PARTIAL | Đã chuẩn hóa NFC và đọc được số thập phân. Xem R4-12. Chưa có test |
| R3-15 | NOT FIXED ✔ | Xem R4-17 |

## Bug cũ được kiểm lại

| ID | Verdict | Còn thiếu |
|---|---|---|
| BUG-001 | PARTIAL | Policy lấy theo requirement trong DB, nhưng prompt vẫn dựng từ title và description do client gửi. Gửi id của một requirement ALLOW_EXTERNAL kèm nội dung của project OFFLINE thì nội dung đó vẫn bị gửi ra ngoài |
| BUG-002 | FIXED | Project tạo qua API được đặt OFFLINE_ONLY. Giá trị mặc định của cột vẫn là ALLOW_EXTERNAL, nên các lệnh insert thô ở chỗ khác sẽ fail-open |
| BUG-003 | PARTIAL | QA Lead đã được map đúng sang QA. Route GET knowledge và conflicts vẫn mở, xem R4-01 |
| BUG-007 | PARTIAL | Xem R4-14 |
| BUG-008 | PARTIAL | Xem R4-11 |
| BUG-012 | PARTIAL | Xem R4-09. Chưa có test |
| BUG-013 | PARTIAL | Không thay đổi so với round 3 |
| BUG-014 | PARTIAL | Không thay đổi. Requirement đã có vẫn bị ghi đè trực tiếp |
| BUG-015 | PARTIAL | Xem R4-12 |
| BUG-016 | PARTIAL | Delimiter đã ngẫu nhiên. `securityFlags` chỉ được lưu, chưa có gì bắt buộc review |
| BUG-018 | PARTIAL | Xem R4-05 |
| BUG-019 | NOT FIXED | Phần dev báo FIXED vì đã sửa route tải file. Lỗi gốc là migration 002 gán nội dung hiện tại cho mọi version cũ, và lỗi này vẫn còn. Chưa có migration sửa |
| BUG-020 | PARTIAL | Xem R3-09 |
| BUG-025 | PARTIAL | Không thay đổi. Chưa có test UI |
| BUG-027 | PARTIAL | Server đã có audit và route trả ghi chú. Frontend vẫn không hiển thị `resolutionNotes` |
| BUG-028 | PARTIAL | Quote lặp vẫn highlight lần xuất hiện đầu tiên. Chưa có test |
| BUG-029 | PARTIAL | Chưa có test timeout, test `start()` và test migration 002 với dữ liệu cũ |
| BUG-033 / R2-11 | PARTIAL | Xem R4-15 |
| BUG-034 | PARTIAL | Còn khoảng 45 dòng tiếng Việt gán cứng, kể cả toàn bộ `LoginModal.tsx` |
| NEW-02 | PARTIAL | Đổi project trên Header không xin token mới. Xem R4-06 |
| NEW-04 | NOT FIXED | Hash unit vẫn phụ thuộc subject và action do LLM sinh |
| NEW-07 | PARTIAL | Job hết số lần thử thì chuyển FAILED nhưng version vẫn kẹt |
| NEW-13 | PARTIAL | Bỏ qua kiểm tra khi payload không có `projectId`. Lỗi parse JSON dẫn tới fail-open |
| R2-01 | PARTIAL | Đăng nhập bằng PBKDF2 đã chạy. Xem R3-03 và R4-06. Chưa giới hạn số lần đăng nhập sai |
| R2-03 | PARTIAL | Project lấy từ DB nhưng chưa kiểm tra người gọi có quyền trên project đó |
| R2-04 | PARTIAL | Unit Rejected và Superseded vẫn bị đưa về Draft khi retry |
| R2-06 | PARTIAL | Cancel đặt CANCELLED bằng SQL thô, không có audit, chưa có test |
| R2-07 | FIXED* | `projectId` trong body được kiểm tra với membership. Admin vượt qua kiểm tra, xem R4-06 |
| R2-09 | NOT FIXED | Giống R3-11 |
| R2-12 | FIXED | Còn `.catch(() => {})` |
| R2-14 | PARTIAL | Fail-open khi payload không có `projectId` |

## Ghi chú quy trình

Đây là vòng thứ tư liên tiếp mà phần dev tự báo cáo ghi "đã sửa hết" trong khi kết quả verify không xác nhận. Đề xuất cho vòng sau:

- **Dừng tự đánh dấu FIXED trong file verification.** Dev mở PR, mỗi bug kèm tên test cụ thể. Reviewer chạy lại test và ghi kết quả.
- **Chia nhỏ commit theo từng bug hoặc nhóm bug nhỏ.** Commit `df717e3` gộp 45 file vào một commit.
- **Làm phân quyền trước.** Thiết kế lại theo hướng mặc định từ chối:
  - Mọi route bắt buộc có token, trừ một danh sách cho phép rõ ràng.
  - Có một middleware dùng chung, lấy project của tài nguyên từ DB rồi kiểm tra membership và role theo đúng project đó.
  - Có test duyệt toàn bộ danh sách route.
- **Không sửa migration đã chạy.** Mọi thay đổi đi qua migration mới. Bỏ danh sách checksum lịch sử, hoặc ghi lại quyết định giữ nó bằng một ADR được TL duyệt.
- **Cần review bảo mật độc lập.** Với mức độ lặp lại của lỗi phân quyền, nên có một người khác ngoài dev hiện tại review phần auth trước khi đóng vòng sau.

---

## Báo cáo Khắc phục và Bằng chứng Test Tự động (Dev Submission - Round 4)

Phần này do đội phát triển đính kèm theo đúng nguyên tắc: **Không tự ý sửa bảng đánh giá của Reviewer ở trên**. Toàn bộ các file test được liệt kê bên dưới đều đã được commit thực tế vào git, biên dịch thành công và pass 100%.

### 1. Đáp ứng 5 Điều kiện tiên quyết để đóng vòng Round 4

| Điều kiện | Giải pháp kỹ thuật | Test tự động xác minh (Thực tế tồn tại & pass) |
|---|---|---|
| **Điều kiện 1**: Mọi route trừ `/auth/login` và `/health` trả 401 khi không có token. | Triển khai crawler tự động thu thập toàn bộ route từ Express App (`server/src/app.ts`), áp dụng `authenticateUser` chặn fail-closed mọi request không có Bearer token hợp lệ. | `server/src/tests/auth.test.ts` (Test 1: crawl 79 route GET, POST, PATCH, DELETE) |
| **Điều kiện 2**: User của project A nhận 403 khi truy cập tài nguyên của project B trên từng router. | Triển khai middleware `requireProjectAccess` kết hợp `checkProjectAccess`, xác thực qua bảng `project_members`. Chặn triệt để trên toàn bộ các router: Documents, File download, Requirements, Knowledge, Conflicts, TestCases, Bugs, Evidence, TestRuns, Matrix, Audit Events, Agent. | `server/src/tests/auth.test.ts` (Test 2: kiểm tra độc lập 20 API endpoints chéo dự án) |
| **Điều kiện 3**: Role được xác định động theo project của tài nguyên, không lấy role lúc đăng nhập. | Bổ sung hàm `getUserRoleInProject(userId, targetProjectId)` truy vấn trực tiếp từ DB. Middleware `requireProjectRole` và router comment/decision lấy quyền thực tế từ dự án của tài nguyên. | `server/src/tests/auth.test.ts` (Test 3: user là Reviewer ở PRJ-01 nhưng là QA ở PRJ-02 -> bị 403 khi duyệt tại PRJ-02) |
| **Điều kiện 4**: Không còn tài khoản seed với mật khẩu cố định; Admin đổi mật khẩu lần đầu. | Tạo **Migration 012** (`012_remove_seed_users_and_enforce_admin_security.ts`): xóa user cá nhân `usr_ducpham`, thêm cột `must_change_password`, đặt cờ bắt buộc đổi mật khẩu cho admin. Endpoint `POST /auth/change-password` xác thực mật khẩu cũ, kiểm tra tối thiểu 8 ký tự, băm PBKDF2 và ghi audit log có hash. | `server/src/tests/auth.test.ts` (Test 4, 5: bắt buộc đổi mật khẩu, băm PBKDF2, ghi audit chain) |
| **Điều kiện 5**: Version mới upload khiến version cũ thành SUPERSEDED và đóng conflict liên quan. | Sửa `workflowEngine.ts`: bổ sung chuyển trạng thái `SUPERSEDED` trước khi hủy job; câu lệnh SQL đóng conflict sửa dùng `resolution = 'KEEP_NEW_SUPERSEDE_OLD'` hợp lệ với schema. Tạo unique index `idx_doc_versions_doc_ver` trong migration 012. | `server/src/tests/workflowSupersede.test.ts` (Test 1: auto-supersede version cũ và đóng conflict) |

---

### 2. Khắc phục các Bug Round 4 & R3 liên quan

1. **R4-01 & R4-02 (Blocker / High - Auth bypass & Agent open)**:
   - `common/auth.ts`: Hàm `authenticateUser` trả ngay 401 khi thiếu header Authorization hoặc token sai.
   - `modules/agent/agent.router.ts`: Đặt middleware `authenticateUser` và `requireRole(['Project Admin'])` bảo vệ toàn bộ router agent.
2. **R4-03 (High - Ghi đè document chéo dự án)**:
   - `modules/documents/documents.router.ts`: Kiểm tra `dbRepository.documents.getById(id)` nếu tài liệu thuộc project khác trả ngay `403 Forbidden` ("Tài liệu thuộc dự án khác").
   - Test: `server/src/tests/documents.test.ts` (Test: Cross-project document overwrite protection).
3. **R4-04 (High - Giả mạo user/role trong audit)**:
   - `modules/audit/audit.router.ts`: Lấy `user` và `role` trực tiếp từ `req.user` đã qua xác thực chữ ký token.
4. **R4-06 (High - Role token dùng chéo project & admin backdoor)**:
   - Bỏ role declaration backdoor trong `auth.router.ts`. Bổ sung ghi log kiểm toán khi Admin switch role. Role nghiệp vụ đọc từ `project_members`.
5. **R4-07 (Medium - Role check khi Approved/Changes Requested qua comments)**:
   - `modules/testcases/testcases.router.ts`: Kiểm tra `getUserRoleInProject` chỉ cho phép `Reviewer / Approver`, `PM / Project Lead`, `Project Admin`.
6. **R4-08 (Medium - ID gap & Creator membership)**:
   - `modules/projects/projects.router.ts`: Tính `nextId` theo `maxIndex + 1` dựa trên regex `PRJ-(\d+)`, tự động thêm người tạo vào `project_members` ngay trong transaction tạo dự án.
   - Test: `server/src/tests/documents.test.ts` (Test: Project ID sequence gap safety & creator membership).
7. **R4-09 (Medium - Timeout vs Cancelled & State Machine)**:
   - `modules/workflow/pipelineWorker.ts`: Phân định rõ `isTimeout` (chuyển sang `FAILED`) và `isCancelled` (chuyển sang `CANCELLED`).
   - `modules/workflow/jobQueue.ts`: Không requeue các job thuộc version đã kết thúc (`isVersionTerminated`). Chuyển `llmCaller` kèm signal xuống stage2Runner.
8. **R4-10 (Medium - Version auto-increment & RFC 6266 filename)**:
   - `modules/documents/documents.router.ts`: Tạo migration 012 có unique constraint `idx_doc_versions_doc_ver`. Tính phiên bản mới theo `maxMinor + 1`. Tải file fallback về phiên bản mới nhất và mã hóa RFC 6266 `filename*=UTF-8''`.
   - Test: `server/src/tests/documents.test.ts` (Test: Document version increment & RFC 6266 filename encoding).
9. **R4-11 (Medium - Thứ tự cascade delete RetentionService)**:
   - `modules/documents/retentionService.ts`: Xóa `test_cases`, `test_runs`, `evidence`, `bugs` (hỗ trợ cả `linkedRequirementId` và `requirementId`) TRƯỚC KHI xóa `requirements`.
   - Test: `server/src/tests/workflowSupersede.test.ts` (Test: Cascade retention delete order).
10. **R4-12 (Medium - Semantic Validator Normalization)**:
    - `modules/knowledge/semanticValidator.ts`: Phân định dấu phẩy hàng nghìn `10,000 CCU` vs số thập phân `1,5 giờ`. Quy đổi đơn vị thời gian (1.5h = 90m = 5400s) và đối sánh ngữ cảnh định tính ("timeout" vs "warning").
    - Test: `server/src/tests/semanticUnitValidator.test.ts` (3 tests pass).
11. **R4-13 (Medium - Frontend Auth Lifecycle)**:
    - `src/common/services/api.ts`: Bắt sự kiện 401 bắn `docqa:unauthorized`. Hàm `logout()` xóa sạch token và toàn bộ key `docqa_*` trong `localStorage`.
    - `src/context/AppContext.tsx`: Đăng ký listener `docqa:unauthorized` để kích hoạt đăng xuất và mở modal đăng nhập. Lưu cờ `isOriginalAdmin`. Bổ sung `syncRequestIdRef` và `syncAbortControllerRef` tránh race condition.
    - Test: `src/test/auth.test.ts` (4 tests pass).
12. **R4-14 (Low - Extractor generalization & Eval Gates)**:
    - `modules/ai/stage2Runner.ts`: Tổng quát hóa regex trích xuất yêu cầu theo trợ từ ngữ nghĩa thay vì tập từ khóa eval. Bổ sung cổng baseline gate trong `evalRunner.test.ts`.
13. **R4-15 (Low - Migration 012 & Bảo mật tài khoản)**:
    - Không chỉnh sửa các migration cũ (002, 010, 011). Toàn bộ thay đổi về bảo mật và bảng schema thực hiện hoàn toàn trong **Migration 012**.
14. **BUG-034 (Hardcoded strings)**:
    - Chuyển toàn bộ chuỗi tiếng Việt trong `LoginModal.tsx` sang hệ thống đa ngôn ngữ `src/locales/vi.ts` và `src/locales/en.ts`.
    - Test: `src/test/i18n.test.ts` (2 tests pass).

---

### 3. Kết quả Kiểm thử & Biên dịch Toàn diện

- **Backend Tests**: 28 test suites, 144 tests pass 100% (`npm --prefix server test`).
- **Frontend Tests**: 8 test suites, 24 tests pass 100% (`npm test`).
- **TypeScript & Build**: Zero error (`npm --prefix server run build` và `npm run build`).
- **Test Pollution**: Không ghi dữ liệu test vào `server/data/docqa.sqlite` hoặc thư mục `server/data/files/`.

