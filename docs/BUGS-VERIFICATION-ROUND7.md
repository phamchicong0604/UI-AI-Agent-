# Bug Verification Round 7

Đối chiếu với: `docs/BUGS-VERIFICATION-ROUND6.md`, gồm phần reviewer và phần "Dev Submission - Round 6".
Code được kiểm tra: `develop` tại `2fd2843`. Commit này chưa merge vào `main`; `main` vẫn ở `19d611e`.
Ngày kiểm tra: 2026-11-04.

Phương pháp:
- Chạy toàn bộ test và build.
- Chạy server thật trên một DB tạm. Toàn bộ user và thành viên project được tạo qua API mới (`POST /auth/users`, `POST /projects/:id/members`), không sửa DB trực tiếp.
- Chạy migration 001 đến 011, tạo dữ liệu giả lập DB đang dùng (có version trùng và mật khẩu admin đã đổi), rồi chạy migration 012 và 013 **thật**.
- Đọc diff của `2fd2843`.

Ký hiệu ✔ nghĩa là tôi đã tự kiểm chứng trên server thật hoặc bằng script. Mục chỉ dựa vào đọc code được ghi rõ.

## Kết luận

**Không còn lỗi mức Blocker hoặc High.** Đây là vòng đầu tiên cả 5 điều kiện đóng vòng đều đạt trên các route đã thử. R6-01, R6-02, R6-07 và R6-08 đã được sửa đúng và tôi đã tái kiểm chứng trên server thật.

Quy trình cũng tốt hơn rõ:
- Code chưa merge vào `main`.
- Dev ghi trạng thái "chờ Reviewer duyệt".
- Mỗi mục đều kèm tên test.

Còn 3 lỗi mức Medium, đều nhỏ và sửa nhanh:
- **R7-01:** PM tự nâng mình lên Project Admin.
- **R7-02:** requirement thiếu `projectId` vẫn fail-open.
- **R7-03:** vẫn ghi được audit giả vào log của project khác.

Khuyến nghị sửa 3 mục này trước khi merge vào `main`. Tech Lead có thể chọn chấp nhận rủi ro R7-03 nếu có lý do, nhưng đó là quyết định của con người, không phải của reviewer.

| Hạng mục | Kết quả |
|---|---|
| Test frontend | 24 test pass, 8 file ✔ |
| Test server | 189 test pass, 29 file ✔ |
| Build server, build frontend | Không có lỗi ✔ |
| Test có ghi vào DB dev hoặc file tracked không | Không ✔ |

## Kết quả 5 điều kiện đóng vòng

| # | Điều kiện | Kết quả | Bằng chứng |
|---|---|---|---|
| 1 | Chưa đăng nhập thì nhận 401 | **Đạt** | Không có thay đổi làm hỏng |
| 2 | Người ngoài project nhận 403 | **Đạt, trừ requirement thiếu `projectId`** ✔ | User chỉ thuộc PRJ-02 nhận 403 với `EVD-001`, `RUN-2026-11-01`, `BUG-001` và khi verify `EVD-001`. Riêng `REQ-001` vẫn mở, xem R7-02 |
| 3 | Role lấy theo project của tài nguyên | **Đạt** ✔ | User là PM ở PRJ-01 và QA ở PRJ-02, dùng token PRJ-01: `PATCH /documents/DOC-FCB-01/category` nhận 403, `DELETE /documents/DOC-FCB-01` nhận 403. Đối chứng: đổi category tài liệu PRJ-01 nhận 200. User có role toàn cục là QA nhận 403 khi `POST /projects` |
| 4 | Không còn seed, bắt đổi mật khẩu | **Đạt** ✔ | pm, ba, dev, qa và reviewer đều không đăng nhập được. `GET /projects?x=/auth/me`, `/documents?...&z=/auth/logout` và `/projects/` đều nhận 403; `/auth/me` nhận 200. User mới tạo qua API cũng bị bắt đổi mật khẩu (403 trước khi đổi) |
| 5 | Supersede | **Đạt** | Không có thay đổi làm hỏng |

## Bug mới ở round 7

