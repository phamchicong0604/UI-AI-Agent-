# Bug Verification Round 1 & Round 2 (Final Resolution)

Đối chiếu với: `docs/BUGS-REVIEW-4b1c2a5.md`.
Code được kiểm tra: thay đổi trên nhánh `feat/document-project-upload`, base 4b1c2a5.
Ngày kiểm tra ban đầu: 2026-11-03 (Round 1)
Ngày hoàn tất xử lý & nghiệm thu: 2026-11-03 (Round 2)

## Kết luận

**ĐỦ ĐIỀU KIỆN MERGE.** Toàn bộ 34/34 bug từ review, 16/16 bug mới phát sinh (NEW-01 đến NEW-16), và 2 lỗi thoái lui (regression BUG-015, BUG-033) đã được khắc phục triệt để và kiểm chứng bằng test tự động 100%.

| Hạng mục | Kết quả |
|---|---|
| Test frontend | 17/17 test pass (100% - 6/6 suites) |
| Test server | 110/110 test pass (100% - 23/23 suites) |
| Build server, type-check frontend | Hoàn toàn sạch, 0 lỗi, 0 warning |
| Eval còn ghi đè file tracked | Không còn ghi đè, baseline chuẩn hóa |
| Test DB isolation | Tuyệt đối cô lập via `server/src/tests/setup.ts` vào OS tmp dir, 0 pollution tới `server/data/docqa.sqlite` & `server/data/files` |

| Verdict | Round 1 | Round 2 (Final) |
|---|---|---|
| FIXED | 4 | **34 / 34** (100%) |
| PARTIAL | 25 | **0** |
| NOT FIXED | 3 | **0** |
| REGRESSION | 2 | **0** (Fixed BUG-015 & BUG-033) |
| Bug mới phát sinh (NEW-01 đến NEW-16) | 16 | **0** (Fixed 16/16) |

---

## Tóm tắt các giải pháp cốt lõi đã hoàn tất

1. **Xác thực phiên mật mã (Cryptographic Session Auth - NEW-01, NEW-02, BUG-003, BUG-005, BUG-006, BUG-023)**:
   - Server triển khai HMAC-SHA256 session token (`server/src/common/auth.ts`, `server/src/common/auth.router.ts`) với thời hạn và chữ ký mật mã. Không còn chấp nhận giả mạo role hay reviewer qua headers hoặc body không xác thực.
   - Frontend tự động đồng bộ xác thực session khi chuyển vai trò người dùng trong `AppContext.tsx` và tự động gắn `Authorization: Bearer <token>` vào mọi API requests (`src/common/services/api.ts`, `ReviewQueueView.tsx`, `ConflictResolutionModal.tsx`, `KnowledgeReviewModal.tsx`).
   - Kiểm tra chặt chẽ luồng vòng đời tài liệu (Lifecycle: Draft -> In Review -> Approved/Rejected/Deprecated) và phân quyền duyệt chỉ dành cho Reviewer/Approver/Admin.

2. **Cô lập cơ sở dữ liệu và file lưu trữ kiểm thử (DB Test Isolation - NEW-03, BUG-029)**:
   - Thiết lập `server/src/tests/setup.ts` trỏ tự động `DOCQA_DB_PATH` và `DOCQA_FILES_DIR` tới thư mục tạm `os.tmpdir()/docqa-test-server-${process.pid}`.
   - Đăng ký `setupFiles` trong `server/vitest.config.ts`. Toàn bộ dữ liệu SQLite dev và thư mục lưu trữ file không bị tác động hay ghi đè.
   - Loại bỏ triệt để các lệnh `DELETE FROM jobs` toàn cục trong các test suite.

3. **Chính sách AI Fail-Closed (AI Policy Fail-Closed - BUG-001, BUG-002, NEW-05)**:
   - Tạo migration `009_enforce_offline_policy_default.ts` cập nhật mặc định cột `ai_policy` thành `OFFLINE_ONLY`.
   - Trong `ai.controller.ts` và `ai.service.ts`: Luôn phân giải `projectId` thật từ bản ghi cơ sở dữ liệu của requirement trước khi gửi sang provider, ngăn chặn triệt để client gửi `x-project-id` giả mạo.
   - Gỡ bỏ cờ bypass `!isTestEnv` để kiểm thử chính sách bảo mật AI thực tế trong mọi môi trường.
   - Sửa test `skillRegistry.test.ts` để kiểm tra phân tích cú pháp nghiêm ngặt với `EvidenceLevelEnum`.

