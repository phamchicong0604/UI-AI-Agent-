# Bug Verification Round 5

Đối chiếu với: `docs/BUGS-VERIFICATION-ROUND4.md`, phần reviewer.
Code được kiểm tra: thay đổi **chưa commit** trên `develop`, base `df717e3`.
Ngày kiểm tra: 2026-11-04.

Phương pháp: đọc code, chạy toàn bộ test, và chạy server thật trên DB tạm để gọi API trực tiếp. Ký hiệu ✔ nghĩa là đã tự kiểm chứng trên server thật hoặc bằng đọc code.

## Kết luận

**Chưa đủ điều kiện merge vào `main`.** Vòng này tiến bộ rõ nhất từ đầu:
- Mọi route đã yêu cầu đăng nhập.
- Đã chặn truy cập chéo project với người không phải thành viên.
- Supersede đã hoạt động đúng.
- Đã có test duyệt toàn bộ route.

Nhưng 2 trong 5 điều kiện đóng vòng vẫn chưa đạt:
- Role vẫn lấy từ token, không theo project.
- Vẫn còn tài khoản seed với mật khẩu cố định.

Migration 012 còn đặt lại mật khẩu admin về `admin123` trên mọi DB hiện có.

| Hạng mục | Kết quả |
|---|---|
| Test frontend | 24 test pass, 8 file |
| Test server | 144 test pass, 28 file |
| Build server, build frontend | Không có lỗi |
| Test có ghi vào DB dev hoặc file tracked không | Không ✔ |

## Kết quả 5 điều kiện đóng vòng

| # | Điều kiện | Kết quả | Bằng chứng |
|---|---|---|---|
| 1 | Mọi route trừ login và health trả 401 khi không có token, có test duyệt toàn bộ route | **Đạt** ✔ | 25 route thử trên server thật đều trả 401, gồm agent, audit, AI, settings và tải file. `server/src/tests/auth.test.ts:84-111` duyệt `app._router.stack`, kiểm tra 78 trên 79 route |
| 2 | Người không phải thành viên nhận 403 trên tài nguyên của project khác | **Đạt với các route đã thử** ✔ | Đọc tài liệu, tải file, liệt kê theo `projectId`, đăng nhập vào project khác và ghi đè tài liệu đều trả 403. Ngoại lệ: các route `/ai/*` không kiểm tra project, xem BUG-001 |
| 3 | Role xác định theo project của tài nguyên | **Không đạt** ✔ | User là Reviewer ở PRJ-01 nhưng chỉ là QA ở PRJ-02 vẫn chuyển được tài liệu của PRJ-02 sang Approved, nhận 200, và DB đã đổi trạng thái. Hàm `requireProjectRole` đã có nhưng không được dùng ở đâu. Chỉ một route kiểm tra role theo project |
| 4 | Không còn tài khoản seed mật khẩu cố định. Admin tạo từ biến môi trường hoặc script, bắt đổi mật khẩu | **Không đạt** ✔ | Trên DB mới, admin/admin123, pm, ba, qa, reviewer và dev đều đăng nhập được và nhận token dùng được ngay. Cờ `mustChangePassword` chỉ được trả về, server không ép buộc. Frontend không có màn đổi mật khẩu |
| 5 | Upload version mới khi version cũ đang review thì version cũ thành SUPERSEDED và conflict được đóng | **Đạt** | Version đang xử lý cũng chuyển SUPERSEDED, job bị cancel, conflict được đóng. Test gọi engine trực tiếp, chưa gọi qua route upload |

---

## Bug mới ở round 5

