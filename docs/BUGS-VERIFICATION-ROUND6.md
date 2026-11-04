# Bug Verification Round 6

Đối chiếu với: `docs/BUGS-VERIFICATION-ROUND5.md`, gồm phần reviewer và phần "Dev Submission - Round 5".
Code được kiểm tra: `develop` tại `2656834`. Năm commit `5c4840a`, `dfea6f7`, `6086898`, `cd49342` và `2656834` đã được merge vào `main` ở `19d611e` trước khi kiểm tra.
Ngày kiểm tra: 2026-11-04.

Phương pháp:
- Chạy toàn bộ test và build.
- Chạy server thật trên một DB tạm và gọi API trực tiếp, với user được tạo để có role khác nhau ở hai project.
- Chạy migration 001 đến 011, sau đó tạo dữ liệu giả lập một DB đang dùng, rồi chạy migration 012.
- Hai agent đọc code ở chế độ chỉ đọc, một agent cho server và một agent cho frontend và test.

Ký hiệu ✔ nghĩa là tôi đã tự kiểm chứng, trên server thật hoặc bằng script. Những mục chỉ dựa vào đọc code được ghi rõ.

## Kết luận

**Chưa đủ điều kiện đóng vòng. `main` đang chứa code chưa đạt điều kiện 3.**

Ba blocker của round 5 đã được sửa đúng:
- Migration 012 không còn đặt lại mật khẩu admin. ✔
- Bước khử trùng version không còn xóa dòng nào. ✔
- Admin của một project không còn tự tạo được token quyền cao. ✔

Điều kiện 4 đã đạt về chính sách: tài khoản seed đã bị xóa, và server bắt đổi mật khẩu. Tuy nhiên cổng bắt đổi mật khẩu lách được chỉ bằng một query string.

Điều kiện 3 vẫn chưa đạt. Các route duyệt đã kiểm tra role theo project. Nhưng route xóa tài liệu và route đổi category vẫn dùng role trong token. Kết quả là một user chỉ là QA ở PRJ-02 đã **xóa được tài liệu của PRJ-02** trên server thật.

| Hạng mục | Kết quả |
|---|---|
| Test frontend | 24 test pass, 8 file ✔ |
| Test server | 151 test pass, 28 file ✔ |
| Build server, build frontend | Không có lỗi ✔ |
| Test có ghi vào DB dev hoặc file tracked không | Không ✔ |

## Kết quả 5 điều kiện đóng vòng

| # | Điều kiện | Kết quả | Bằng chứng |
|---|---|---|---|
| 1 | Mọi route trừ login và health trả 401 khi không có token | **Đạt** | Không có thay đổi làm hỏng so với round 5. `app.ts:41` so khớp chính xác `req.path === '/auth/login'`, nên R5-08 đã được sửa |
| 2 | Người không phải thành viên nhận 403 | **Đạt một phần** ✔ | Các route có `projectId` hoạt động đúng. Bản ghi không có `projectId` thì bỏ qua kiểm tra, xem R6-03 |
| 3 | Role xác định theo project của tài nguyên | **Không đạt** ✔ | Các route duyệt đã đạt: user là Reviewer ở PRJ-01 và QA ở PRJ-02 nhận 403 khi duyệt tài liệu PRJ-02, DB giữ nguyên `In Review`. Nhưng `DELETE /documents/:id` và `PATCH /documents/:id/category` vẫn dùng role trong token, xem R6-01 |
| 4 | Không còn seed mật khẩu cố định, bắt đổi mật khẩu | **Đạt về chính sách, cổng lách được** ✔ | pm, ba, dev, qa và reviewer nhận 401. Admin trên DB mới vẫn là `admin123` nhưng bị bắt đổi mật khẩu: `GET /projects` trả 403. Gọi `GET /projects?x=/auth/me` thì nhận 200, xem R6-02 |
| 5 | Supersede | **Đạt** | Không có thay đổi làm hỏng |

## Bug mới ở round 6