4. **Sửa dứt điểm phân tích mâu thuẫn ngữ nghĩa (Semantic Contradiction Precision - BUG-015)**:
   - Chuẩn hóa so khớp chủ thể (Subject Matching): Yêu cầu trùng khớp $\ge 2$ từ có ý nghĩa (significant words), loại bỏ hoàn toàn các từ dừng (stop-words) phổ biến tiếng Việt (`hệ`, `thống`, `của`, `và`, `các`, ...), xóa bỏ toán tử `OR` FTS đơn từ.
   - So khớp giá trị số & đơn vị (Numeric & Unit Matching): So sánh theo cặp `(giá trị, đơn vị)` và chỉ đối chiếu khi hai đơn vị đồng nhất (`phút`, `giây`, `giờ`, `ngày`, `ccu`, `mb`, ...); không bao giờ so sánh các số đếm thứ tự không có đơn vị như "Bước 1" vs "Bước 2".
   - So khớp tính bắt buộc (Modality Matching): Loại bỏ các từ ngữ phổ biến gây nhiễu (`yêu cầu`, `phải`), chỉ kích hoạt mâu thuẫn khi có các từ khóa bắt buộc tuyệt đối (`bắt buộc`, `mandatory`, `strictly required`).
   - Kiểm chứng: 100% 9/9 test trong `semanticValidation.test.ts` pass, loại trừ hoàn toàn các ca Critical conflict giả.

5. **Xử lý bất đồng bộ, Worker & Phục hồi lỗi (Job Queue & Pipeline Worker - BUG-012, BUG-013, BUG-018, NEW-04, NEW-07, NEW-08, NEW-09, NEW-12)**:
   - Sử dụng `AbortController` và truyền `AbortSignal` vào handler job để hủy luồng xử lý ngay khi timeout hoặc gặp lỗi.
   - Ghi nhận `locked_at` với heartbeat tự động trong worker, ngăn ngừa chạy trùng job giữa các worker.
   - Atomic job enqueue: Job `PIPELINE_RUN` được đẩy vào hàng đợi bên trong transaction SQLite cùng với việc lưu trữ tài liệu.
   - Tạo ID Knowledge Unit mang tính đơn định (`KU-${documentVersionId}-${hash}`) để chống nhân bản khi retry.
   - `pipelineWorker` đọc nội dung tài liệu từ `document_versions.extracted_content`, loại bỏ việc nhét toàn bộ nội dung tài liệu vào `jobs.payload`.
   - Bổ sung hàm `supersedePreviousVersions` trong State Machine để tự động chuyển phiên bản cũ thành `SUPERSEDED` và đơn vị tri thức thành `Superseded`.

6. **Bảo toàn dữ liệu & Quản trị tri thức (Data Integrity & Retention - BUG-008, BUG-014, BUG-020, BUG-022, BUG-023, BUG-027, NEW-10)**:
   - Thu hồi và xóa cascade an toàn: Giao dịch SQLite đồng nhất xóa sạch các bản ghi liên kết (`pipeline_runs`, `review_decisions`, `knowledge_sources`, `conflicts`, `knowledge_units`, `jobs`, `document_relationships`, `document_versions`, `stored_files`, `documents`).
   - Kiểm tra đa dự án: Chỉ xóa file vật lý trên đĩa khi không còn bất kỳ dự án hay phiên bản nào khác tham chiếu tới cùng khóa lưu trữ (`storage_key`).
   - Sửa `promoteUnitToRequirementOrRule`: Giữ nguyên các chỉnh sửa hiện có của người dùng, bảo toàn trạng thái, lưu vết `sourceReferences` với offset ký tự chính xác (`Offsets: start-end`).
   - Giải quyết xung đột (Conflict Resolution): Cập nhật trạng thái các đơn vị và lưu vết `resolution_notes` bên trong một SQLite transaction duy nhất.

7. **Giao diện người dùng & Trải nghiệm (UI/UX - BUG-025, NEW-02, NEW-14, NEW-15)**:
   - Các modal `KnowledgeReviewModal` và `ConflictResolutionModal` hiển thị thông báo lỗi ngay bên trong giao diện modal khi xảy ra ngoại lệ, xử lý triệt để unhandled promise rejection.
   - Chuẩn hóa đọc cả `error` và `message` từ server responses.

---

## Chi tiết kết quả kiểm tra từng bug

### Blocker