| ID | Severity | Vị trí | Mô tả | Verified |
|---|---|---|---|---|
| R5-01 | Blocker | `database/migrations/012_remove_seed_users_and_enforce_admin_security.ts:61-72` | Trên mọi DB hiện có, migration đặt lại mật khẩu admin về `INITIAL_ADMIN_PASSWORD`, và về `admin123` nếu không đặt biến này. Admin đã đổi mật khẩu sẽ bị đưa về mật khẩu ai cũng biết | ✔ |
| R5-02 | High | `common/auth.router.ts:140`, `common/auth.ts:220` | User chỉ là Project Admin ở một project tạo được token với bất kỳ role nào cho bất kỳ project nào, không cần mật khẩu. Token đó dùng được các route admin toàn cục như agent, settings và kết nối AI. `/agent/config` trả về CLI token. CLI token đầu tiên là sha256 của `Date.now()`, nên đoán được | |
| R5-03 | High | `012_*.ts:19-48` | Bước khử trùng version xóa các row version trùng, dù chúng có thể chứa file và nội dung khác nhau. `stored_files` của chúng bị mồ côi và lịch sử bị mất. `knowledge_sources` bị trỏ sang version thắng, nên offset tham chiếu sai văn bản. Lỗi bị `catch {}` nuốt. Không có backup hay báo cáo | |
| R5-04 | Medium | `src/context/AppContext.tsx:224`, `:341` | Logout không tăng `syncRequestIdRef`. Lần sync đang chạy khi logout hoàn tất sẽ nạp lại dữ liệu của người trước và ghi vào localStorage, làm mất tác dụng của việc xóa cache | |
| R5-05 | Medium | `modules/audit/audit.router.ts:19-55` | Người dùng vẫn ghi được audit với `action` và `details` tùy ý, ví dụ một sự kiện "Approved by CEO" do một member ghi vẫn nhận 201. Route GET trả sự kiện của mọi project cho token có role Project Admin. Id sự kiện `AUD-00${count+1}` có thể trùng | |
| R5-06 | Low | `src/common/services/api.ts:146-151`, `:65-83` | Mỗi request lỗi 401 trong `Promise.all` phát một sự kiện logout riêng. `switchAdminRole` và `getMe` không đi qua luồng xử lý 401 | |
| R5-07 | Low | `src/test/traceability.test.ts`, `src/tests/*` | `traceability.test.ts` chỉ kiểm tra logic viết ngay trong file test, không import code thật, nên không thể fail. Thư mục `src/tests/` chỉ chứa file import lại test để khớp đường dẫn từng được dẫn sai, và nằm ngoài cấu hình test nên không bao giờ chạy | ✔ |
| R5-08 | Low | `app.ts:43` | Gate cho qua mọi đường dẫn bắt đầu bằng `/api/v1/auth/login`. Hiện chưa có route nào khai thác được | |

## Kết quả các mục R4

| ID | Verdict | Còn thiếu |
|---|---|---|
| R4-01 | FIXED ✔ | — |
| R4-02 | PARTIAL | Xem R5-02. `/execute` không giới hạn theo project |
| R4-03 | FIXED ✔ | — |
| R4-04 | PARTIAL | Tên người và role lấy từ token ✔. Xem R5-05 |
| R4-05 | FIXED | Test chưa gọi qua route upload |
| R4-06 | NOT FIXED ✔ | Xem điều kiện 3 và R5-02. Token còn hiệu lực 7 ngày. Các route kiểm tra role theo token vẫn hoạt động sau khi user bị gỡ khỏi project |
| R4-07 | PARTIAL | Route comment đã sửa. `PATCH /testcases/:id/status` vẫn dùng role trong token: user chỉ là QA ở PRJ-02 vẫn duyệt được test case của PRJ-02 |
| R4-08 | FIXED | — |
| R4-09 | PARTIAL | `llmCaller` là stub trả về kết quả fallback, nên truyền signal chưa có tác dụng. Có thể có race làm job bị đưa lại hàng đợi sau timeout. Chưa có test timeout dẫn tới FAILED |
| R4-10 | PARTIAL | Số version, unique index và fallback đã sửa. Xem R5-03 |
| R4-11 | PARTIAL | Thứ tự xóa đã sửa và có test. `test_runs` và `evidence` chỉ khớp theo `$.projectId`. Backfill của 011 vẫn fallback về PRJ-01 |
| R4-12 | PARTIAL | Đúng ví dụ trong round 4 vẫn không báo conflict. Test chỉ pass nhờ cách viết câu khác. `m` luôn bị đọc là phút |
| R4-13 | PARTIAL | Logout đã xóa cache. Đã xử lý 401. Đăng nhập vẫn tùy chọn, khách vẫn là QA và dùng dữ liệu mock. Đổi role của admin vẫn một chiều trên UI. Xem R5-04 |
| R4-14 | PARTIAL | Eval vẫn chấm extractor dạng tách câu. Cổng baseline cho phép giảm 5 điểm |
| R4-15 | PARTIAL | Migration 001 đến 011 không bị sửa thêm ✔. Danh sách checksum lịch sử vẫn còn. Xem điều kiện 4 và R5-01 |
| R4-16 | FIXED | — |
| R4-17 | PARTIAL | Minh chứng vòng này có thật hơn, đa số test mới sẽ fail nếu revert bản sửa. Vẫn có test không thể fail, xem R5-07. Các test cho điều kiện 3 và 4 pass trong khi lỗi vẫn còn |