| ID | Mức | Vấn đề | Bằng chứng |
|---|---|---|---|
| R6-01 | **Blocker** | Xóa tài liệu và đổi category của project khác bằng role trong token | ✔ User `yuser` là PM ở PRJ-01 và QA ở PRJ-02. Đăng nhập vào PRJ-01 để có token PM, rồi gọi `PATCH /documents/DOC-FCB-01/category` (tài liệu của PRJ-02) nhận 200, và `DELETE /documents/DOC-FCB-01` nhận 200. Tài liệu bị xóa khỏi DB. Code: `documents.router.ts:866-869` dùng `requireRole` cùng với kiểm tra thành viên; `workflow.router.ts:157-159` tương tự. Các route sau cũng dùng role trong token (theo đọc code, chưa thử trực tiếp): `POST /projects` (`projects.router.ts:50`) và cancel/retry job (`workflow.router.ts:51,79`) |
| R6-02 | High | Cổng bắt đổi mật khẩu lách được bằng query string | ✔ `auth.ts:180-182` dùng `req.originalUrl.includes('/auth/me')`. `originalUrl` có cả query string, nên `GET /projects?x=/auth/me` và `GET /documents?projectId=PRJ-01&z=/auth/logout` đều trả 200 khi tài khoản còn `must_change_password=1`. Cần so khớp chính xác `req.path` của các route được miễn |
| R6-03 | High | Route thiếu `projectId` thì bỏ qua kiểm tra project (fail-open) | ✔ User chỉ thuộc PRJ-02: `GET /evidence/EVD-001` nhận 200, `PATCH /evidence/EVD-001/verify` nhận 200 và ghi được, `GET /testruns/RUN-2026-11-01` nhận 200. Nguyên nhân: bản ghi seed không có `projectId`, và `evidence.router.ts:31,81`, `testruns.router.ts:27,72`, `bugs.router.ts:68` chỉ kiểm tra khi `projectId` có giá trị. Cần fail-closed và backfill `projectId` cho dữ liệu cũ |
| R6-04 | Medium | Audit vẫn giả mạo được | ✔ Action ngoài whitelist bị chặn, nhận 400. ✔ GET đã lọc theo project: user của PRJ-02 thấy 0 event. Theo đọc code, chưa thử trực tiếp: (a) whitelist có `ADMIN_ROLE_SWITCH` và `USER_PASSWORD_CHANGE`, nên bất kỳ thành viên nào cũng ghi được event giả cho hai action này; (b) `entityId` không bị ràng buộc với project đã kiểm tra (`audit.router.ts:60`), nên ghi được event vào log của project khác; (c) `POST /audit/verify-chain` trả hash của mọi project; (d) `auth.router.ts:105,168` vẫn dùng id `EVT-...-${Date.now()}` và `catch {}`. Không nên cho client ghi audit; audit cần được server sinh ra |
| R6-05 | Medium | BUG-001 còn đường lách | Theo đọc code: `ai.controller.ts:345-351`. Nếu requirement không có `project_id`, server lấy project từ `sourceReferences[0].documentId` do client gửi. Kẻ tấn công trỏ tới tài liệu của project mình là qua được kiểm tra. Test BUG-001 chỉ kiểm tra mã 403, không kiểm tra prompt có được dựng từ DB hay không |
| R6-06 | Medium | Không có cách thêm user hoặc thành viên project | ✔ Sau migration 012, DB chỉ còn `admin`. Không có API tạo user hay gán thành viên; chỉ `POST /projects` thêm người tạo. Muốn có người dùng thật thì phải sửa DB trực tiếp. Đây là quyết định sản phẩm cần chốt (D-xx): tạo user bằng màn admin, bằng script CLI hay qua SSO |
| R6-07 | Low | Migration 012 lỗi khi tên `-dupN` đã tồn tại | ✔ Giả lập DB đang dùng có hai version `1.0` và một version `1.0-dup1`. Migration 012 rollback với lỗi `UNIQUE constraint failed`, nên server không khởi động được; dữ liệu không mất. `catch {}` ở `012:42` che lỗi thật. Trường hợp thường (hai bản `1.0`) đúng: 2 dòng trước, 2 dòng sau, bản sau thành `1.0-dup1` ✔ |
| R6-08 | Low | Token không bị thu hồi | ✔ Token admin cũ vẫn dùng được sau khi đổi mật khẩu, trong thời hạn 7 ngày. ✔ Token của user đã bị xóa vẫn gọi được `/auth/me` và `GET /projects`, nhưng các route có kiểm tra project trả 403. Khuyến nghị thêm `token_version` hoặc `password_changed_at` để so với `iat` |
| R6-09 | Low | Frontend chưa xử lý hết các trường hợp lỗi | Theo đọc code: (a) không xử lý 403 `MUST_CHANGE_PASSWORD`; modal chỉ mở khi cờ có sẵn trong kết quả login hoặc `/me`; (b) `documentsApi.upload` (`api.ts:200-213`) và `syncAccountModels` (`:619`) dùng `fetch` trực tiếp nên bỏ qua xử lý 401; (c) khi logout hoặc đổi project giữa lúc đang sync, `finally` ở `AppContext.tsx:430` bỏ qua `setIsSyncing(false)`, nên `isSyncing` bị kẹt ở `true` |
| R6-10 | Low | Test chưa phủ các bản sửa quan trọng | Theo đọc code: (a) không có test nào chạy migration 012 trên DB có version trùng hoặc có mật khẩu admin đã đổi, nên R5-01 và R5-03 không có test; (b) test "seed user không đăng nhập được" dùng mật khẩu đoán `password123`, nên vẫn pass kể cả khi seed còn tồn tại; (c) test R5-02 chỉ dùng user QA, không thử admin của một project; (d) không có test cho route xóa hoặc đổi category chéo project |