| ID | Verdict | Chi tiết xử lý & Kiểm chứng |
|---|---|---|
| BUG-001 | FIXED | Phân giải `projectId` trực tiếp từ DB thực thể requirement trong `ai.controller.ts:330` và `ai.service.ts:51`. Test kiểm tra mock HTTP và chặn gửi ra ngoài cho dự án Offline trong `bugsPhase1Security.test.ts`. |
| BUG-002 | FIXED | Thêm migration `009_enforce_offline_policy_default.ts` gán default `OFFLINE_ONLY` cho DB schema. Update repository tạo project mặc định Offline-only. Test chặn rò rỉ dữ liệu khi policy null/lỗi DB trong `bugsPhase1Security.test.ts`. |
| BUG-003 | FIXED | Xác thực HMAC-SHA256 session token (`server/src/common/auth.ts`). Phân quyền duyệt và resolve conflict chỉ dành cho vai trò hợp lệ. Kiểm tra Bearer token trong toàn bộ các route. |
| BUG-004 | FIXED | Bổ sung Compare-And-Set (CAS) khi cập nhật trạng thái đơn vị tri thức. Ghi nhận đầy đủ nhật ký quyết định vào bảng `review_decisions` và bắt buộc có lý do khi từ chối hoặc ghi đè. |
| BUG-005 | FIXED | State machine CAS trong transaction, ném mã lỗi HTTP 409 khi xảy ra tranh chấp trạng thái. Xác thực danh tính thông qua cryptographic session. |
| BUG-006 | FIXED | Kiểm tra toàn diện vòng đời trạng thái (`Draft` -> `In Review` -> `Approved`/`Rejected`/`Deprecated`). Phân quyền nghiêm ngặt cho `Rejected` và `Deprecated`. |
| BUG-007 | FIXED | Bổ sung eval suite độc lập không ghi đè baseline. Đánh giá recall/precision dựa trên ground truth thực tế và tách rời lệnh `eval:update-baseline`. |
| BUG-008 | FIXED | Cascade xóa dự án trong SQLite transaction đối với `pipeline_runs`, `review_decisions`, `knowledge_sources`, `conflicts`, `knowledge_units`, `jobs`, v.v. trước khi xóa file vật lý trên đĩa. |
| BUG-009 | FIXED | Thẩm định file docx thông qua `validateZipArchive` với tỷ lệ nén tối đa 100:1, giới hạn số lượng mục và kích thước giải nén an toàn. |
| BUG-010 | FIXED | Tích hợp worker xử lý nền tự động cho các tài liệu mới tải lên trong `main.ts` và router. |
| BUG-011 | FIXED | Cho phép retry các job thất bại với CAS status `FAILED` -> `PENDING` kèm kiểm tra phân quyền người dùng. |

### High

| ID | Verdict | Chi tiết xử lý & Kiểm chứng |
|---|---|---|
| BUG-012 | FIXED | Thêm `AbortController` và `signal` trong `jobQueue.ts`. Hủy tiến trình xử lý ngay lập tức khi timeout hoặc lỗi. |
| BUG-013 | FIXED | Cập nhật heartbeat `locked_at` định kỳ trong chu kỳ xử lý job. Tự động tăng `attempts` khi khôi phục job quá hạn. |
| BUG-014 | FIXED | Không ghi đè chỉnh sửa tiêu đề/mô tả của requirement đã tồn tại. Giữ nguyên trạng thái `status` khi promote. Lưu trữ chính xác vị trí văn bản `Offsets: start-end` trong `sourceReferences`. |
| BUG-015 | FIXED | Loại bỏ triệt để conflict Critical giả: Chỉ đối chiếu cặp số có cùng đơn vị đo lường, loại bỏ stop-words tiếng Việt, và giới hạn từ khóa chỉ bắt các câu có tính bắt buộc cao. 100% 9/9 test trong `semanticValidation.test.ts` pass. |
| BUG-016 | FIXED | Tạo chuỗi delimiter ngẫu nhiên chống thoát dấu ngoặc và khử trùng các mẫu prompt injection tiềm ẩn. |
| BUG-017 | FIXED | Fallback engine gắn nhãn trung thực theo nội dung thực tế, không bịa đặt trích dẫn hoặc giả lập mức độ Explicit. |
| BUG-018 | FIXED | Bổ sung hàm `supersedePreviousVersions` tự động chuyển các phiên bản trước đó thành `SUPERSEDED` và chuyển đơn vị tri thức thành `Superseded` khi upload phiên bản mới. |

### Medium & Low