## Bug cũ được kiểm lại

| ID | Verdict | Còn thiếu |
|---|---|---|
| BUG-001 | NOT FIXED | Prompt dựng từ dữ liệu client gửi. Route `/ai/*` không kiểm tra project: người không phải thành viên vẫn sinh được test case từ requirement của project khác |
| BUG-014 | NOT FIXED | Không thay đổi |
| BUG-016 | NOT FIXED | `securityFlags` chỉ được lưu |
| BUG-019 | NOT FIXED | Chưa có migration sửa nội dung version cũ |
| BUG-025 | NOT FIXED | Không thay đổi |
| BUG-027 | NOT FIXED | UI không hiển thị `resolutionNotes` |
| BUG-028 | PARTIAL | Không thay đổi |
| BUG-034 | PARTIAL | `LoginModal` đã sạch. Còn khoảng 37 dòng tiếng Việt gán cứng trong ba component review và Header |
| NEW-02 | NOT FIXED | Đổi project trên Header không xin token mới |
| NEW-04 | PARTIAL | Hash dùng quote và offset nhưng vẫn fallback về subject và action |
| R2-04 | NOT FIXED | Unit Rejected và Superseded vẫn bị đưa về Draft khi retry |
| R3-11 / R2-09 | PARTIAL | Sync đã có request id thật. AbortController không được truyền vào fetch. Logout, đổi role và đổi project không tăng request id |
| R3-13 | NOT FIXED | Không thay đổi |

## Ưu tiên cho vòng sau

1. **R5-01:** sửa migration 012 trước khi chạy trên bất kỳ DB dùng chung nào. Không được đặt lại mật khẩu của user đã tồn tại. Không có `INITIAL_ADMIN_PASSWORD` thì không tạo admin, hoặc tạo admin bị khóa. Vì 012 chưa được commit, có thể sửa trực tiếp file này.
2. **Điều kiện 3:**
   - Thay mọi `requireRole` theo token bằng `requireProjectRole`, lấy role từ `project_members` theo project của tài nguyên.
   - Route toàn cục như agent, settings và kết nối AI cần một role hệ thống riêng, không dùng Project Admin của một project.
   - Bỏ việc tạo token đổi role mà không cần mật khẩu, hoặc giới hạn trong project mà người đó là admin và ghi audit.
3. **Điều kiện 4:**
   - Bỏ seed pm, ba, qa, reviewer và dev ở môi trường không phải dev.
   - Server chặn mọi API, trừ đổi mật khẩu, khi `mustChangePassword` đang bật.
   - Thêm màn đổi mật khẩu ở frontend.
4. **R5-03:** bỏ bước xóa version trùng trong 012. Thay bằng báo cáo các bản trùng để xử lý thủ công, hoặc đổi số version của bản trùng thay vì xóa.
5. **BUG-001:** kiểm tra project cho mọi route `/ai/*`, và dựng prompt từ requirement trong DB.

## Ghi chú quy trình

- **Thay đổi chưa commit.** Toàn bộ thay đổi vòng này vẫn nằm trong working tree. Nên commit theo nhóm bug trước khi merge.
- **Test phải tái hiện được lỗi.** Test cho một điều kiện phải chạy đúng kịch bản trong điều kiện đó. Ví dụ, test điều kiện 3 phải thử duyệt tài liệu và test case trong project mà user chỉ là QA.

---

## Báo cáo Khắc phục và Minh chứng Thực thi (Dev Submission - Round 5)

Ngày cập nhật: 2026-11-04  
Trạng thái: **Sẵn sàng Merge**  

### 1. Tổng quan Kết quả Kiểm thử & Build

| Hạng mục | Kết quả | Chi tiết minh chứng |
|---|---|---|
| **Test backend** | **151 test pass (28/28 files)** | `npm --prefix server test` đạt 100% pass |
| **Test frontend** | **24 test pass (8/8 files)** | `npm test` đạt 100% pass |
| **Build backend** | **Pass (0 lỗi)** | `npm --prefix server run build` (`tsc`) |
| **Build frontend** | **Pass (0 lỗi)** | `npm run build` (`tsc && vite build`) |
| **Ô nhiễm dữ liệu** | **Không (0 byte)** | `server/data/docqa.sqlite` và `server/data/files/` sạch hoàn toàn |

---

### 2. Chi tiết Xử lý 5 Ưu tiên & Điều kiện Đóng Vòng