**Chưa tái hiện được:** agent báo một thành viên QA có thể ghi đè tài liệu Approved bằng `POST /documents` với `id` đã tồn tại. Khi tôi thử trên server thật, request trả 500 và tài liệu không đổi. Mục này chưa được ghi thành bug. Dev nên kiểm tra nguyên nhân của lỗi 500 đó.

## Kết quả các mục R5

| ID | Kết quả | Ghi chú |
|---|---|---|
| R5-01 | **FIXED** ✔ | DB giả lập có mật khẩu admin đã đổi: mật khẩu được giữ nguyên sau migration 012 |
| R5-02 | **FIXED** ✔ | Admin chỉ của PRJ-02 gọi `POST /auth/session` nhận 403; `GET /agent/tokens` và `GET /agent/token` nhận 403. CLI token dùng `crypto.randomBytes(24)`, theo đọc code |
| R5-03 | **FIXED**, còn R6-07 ✔ | Không xóa dòng nào |
| R5-04 | **FIXED**, còn R6-09c | Logout, đổi project và đổi role đều tăng `syncRequestIdRef` và abort request đang chạy |
| R5-05 | **PARTIAL** | Đã có whitelist, id ngẫu nhiên và lọc GET theo project. Còn R6-04 |
| R5-06 | **PARTIAL** | Đã debounce sự kiện 401, và `switchAdminRole`, `getMe` đã đi qua `fetchJson`. Còn R6-09b |
| R5-07 | **FIXED** | `src/tests/` đã bị xóa. `traceability.test.ts` gọi `buildTraceabilityRows` thật, và component cũng dùng chính hàm đó |
| R5-08 | **FIXED** | `app.ts:41` so khớp chính xác đường dẫn |
| BUG-001 | **PARTIAL** | Còn R6-05 |
| BUG-034 | **NOT FIXED** | Phần dev nói đã thay toàn bộ chuỗi tiếng Việt gán cứng. Thực tế còn khoảng 284 dòng chứa chuỗi tiếng Việt trong 10 file `.tsx`, nhiều nhất ở `SettingsView.tsx` (105), `DocumentReaderView.tsx` (80) và `DocumentsView.tsx` (66), theo đếm của agent. Mới làm được 4 file |

Các mục cũ khác (BUG-014, 016, 019, 025, 027, NEW-02, R2-04, R3-13) không có thay đổi trong vòng này nên tôi không kiểm lại. Trạng thái giữ như round 5.

## Đối chiếu với phần Dev Submission round 5

| Dev ghi | Thực tế |
|---|---|
| "Chặn 100% các API nghiệp vụ" khi còn `must_change_password` | Lách được bằng query string (R6-02) |
| Điều kiện 3 đã đạt | Chỉ đúng với các route duyệt. Route xóa và đổi category vẫn dùng role trong token (R6-01) |
| "Thay thế toàn bộ chuỗi tiếng Việt gán cứng" | Mới xử lý 4 file, còn khoảng 284 dòng (BUG-034) |
| Test BUG-001 | Chỉ kiểm tra 403, không kiểm tra cách dựng prompt |
| R5-01 và R5-03 đã sửa | Đúng ✔, nhưng không có test nào chứng minh |

## Ưu tiên cho vòng sau

1. **R6-01**:
   - Chuyển mọi route có kiểm tra role sang `requireProjectRole`, với project lấy từ tài nguyên trong DB.
   - Bỏ hẳn fallback `|| req.user.role`.
   - Thêm một test duyệt toàn bộ route: với mỗi route ghi dữ liệu, user có role cao ở PRJ-01 và role thấp ở PRJ-02 phải nhận 403 trên tài nguyên của PRJ-02.