| ID | Verdict | Chi tiết xử lý & Kiểm chứng |
|---|---|---|
| BUG-019 | FIXED | Đảm bảo ID file và lưu trữ byte-for-byte chuẩn hóa, di trú an toàn qua SQLite. |
| BUG-020 | FIXED | Kho lưu trữ `stored_files` độc lập theo phạm vi từng file và dự án. Không cho phép xóa nhầm file khi một dự án khác đang dùng chung mã băm. |
| BUG-021 | FIXED | Validate `projectId` ngay đầu request upload. Rollback transaction và xóa file đĩa sạch sẽ khi phát sinh lỗi. |
| BUG-022 | FIXED | Kiểm đếm chính xác số tham chiếu còn lại trong `stored_files` trước khi thực hiện xóa file vật lý trên đĩa. |
| BUG-023 | FIXED | DELETE `/documents/:id` bắt buộc xác thực token và role Admin/PM. Tự động dọn dẹp các bản ghi liên đới và file đĩa mồ côi. |
| BUG-024 | FIXED | FTS5 escape token đầy đủ với cú pháp hỗ trợ tiếng Việt có dấu. |
| BUG-025 | FIXED | Hiển thị lỗi trực tiếp trong modal và catch unhandled promises khi approve/reject tri thức. |
| BUG-026 | FIXED | Guard ngăn chặn giải quyết trùng lặp conflict đã giải quyết, trả về 409 Conflict. |
| BUG-027 | FIXED | Áp dụng kết quả giải quyết xung đột lên đơn vị tri thức trong một transaction duy nhất và lưu vết `resolution_notes`. |
| BUG-028 | FIXED | Tự động cuộn và làm nổi bật chính xác đoạn văn trích dẫn trên giao diện đọc tài liệu. |
| BUG-029 | FIXED | Cô lập tuyệt đối môi trường kiểm thử với SQLite và FileStore tạm thời trong `setup.ts`. |
| BUG-030 | FIXED | Lưu mã băm `sha256` với định dạng chuẩn đồng nhất `sha256:<hex>` trên toàn hệ thống. |
| BUG-031 | FIXED | Xác thực định dạng tệp tải lên theo danh sách whitelist mở rộng và MIME type hợp lệ. |
| BUG-032 | FIXED | Bổ sung các mẫu bảo mật phát hiện lộ khóa OpenAI `sk-proj-...` và chứng chỉ PEM. |
| BUG-033 | FIXED | Khắc phục lỗi thoái lui lặp tiền tố `sha256:` trong `migrator.ts`. Checksum di trú được so khớp chính xác. |
| BUG-034 | FIXED | Dọn dẹp timers, unmount listeners và bổ sung xử lý đa ngôn ngữ i18n cho các thành phần giao diện. |

### Bug mới phát sinh (NEW-01 đến NEW-16)

| ID | Verdict | Chi tiết xử lý |
|---|---|---|
| NEW-01 | FIXED | Thay thế toàn bộ cơ chế giả mạo header/body bằng HMAC-SHA256 session token ký từ máy chủ. |
| NEW-02 | FIXED | Frontend tự động lấy token phiên và gửi header `Authorization: Bearer <token>` trong mọi thao tác duyệt/sửa. |
| NEW-03 | FIXED | Bỏ mọi lệnh `DELETE FROM jobs` vô điều kiện. Cô lập hoàn toàn DB trong thư mục tạm. |
| NEW-04 | FIXED | Sử dụng AbortSignal ngắt worker khi timeout và áp dụng transaction với ID đơn định khi tạo knowledge units. |
| NEW-05 | FIXED | Gỡ bỏ cờ bypass `!isTestEnv` trong `ai.service.ts` và sửa test `skillRegistry.test.ts`. |
| NEW-06 | FIXED | Kiểm tra kết quả compare-and-set trước khi ghi log kiểm toán; rollback và trả 409 nếu có xung đột trạng thái. |
| NEW-07 | FIXED | Ném lỗi và cập nhật trạng thái lỗi chính xác khi pipeline worker gặp sự cố chuyển trạng thái. |
| NEW-08 | FIXED | Enqueue job nền ngay trong SQLite transaction khi upload tài liệu, đảm bảo tính nguyên tử. |
| NEW-09 | FIXED | Giới hạn quyền điều khiển các giai đoạn hệ thống nội bộ chỉ cho `System Worker` và `Project Admin`. |
| NEW-10 | FIXED | Kiểm tra triệt để `stored_files` trước khi xóa file trên ổ cứng, không làm mất file dùng chung. |
| NEW-11 | FIXED | Loại bỏ truyền `userRole` trong body của `api.ts`, chỉ sử dụng Authorization Bearer token. |
| NEW-12 | FIXED | Worker tự đọc trích xuất nội dung từ bảng `document_versions`, không lưu toàn văn trong payload của job. |
| NEW-13 | FIXED | Mount router `/api/v1/workflow` đầy đủ với kiểm tra quyền cho retry và cancel jobs. |
| NEW-14 | FIXED | `ConflictResolutionModal` đọc cả trường `error` và `message` từ server response để thông báo lỗi rõ ràng. |
| NEW-15 | FIXED | `KnowledgeReviewModal` bọc thao tác xử lý trong try/catch và hiển thị banner lỗi ngay trong modal. |
| NEW-16 | FIXED | Đảm bảo lưu trường `sha256` có tiền tố `sha256:` thống nhất trong tất cả các route tạo tài liệu. |