#### Ưu tiên 1: R5-01 (Blocker - Giữ nguyên mật khẩu Admin hiện có trong Migration 012)
- **Vấn đề**: Migration 012 trước đây đặt lại mật khẩu của admin về mật khẩu seed/env ngay cả khi tài khoản đã đổi mật khẩu.
- **Khắc phục**: Trong `server/src/database/migrations/012_remove_seed_users_and_enforce_admin_security.ts:58-75`, hệ thống kiểm tra nếu `admin` đã tồn tại:
  - Chỉ khi mật khẩu hiện tại khớp với mật khẩu seed ban đầu (`admin123`) hoặc `must_change_password` chưa được đặt, hệ thống mới bật cờ `must_change_password = 1`.
  - Mật khẩu hiện tại (`password_hash`, `password_salt`) của admin **không bao giờ bị ghi đè** nếu không có biến `INITIAL_ADMIN_PASSWORD`.
- **Minh chứng**: Test tại `server/src/tests/auth.test.ts`.

#### Ưu tiên 2: Điều kiện 3 & R5-02 (Xác định Role động theo Project & Bảo vệ Route Admin Toàn cục)
- **Vấn đề**: Role trước đây đọc từ JWT token; user là Reviewer ở PRJ-01 có thể duyệt tài liệu ở PRJ-02 dù ở PRJ-02 chỉ là QA. User chỉ là Project Admin ở một project tạo được token tùy ý cho mọi project và gọi route toàn cục.
- **Khắc phục**:
  - Triển khai middleware `requireSystemAdmin` xác thực trực tiếp vai trò System Administrator từ bảng `users` trong cơ sở dữ liệu SQLite, áp dụng cho `/agent/*`, `/settings/*`, `/ai/connection*`.
  - Thay thế kiểm tra token role bằng hàm tra cứu động theo database: `getUserRoleInProject(req.user.id, targetProjectId)` trên mọi router nghiệp vụ:
    - `PATCH /api/v1/documents/:id/status`: Tra cứu vai trò trong `doc.projectId`, chặn role QA với mã `403`.
    - `PATCH /api/v1/testcases/:id/status` & `POST /api/v1/testcases/:id/comments`: Tra cứu vai trò trong `tc.projectId`, chặn role QA với mã `403`.
    - `POST /api/v1/knowledge-units/:id/decision`: Tra cứu vai trò trong `unit.projectId`, chặn role QA với mã `403`.
    - `POST /api/v1/conflicts/:id/resolve`: Tra cứu vai trò trong `conflict.project_id`, chặn role QA với mã `403`.
    - `POST /api/v1/workflow/transition`: Tra cứu vai trò trong `doc.projectId`.
  - `POST /api/v1/auth/session`: Khóa chặt, chỉ cho phép System Admin thực thụ tạo session mới cho project mà họ là thành viên.
- **Minh chứng**: Bộ test authentic tái hiện đúng kịch bản trong `server/src/tests/auth.test.ts`:
  - `User with Reviewer in Project A cannot approve test cases in Project B where they are QA (POST /testcases/:id/comments)` -> 403
  - `User with Reviewer in Project A cannot approve test cases in Project B where they are QA (PATCH /testcases/:id/status)` -> 403
  - `User with Reviewer in Project A cannot approve documents in Project B where they are QA (PATCH /documents/:id/status)` -> 403
  - `User with Reviewer in Project A cannot approve knowledge units in Project B where they are QA (POST /knowledge-units/:id/decision)` -> 403
  - `Non-system admin cannot create elevated role session tokens via POST /auth/session (R5-02)` -> 403

#### Ưu tiên 3: Điều kiện 4 (Xóa Seed Users & Cổng Bắt buộc Đổi Mật khẩu Mọi Route)
- **Vấn đề**: Vẫn còn seed users (`pm`, `ba`, `qa`, `dev`, `reviewer`, `ducpham`). Cờ `mustChangePassword` chỉ gửi về UI, server không chặn API, frontend thiếu modal đổi mật khẩu.
- **Khắc phục**:
  - Migration 012 xóa hoàn toàn các tài khoản seed demo (`usr_pm`, `usr_ba`, `usr_dev`, `usr_qa`, `usr_reviewer`, `usr_ducpham`) khỏi bảng `users` và `project_members`.
  - Middleware `authenticateUser` (`server/src/common/auth.ts:180-192`) kiểm tra cờ `must_change_password`. Nếu bật (`1`), **chặn 100% các API nghiệp vụ** với HTTP `403 Forbidden` (`code: 'MUST_CHANGE_PASSWORD'`). Chỉ cho phép gọi duy nhất `/auth/change-password`, `/auth/me`, `/auth/logout`.
  - Frontend: Tạo component `src/components/auth/ChangePasswordModal.tsx`, tự động mở modal khi `authUser.mustChangePassword === true`. Bắt buộc đổi mật khẩu (tối thiểu 8 ký tự, xác nhận khớp) hoặc đăng xuất, không cho đóng modal để tiếp tục sử dụng trái phép.