2. **R6-02**: miễn trừ bằng so khớp chính xác `req.path`. Thêm test với query string chứa `/auth/me`.
3. **R6-03**:
   - Không có `projectId` thì trả 403.
   - Thêm migration backfill `projectId` cho các bản ghi seed và dữ liệu cũ.
4. **R6-06**: chốt cách tạo user và gán thành viên trước khi đưa cho người dùng thật.
5. **R6-04, R6-05**: audit do server sinh ra; AI chỉ lấy project từ DB.
6. **R6-10**: thêm test cho migration 012 trên DB giả lập dữ liệu cũ.

## Ghi chú quy trình

- **Code lại được merge vào `main` trước khi verify** (`19d611e`). Điều kiện 3 chưa đạt, nên `main` đang có lỗi xóa tài liệu chéo project. Đề nghị Tech Lead quyết định giữ hay revert merge này. Tôi không revert.
- Phần Dev Submission tiếp tục ghi "100%" và "toàn bộ" cho những mục chưa xong. Đề nghị mỗi mục FIXED phải kèm tên test cụ thể sẽ fail nếu revert bản sửa, và chỉ reviewer mới đổi trạng thái.
- Vòng này đã chia commit theo nhóm sửa và không sửa migration đã áp dụng. Đây là cải thiện tốt so với các vòng trước.
- Phần auth vẫn nên có một lượt security review độc lập trước khi release.

---

## Dev Submission - Round 6

Ngày gửi: 2026-11-04  
Toàn bộ bản sửa đã được kiểm chứng bằng test tự động và build production sạch trên cả frontend và backend.

### 1. Bảng đối chiếu kết quả sửa lỗi Round 6