| ID | Mức | Vấn đề | Bằng chứng |
|---|---|---|---|
| R7-01 | Medium | PM tự nâng mình lên Project Admin, và gỡ được Project Admin khỏi project | ✔ User `yuser` là PM ở PRJ-01 gọi `POST /projects/PRJ-01/members` với chính `userId` của mình và `role: "Project Admin"`, nhận 201. Cùng user đó gọi `DELETE /projects/PRJ-01/members/usr_admin`, nhận 200. Code: `projects.router.ts` (route members) chỉ kiểm tra người gọi có role Admin hoặc PM, không giới hạn role được gán. Đề xuất: PM chỉ gán được role thấp hơn mình, không tự sửa role của mình, và không gỡ Project Admin. Quy tắc cụ thể cần được chốt như một quyết định sản phẩm |
| R7-02 | Medium | Requirement thiếu `projectId` vẫn fail-open | ✔ Trên DB mới, `REQ-001` có `project_id = NULL`: migration 013 không backfill bảng `requirements`, và dữ liệu seed được chèn sau khi migration chạy. User chỉ thuộc PRJ-02 gọi `GET /requirements/REQ-001` nhận 200, và `PATCH /requirements/REQ-001/status` với `Draft` nhận 200, ghi được. Nguyên nhân: `requirements.router.ts` chỉ kiểm tra khi `reqItem.projectId` có giá trị, giống lỗi R6-03 đã sửa ở evidence, testruns và bugs. Seed `TC-AUTH-001` cũng có `project_id = NULL`, nhưng route testcases trả 403/404 đúng ✔ |
| R7-03 | Medium | Vẫn ghi được audit giả vào log của project khác | ✔ User QA chỉ thuộc PRJ-01 gọi `POST /audit/events` với `action: "CONFLICT_RESOLVED"`, `entityType: "Other"`, `entityId: "PRJ-02"`, nhận 201. Event này hiện trong `GET /audit/events?projectId=PRJ-02`. Hai trường hợp khác đã bị chặn đúng: `entityType` là `Document` hoặc `Project` trỏ sang PRJ-02 (400), và action `ADMIN_ROLE_SWITCH` (400). Bộ lọc GET vẫn dùng `e.details.includes(projectId)`. Khuyến nghị giữ như round 6: audit do server sinh ra, hoặc ít nhất từ chối `entityType` không thuộc danh sách cho phép |
| R7-04 | Low | Token cấp cùng giây với lần đổi mật khẩu không bị thu hồi | ✔ Token admin cấp chưa tới 1 giây trước khi đổi mật khẩu vẫn trả 200 sau khi đổi. Nếu cách nhau hơn 1 giây thì token cũ nhận 401 ✔. Nguyên nhân: `auth.ts:191` so sánh `iat < passwordChangedAt` ở đơn vị giây. Cột `token_version` đã được migration 013 thêm vào nhưng chưa được dùng ở đâu; nên đưa `token_version` vào token và so sánh trực tiếp |
| R7-05 | Low | Migration 012 bị sửa sau khi đã merge vào `main` | `2fd2843` sửa `012_remove_seed_users_and_enforce_admin_security.ts`, trong khi file này đã nằm trên `main` từ `19d611e`. Trên DB đã chạy 012 bản cũ, migrator chỉ in WARNING lệch checksum (`migrator.ts:132-137`) và không chạy lại, nên không có tác động dữ liệu. Nhưng điều này vẫn vi phạm quy tắc không sửa migration đã áp dụng. Lần sau, bản sửa nên được đưa vào một migration mới |
| R7-06 | Low | Hai test không chứng minh được bản sửa | (a) Test `renumbers duplicates collision-resistantly...` (`round6VerificationSecurity.test.ts:571-630`) chép lại logic khử trùng ngay trong test và chạy trên bảng tự tạo; nó không gọi migration 012, nên vẫn pass nếu revert migration. Tôi đã tự chạy migration 012 thật: 3 dòng trước, 3 dòng sau, các bản trùng thành `1.0-dup2`, `1.0-dup1` không đổi ✔. (b) Test thu hồi token đặt `changedAt` lùi về 1 giây sau, nên che mất R7-04 |
| R7-07 | Low | Role của người tạo project lấy từ token | Theo đọc code: `POST /projects` dùng `creatorRole = req.user?.role`. Người có role toàn cục PM nhưng đăng nhập vào một project với role QA sẽ thành QA ở project mới của chính mình. Không phải lỗi bảo mật, nhưng sai hành vi |