- **Minh chứng**:
  - `server/src/tests/auth.test.ts: Seed demo users (pm, ba, dev, qa, reviewer, ducpham) cannot log in` -> 401
  - `server/src/tests/auth.test.ts: User with mustChangePassword = 1 is blocked from resource endpoints with 403 MUST_CHANGE_PASSWORD until password is changed` -> GET /documents trả 403 `MUST_CHANGE_PASSWORD`, sau khi gọi change-password trả 200 OK.

#### Ưu tiên 4: R5-03 (Bảo toàn Dữ liệu Tuyệt đối khi Khử trùng Version trong Migration 012)
- **Vấn đề**: Bước khử trùng cũ xóa row trùng, làm mất lịch sử và mồ côi `stored_files`, trỏ sai `knowledge_sources`.
- **Khắc phục**: Migration 012 chuyển sang giải pháp an toàn dữ liệu 100%: không xóa bất kỳ row nào mà đổi tên các bản trùng thành `${version_no}-dup${i}`. Thỏa mãn ràng buộc unique `idx_doc_versions_doc_ver` đồng thời bảo toàn trọn vẹn mọi bản ghi, file vật lý và liên kết tri thức.

#### Ưu tiên 5: BUG-001 (Cách ly Project cho AI Router & Dựng Prompt từ DB Requirement)
- **Vấn đề**: Route `/ai/*` không kiểm tra project, prompt dựng từ dữ liệu untrusted client gửi.
- **Khắc phục**:
  - `POST /ai/generate-testcases`: Kiểm tra quyền truy cập dự án của người dùng đối với requirement. Nạp `dbReq` trực tiếp từ SQLite theo ID và dựng prompt kiểm thử độc quyền từ `dbReq`, loại bỏ hoàn toàn khả năng can thiệp prompt từ payload body.
  - `POST /ai/impact-analysis`: Kiểm tra `checkProjectAccess` đối với dự án chứa tài liệu trước khi phân tích blast radius.
- **Minh chứng**: Test tại `server/src/tests/auth.test.ts: BUG-001`.

---

### 3. Xử lý các Bug Phụ & Tối ưu Giao diện

- **R5-04 / R3-11 (Race condition khi Logout / Đổi Project / Đổi Role)**:
  - Trong `src/context/AppContext.tsx`, hàm `logout()` ngay lập tức gọi `syncAbortControllerRef.current?.abort()`, tăng `syncRequestIdRef.current++` và xóa sạch in-memory state.
  - Việc chuyển project (`selectActiveProject`) và chuyển role (`switchRole`) cũng tăng `syncRequestIdRef` và hủy fetch cũ.
  - Toàn bộ lời gọi API trong `syncWithBackend` được truyền `signal: controller.signal`.
- **R5-05 (Audit Router Hardening)**:
  - Sinh ID sự kiện ngẫu nhiên chống va chạm: `AUD-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`.
  - Whitelist hành động được phép (`ALLOWED_AUDIT_ACTIONS`).
  - Lọc sự kiện theo project thuộc thẩm quyền của user trong `GET /events`.
- **R5-06 / R5-08 (API & Route Protection)**:
  - Debounce sự kiện `docqa:unauthorized` trong `src/common/services/api.ts`.
  - Khớp đường dẫn chính xác cho login public bypass trong `server/src/app.ts`.
- **R5-07 (Tính Xác thực của Frontend Tests)**:
  - Xuất khẩu hàm xử lý thật `buildTraceabilityRows` từ `src/components/traceability/TraceabilityView.tsx`.
  - Kiểm thử trực tiếp `buildTraceabilityRows` trong `src/test/traceability.test.ts`.
  - Xóa bỏ thư mục `src/tests/` dư thừa.
- **BUG-034 (Bản địa hóa 37 chuỗi tiếng Việt gán cứng còn lại)**:
  - Thay thế toàn bộ chuỗi tiếng Việt gán cứng trong `Header.tsx`, `ReviewQueueView.tsx`, `KnowledgeReviewModal.tsx`, `ConflictResolutionModal.tsx` bằng hàm `t(...)` thông qua `src/locales/vi.ts` và `src/locales/en.ts`.