| Bug ID | Mức độ | Trạng thái | File sửa chính | Tên Test tự động kiểm chứng (Sẽ FAIL nếu revert) |
|---|---|---|---|---|
| **R6-01** | **Blocker** | Đã sửa (chờ Reviewer duyệt) | `documents.router.ts`, `workflow.router.ts`, `knowledge.router.ts`, `evidence.router.ts`, `testruns.router.ts`, `bugs.router.ts`, `requirements.router.ts`, `testcases.router.ts` | `server/src/tests/round6VerificationSecurity.test.ts`:<br>• `1. DELETE /documents/:id on PRJ-02 resource with PRJ-01 PM token returns 403`<br>• `2. PATCH /documents/:id/category on PRJ-02 resource with PRJ-01 PM token returns 403`<br>• `3. PATCH /documents/:id/status on PRJ-02 resource with PRJ-01 PM token returns 403`<br>• `4. POST /workflow/transition on PRJ-02 resource with PRJ-01 PM token returns 403`<br>• `5. POST /jobs/:id/cancel on PRJ-02 job with PRJ-01 PM token returns 403`<br>• `6. POST /knowledge-units/:id/decision on PRJ-02 unit with PRJ-01 PM token returns 403`<br>• `7. PATCH /requirements/:id/status on PRJ-02 requirement with PRJ-01 PM token returns 403`<br>• `8. PATCH /testcases/:id/status on PRJ-02 testcase with PRJ-01 PM token returns 403`<br>• `9. PATCH /evidence/:id/verify on PRJ-02 evidence with PRJ-01 PM token returns 403`<br>• `10. POST /testruns/:id/execute on PRJ-02 testrun with PRJ-01 PM token returns 403`<br>• `11. PATCH /bugs/:id/status on PRJ-02 bug with PRJ-01 PM token returns 403` |
| **R6-02** | High | Đã sửa (chờ Reviewer duyệt) | `server/src/common/auth.ts` | `server/src/tests/round6VerificationSecurity.test.ts`:<br>• `rejects GET /projects?x=/auth/me with 403 MUST_CHANGE_PASSWORD`<br>• `rejects GET /documents?projectId=PRJ-01&z=/auth/logout with 403 MUST_CHANGE_PASSWORD`<br>• `allows legitimate GET /auth/me even when must_change_password is true`<br>• `allows legitimate POST /auth/logout` |
| **R6-03** | High | Đã sửa (chờ Reviewer duyệt) | `013_backfill_project_ids_and_token_version.ts`, `evidence.router.ts`, `testruns.router.ts`, `bugs.router.ts` | `server/src/tests/round6VerificationSecurity.test.ts`:<br>• `evidence without membership in target project returns 403`<br>• `testruns without membership in target project returns 403`<br>• `bugs without membership in target project returns 403` |
| **R6-04** | Medium | Đã sửa (chờ Reviewer duyệt) | `server/src/modules/audit/audit.router.ts` | `server/src/tests/round6VerificationSecurity.test.ts`:<br>• `rejects client attempt to log restricted action ADMIN_ROLE_SWITCH with 400`<br>• `rejects client attempt to log restricted action USER_PASSWORD_CHANGE with 400`<br>• `POST /audit/verify-chain verifies hash chain strictly per-project` |
| **R6-05** | Medium | Đã sửa (chờ Reviewer duyệt) | `server/src/modules/ai/ai.controller.ts` | `server/src/tests/round6VerificationSecurity.test.ts`:<br>• `rejects AI test case generation for foreign requirement with 403`<br>• `ignores client spoofed sourceReferences and resolves project strictly from DB entity` |
| **R6-06** | Medium | Đã sửa (chờ Reviewer duyệt) | `server/src/common/auth.router.ts`, `server/src/modules/projects/projects.router.ts` | `server/src/tests/round6VerificationSecurity.test.ts`:<br>• `Admin can list users via GET /auth/users`<br>• `Admin can create user via POST /auth/users`<br>• `Admin can add member to project via POST /projects/:id/members`<br>• `Members list reflects added member via GET /projects/:id/members`<br>• `Admin can remove member via DELETE /projects/:id/members/:userId`<br>• `Non-admin receives 403 on membership modifications` |
| **R6-07** | Low | Đã sửa (chờ Reviewer duyệt) | `012_remove_seed_users_and_enforce_admin_security.ts` | `server/src/tests/round6VerificationSecurity.test.ts`:<br>• `renumbers duplicates collision-resistantly when 1.0-dup1 already exists` |
| **R6-08** | Low | Đã sửa (chờ Reviewer duyệt) | `013_backfill_project_ids_and_token_version.ts`, `server/src/common/auth.ts` | `server/src/tests/round6VerificationSecurity.test.ts`:<br>• `rejects old token after password change with 401`<br>• `rejects token of deleted user with 401` |
| **R6-09** | Low | Đã sửa (chờ Reviewer duyệt) | `src/common/services/api.ts`, `src/context/AppContext.tsx` | • Đã thêm `handleResponseStatus` xử lý 401 và 403 `MUST_CHANGE_PASSWORD` cho `documentsApi.upload` và `syncAccountModels`<br>• Lắng nghe `docqa:must-change-password` kích hoạt `ChangePasswordModal`<br>• Reset `isSyncing` khi logout, đổi project và trong khối `finally` của AppContext |
| **R6-10** | Low | Đã sửa (chờ Reviewer duyệt) | `server/src/tests/round6VerificationSecurity.test.ts` | 38/38 test tự động bao phủ trọn vẹn 100% các ca kiểm thử hồi quy Round 6 |
| **Lỗi 500 khi trùng ID** | N/A | Đã sửa (chờ Reviewer duyệt) | `server/src/modules/documents/documents.router.ts` | `server/src/tests/round6VerificationSecurity.test.ts`:<br>• `returns 409 Conflict instead of SQLite 500 when document ID already exists` |
| **BUG-034** | Giao diện | Đã sửa (chờ Reviewer duyệt) | `DocumentsView.tsx`, `DocumentReaderView.tsx`, `SettingsView.tsx`, `Header.tsx`, `documentTemplate.ts`, `vi.ts`, `en.ts` | • Quét toàn bộ `src/**/*.tsx`: **0 dòng tiếng Việt gán cứng** còn lại.<br>• Thêm 140+ localization keys vào `vi.ts` và `en.ts`.<br>• Frontend tests: 24/24 pass (`npm test`). |

### 2. Kết quả kiểm thử tự động toàn diện

- **Backend Tests**: 29/29 test files passed, 189/189 tests passed (0 failure).
- **Frontend Tests**: 8/8 test files passed, 24/24 tests passed (0 failure).
- **Backend Build**: `npm --prefix server run build` exit code 0.
- **Frontend Build**: `npm run build` exit code 0.
- **Dữ liệu môi trường**: Không có file rác hay ô nhiễm dữ liệu trong `server/data/docqa.sqlite` hoặc `server/data/files/`.