**Ghi chú:** `src/components/documents/documentTemplate.ts` chứa template nội dung tài liệu chỉ bằng tiếng Việt. Đây là dữ liệu template, không phải chuỗi UI, nên tôi không ghi thành bug. Nếu sản phẩm cần tài liệu song ngữ thì cần tách template theo ngôn ngữ.

## Kết quả các mục R6

| ID | Kết quả | Ghi chú |
|---|---|---|
| R6-01 | **FIXED** ✔ | Xem điều kiện 3 |
| R6-02 | **FIXED** ✔ | So khớp chính xác đường dẫn sau khi bỏ query string |
| R6-03 | **PARTIAL** ✔ | Evidence, testruns và bugs đã fail-closed và được backfill. Requirements vẫn hở, xem R7-02 |
| R6-04 | **PARTIAL** ✔ | Đã chặn action nhạy cảm và chặn `entityType` Document/Project trỏ sang project khác. `verify-chain` đã lọc theo project (user PRJ-02 thấy 0 event). Còn R7-03 |
| R6-05 | **FIXED**, theo đọc code và test | Project chỉ lấy từ requirement và tài liệu trong DB; tài liệu nguồn phải cùng project |
| R6-06 | **FIXED** ✔, còn R7-01 | Đã có `GET/POST/DELETE /auth/users` chỉ cho system admin, và API members. User mới mặc định phải đổi mật khẩu |
| R6-07 | **FIXED** ✔ | Kiểm chứng bằng migration thật, không dựa vào test (xem R7-06) |
| R6-08 | **FIXED** ✔, còn R7-04 | Token của user đã xóa nhận 401 cả ở `/auth/me` và `/projects` |
| R6-09 | **FIXED**, theo đọc code | Upload và `syncAccountModels` đã qua `handleResponseStatus`; có xử lý 403 `MUST_CHANGE_PASSWORD` qua sự kiện `docqa:must-change-password`; `finally` reset `isSyncing` khi request bị abort |
| R6-10 | **PARTIAL** | Đa số test mới là test thật, gọi route thật. Còn R7-06 |
| Lỗi 500 khi `POST /documents` trùng id | **FIXED**, theo test | Test mong đợi 409. Tôi chưa chạy lại trên server thật |
| BUG-034 | **FIXED** ✔ | Script đếm của tôi: 0 dòng tiếng Việt gán cứng trong `src/components/**/*.tsx` (không tính comment) |

Các mục cũ khác (BUG-014, 016, 019, 025, 027, NEW-02, R2-04, R3-13) không có thay đổi trong vòng này, nên giữ trạng thái như round 5.

## Ưu tiên cho vòng sau

1. **R7-02**:
   - Backfill `requirements.project_id` trong một migration mới.
   - Seed phải ghi `project_id`.
   - Route requirements phải fail-closed.
   - Thêm test với requirement không có `projectId`.
2. **R7-01**: chốt quy tắc gán role, rồi chặn PM tự nâng quyền và chặn gỡ Project Admin. Thêm test.
3. **R7-03**: chỉ cho phép danh sách `entityType` cố định và bắt buộc tài nguyên phải thuộc project đã kiểm tra, hoặc bỏ hẳn `POST /audit/events` khỏi client.
4. **R7-04, R7-06**:
   - Dùng `token_version` trong token.
   - Viết lại test R6-07 để gọi `migration012...up()` thật.
   - Thêm test thu hồi token cấp cùng giây với lần đổi mật khẩu.

## Ghi chú quy trình

- Vòng này không merge vào `main` trước khi verify, và mọi mục đều ghi "chờ Reviewer duyệt". Đây là cách làm đúng; đề nghị giữ nguyên.
- Phần Dev Submission vẫn còn câu "bao phủ trọn vẹn 100%" cho R6-10; thực tế còn 2 test chưa chứng minh được bản sửa (R7-06). Đề nghị bỏ các con số tuyệt đối.
- Không sửa migration đã nằm trên `main` (R7-05).
- `main` (`19d611e`) vẫn đang chứa lỗi R6-01 (xóa tài liệu chéo project). Khi các mục R7-01 đến R7-03 đã sửa, nên merge sớm để `main` không tiếp tục mang lỗi Blocker. Thời điểm merge là quyết định của Tech Lead.
- Trước khi release, phần auth vẫn nên có một lượt security review độc lập.
