# Backlog: Bản đồ tri thức (Knowledge Map) cho AI và người tra cứu

Trạng thái: Draft, cần Tech Lead và PM review trước khi đưa vào sprint.
Ngày lập: 2026-11-10. Code đối chiếu: `develop` tại `f749cd4`.
Bổ sung cho: `docs/BACKLOG-PHASE2-KNOWLEDGE-GRAPH.md` (E11 đến E15). File này **không thay thế** Phase 2; nó chỉ ra thứ tự làm, các việc còn thiếu trước Phase 2, và các task mới (E16, E17) mà Phase 2 chưa có.

## 1. Yêu cầu từ phía sản phẩm

Nguồn: trao đổi với Connor Pham ngày 2026-11-10.

| # | Yêu cầu |
|---|---|
| YC-1 | Tài liệu upload được lưu theo dạng "bản đồ": mọi nội dung có địa chỉ, các nội dung liên quan được nối với nhau |
| YC-2 | AI là người tra chính: AI viết test case, AI PM, và các AI khác về sau |
| YC-3 | Người trong team xem và đọc được, nắm thông tin nhanh và rõ |
| YC-4 | Khi hỏi về tài liệu, hệ thống chỉ đúng nội dung cần tìm và lấy đủ thông tin liên quan, không bỏ sót |
| YC-5 | AI không nhận dữ liệu dư thừa hoặc mơ hồ, không tràn context, không trả lời điều không có trong tài liệu |
| YC-6 | Có giao diện bản đồ cho người xem |
| YC-7 | Mở rộng được về sau cho mọi AI và mọi thành viên dự án |

## 2. Hiện trạng đã kiểm chứng

Đã đọc code và chạy `npx vitest run` trong `server/` (189 test pass, 29 file).

| Hạng mục | Hiện trạng | Vị trí |
|---|---|---|
| Phân loại vào 8 thư mục khi upload `AUTO` | Dùng `detectCategory()`, so khớp chuỗi trên tên file, mặc định `01_Project_Overview` | `server/src/modules/documents/documents.router.ts:44` |
| `ClassificationScorer` | Không được gọi ở runtime. Chỉ `classificationScorer.test.ts` và `eval/evalRunner.ts` dùng | `server/src/modules/documents/classificationScorer.ts` |
| Kết quả phân loại của Stage 2 | Chỉ trả trong kết quả job, không ghi vào tài liệu | `server/src/modules/workflow/pipelineWorker.ts:184` |
| LLM trong pipeline | `llmCaller` luôn gọi `generateFallbackResponse` (bộ sinh cố định) | `server/src/modules/workflow/pipelineWorker.ts:85` |
| Cờ `Ambiguous`, `needs_human_review`, `secondary_categories` | Có trong spec, không có trong luồng runtime | `docs/DOCUMENT-TAXONOMY.md` |
| Tìm kiếm toàn văn | Chỉ có `approved_knowledge_fts` (tri thức đã duyệt) | migration 008 |
| Bảng section, entity, cạnh graph | Chưa có | Phase 2: E11-T3, E12-T2 |
| Lỗi bảo mật còn mở | R7-01, R7-02, R7-03 (Medium); R7-04 đến R7-07 (Low) | `docs/BUGS-VERIFICATION-ROUND7.md` |

## 3. Thứ tự làm

```text
M0  Dọn nền: sửa R7, nối phân loại vào luồng upload, đo mốc ban đầu
 │
 v
M1  Địa chỉ: E11 (Phase 2) + tìm kiếm toàn văn trên section + kiểm tra chất lượng khi upload + cây địa chỉ
 │
 v
M2  Bản đồ: E12-T1 đến T6, T11, T12 (Phase 2) + dịch vụ tra cứu chung + trang chủ đề
 │
 v
M3  Mở rộng: E12-T7 đến T10 (Phase 2) + API/MCP cho AI ngoài + AI PM (nếu được duyệt)
 │
 v
M4  Vector: E14 (Phase 2), chỉ khi số đo cho thấy cần

E17 (đánh giá) chạy xuyên suốt từ M0
```

## 4. Quy ước

Giống `BACKLOG-AI-DOCUMENT-PIPELINE.md`. Size S ≤ 1 ngày, M 2–3 ngày, L 4–5 ngày, **là ước lượng sơ bộ, Tech Lead phải xác nhận lại**.

DoD chung: có unit test chạy trên DB tạm, test pass và không sửa file tracked, có audit event cho thao tác thay đổi dữ liệu, có kiểm tra quyền theo project, không sửa migration đã áp dụng (xem R7-05), chuỗi giao diện dùng i18n.

---

## M0. Dọn nền

### M0-T1. Sửa lỗi bảo mật Round 7 — BE, M
Nguồn: `docs/BUGS-VERIFICATION-ROUND7.md`, mục "Ưu tiên cho vòng sau".
- .1 R7-02: migration mới backfill `requirements.project_id`; seed ghi `project_id`; route requirements fail-closed.
- .2 R7-01: chặn PM tự nâng quyền và gỡ Project Admin. **Quy tắc gán role cần PM/TL chốt trước** (quyết định sản phẩm).
- .3 R7-03: `POST /audit/events` chỉ nhận danh sách `entityType` cố định và tài nguyên phải thuộc project đã kiểm tra.
- .4 R7-04, R7-06: dùng `token_version` trong token; viết lại hai test chưa chứng minh được bản sửa.

AC: Reviewer tái kiểm chứng trên server thật. Mỗi mục có test gọi route thật.

### M0-T2. Nối phân loại vào luồng upload — BE, M
- .1 Trong `pipelineWorker`, sau bước trích xuất, gọi `ClassificationScorer` với tên file, đường dẫn, heading và nội dung.
- .2 Ghi kết quả vào tài liệu: danh mục chính, `secondary_categories`, điểm, cờ `isAmbiguous`.
- .3 Quy tắc ghi đè: nếu người upload đã chọn danh mục (khác `AUTO`) thì giữ lựa chọn đó, chỉ lưu đề xuất của scorer để hiển thị.
- .4 Tài liệu `Ambiguous` (điểm cao nhất < 0.40) được đánh dấu `needs_human_review` và lên đầu Review Queue, đúng `DOCUMENT-TAXONOMY.md` mục 3.
- .5 `detectCategory()` chỉ còn là giá trị tạm lúc tạo bản ghi, trước khi pipeline chạy.
- .6 Mỗi lần đổi danh mục tự động có audit event.

AC: Test tích hợp upload qua route thật với `AUTO`, chờ pipeline xong, tài liệu nằm đúng thư mục theo bộ mẫu. Có test cho tài liệu Ambiguous và cho trường hợp người dùng đã chọn danh mục.

### M0-T3. Hiển thị kết quả phân loại — FE, S
Phụ thuộc: M0-T2.
- .1 Trên danh sách và màn đọc tài liệu: hiện danh mục, nhãn phụ, và nhãn "cần xác nhận" cho tài liệu Ambiguous.
- .2 Trong Review Queue: người duyệt chọn lại danh mục bằng API `PATCH /documents/:id/category` đã có.

AC: Có test UI cho nhãn Ambiguous.

### M0-T4. Đo mốc ban đầu — QA + BA, M
Xem E17-T1 và E17-T2. Phải xong trước khi bắt đầu M1 để có số so sánh.

---

## M1. Địa chỉ và tìm kiếm toàn văn

Làm các task Phase 2: **E11-T1, E11-T2, E11-T3, E11-T4, E11-T5**. Bổ sung các task sau.

### E16-T1. Địa chỉ đọc được cho mọi section — BE, S
Phụ thuộc: E11-T3.
- .1 Định nghĩa định dạng địa chỉ: `<projectId>/<category>/<documentId>/<stable_key>`. Ghi vào `DOCUMENT-DATA-MODEL.md`.
- .2 API phân giải địa chỉ thành section của version đang có hiệu lực. Địa chỉ của section đã bị xóa hoặc thay thế trả về trạng thái rõ ràng kèm địa chỉ thay thế nếu có.

AC: Địa chỉ không đổi khi upload version mới mà heading path giữ nguyên. Có test cho section bị xóa.

### E16-T2. Tìm kiếm toàn văn trên mọi section — BE, M
Phụ thuộc: E11-T3, quyết định D3-1.
- .1 Bảng FTS5 trên nội dung section, có `project_id`, `category`, trạng thái (Approved, Draft, Superseded).
- .2 Chuẩn hóa tiếng Việt có dấu và không dấu khi index và khi truy vấn.
- .3 Cập nhật index khi có version mới, khi supersede, khi xóa tài liệu hoặc project.
- .4 Mặc định không trả section của version đã bị thay thế.

AC: Truy vấn luôn lọc theo project và quyền; có test chứng minh không lộ dữ liệu project khác. Có test tiếng Việt không dấu.

### E16-T3. Kiểm tra chất lượng khi upload — BE + AI, M
Phụ thuộc: E11-T3.
- .1 Phát hiện section trùng nội dung (theo `content_hash`) trong cùng project; ghi quan hệ, không tự xóa.
- .2 Phát hiện câu mơ hồ theo danh sách từ do BA quản lý (ví dụ "nhanh", "phù hợp", "khi cần"). Kết quả là cảnh báo cho người duyệt, không chặn upload.
- .3 Phát hiện thuật ngữ viết tắt chưa có định nghĩa trong project.
- .4 Các cảnh báo hiện trong Review Queue cùng tài liệu.

AC: Có test cho từng loại cảnh báo. Không có nội dung nào bị sửa hoặc xóa tự động.

### E16-T4. Giao diện cây địa chỉ — FE, M
Phụ thuộc: E16-T1.
- .1 Cây project → thư mục → tài liệu → section, có ô tìm kiếm dùng E16-T2.
- .2 Bấm vào section mở màn đọc tại đúng đoạn. Có nút sao chép địa chỉ.
- .3 Hiển thị nhãn trạng thái trên từng section.

AC: Wireframe được BA duyệt. Có test UI điều hướng tới đúng section.

**Điều kiện sang M2:** Gate 1 của Phase 2, cộng E16-T1 đến T4 đạt AC, cộng E17 có số đo trên M1.

---

## M2. Bản đồ và dịch vụ tra cứu

Làm các task Phase 2: **E12-T1, T2, T3, T4, T5, T6, T11, T12**. Bổ sung các task sau.

### E16-T5. Dịch vụ tra cứu chung (Knowledge Query Service) — BE + AI, L
Phụ thuộc: E16-T2, E12-T4, E12-T6.
Mục tiêu: một cửa duy nhất cho mọi AI và giao diện. Không bên nào đọc thẳng file hay DB.
- .1 Đầu vào: câu hỏi hoặc từ khóa, `project_id`, người gọi, mục đích (ví dụ `qa`, `testcase`, `pm`), ngân sách token.
- .2 Tìm song song hai kênh: FTS trên section (E16-T2) và entity qua alias (E12-T4). Sau đó mở rộng theo cạnh bằng Graph Query Service (E12-T6).
- .3 Tra theo tầng:
  - Tầng 1 trả danh sách kết quả: địa chỉ, tiêu đề, tóm tắt ngắn, trạng thái, lý do được chọn (khớp từ khóa, khớp entity, hay qua cạnh nào).
  - Tầng 2 trả toàn văn của các section được yêu cầu.
- .4 Ngân sách token: khi vượt, trả phần ưu tiên cao nhất và ghi rõ còn bao nhiêu kết quả chưa hiển thị kèm địa chỉ của chúng. Không cắt im lặng.
- .5 Khử trùng: nội dung trùng `content_hash` chỉ trả một lần, kèm danh sách nơi xuất hiện.
- .6 Nhãn trên mọi kết quả: Approved, Draft, hoặc do AI suy ra. Theo mục đích gọi, áp dụng bộ lọc mặc định (xem D3-1).
- .7 Không có kết quả thì trả kết quả rỗng có cấu trúc, không trả kết quả gần đúng thay thế.
- .8 Ghi log mỗi lượt tra: người gọi, câu hỏi, các địa chỉ đã trả. Log tuân theo `AI-DATA-POLICY.md`.

AC: Có test cho ngân sách token (phần còn lại được báo đủ), khử trùng, kết quả rỗng, và truy vấn khác project. Kết quả đo bằng E17-T3.

### E16-T6. Hợp đồng trả lời có trích dẫn cho trợ lý hỏi đáp — AI, M
Phụ thuộc: E16-T5.
- .1 Skill hỏi đáp mới, có version và JSON Schema như các skill ở E4. Mỗi ý trong câu trả lời phải kèm địa chỉ section và trích dẫn nguyên văn.
- .2 Server kiểm tra trích dẫn khớp nguyên văn với section (dùng lại cơ chế kiểm tra quote hiện có). Ý không qua kiểm tra bị loại và được báo cho người dùng.
- .3 Khi dịch vụ tra cứu trả rỗng, câu trả lời là "tài liệu không có thông tin này".
- .4 Áp dụng policy dữ liệu của project trước khi gửi ngữ cảnh cho provider. Project Offline only không gọi provider ngoài.

AC: Có test cho câu hỏi ngoài tài liệu và cho trích dẫn sai. Kết quả đo bằng E17-T4.

### E16-T7. Chuyển các skill hiện có sang dịch vụ tra cứu — AI + BE, M
Phụ thuộc: E16-T5, E12-T12.
- .1 Sinh test case và phân tích ảnh hưởng lấy ngữ cảnh qua E16-T5 thay vì nạp tài liệu trực tiếp.
- .2 Với đầu ra chính thức (test case), ngữ cảnh mặc định chỉ gồm dữ liệu Approved.

AC: Eval cho thấy chất lượng không giảm so với mốc ban đầu. Số token ngữ cảnh mỗi lượt được ghi nhận.

### E16-T8. Trang chủ đề (Entity Page) — FE + BE, M
Phụ thuộc: E12-T4, E12-T6.
- .1 Một trang cho mỗi entity: định nghĩa, tên gọi khác, quy tắc và yêu cầu liên quan, test case, xung đột, danh sách section nguồn có đường dẫn.
- .2 Phân biệt rõ nội dung Approved và chưa xác nhận.
- .3 Liên kết từ kết quả tìm kiếm và từ màn đọc tài liệu sang trang chủ đề.

AC: Wireframe được BA duyệt. Có test UI. Người không thuộc project không xem được.

**Điều kiện sang M3:** E17-T3 và E17-T4 đạt ngưỡng D3-3.

---

## M3. Mở rộng

Làm các task Phase 2: **E12-T7, T8, T9, T10**. Bổ sung các task sau.

### E16-T9. Mở dịch vụ tra cứu cho AI bên ngoài — BE, M
Phụ thuộc: E16-T5, quyết định D3-4.
- .1 Bọc E16-T5 thành API có xác thực theo token và quyền project, hoặc thành MCP server.
- .2 Giới hạn tần suất và ghi log theo từng client.

AC: Có security review độc lập trước khi bật. Không có đường nào bỏ qua kiểm tra quyền project.

### E16-T10. AI PM tạo task — chưa xác định phạm vi
Dự án hiện chưa có bảng task hay module quản lý task. Cần PM xác nhận phạm vi (D3-2) trước khi phân rã.

---

## E17. Đánh giá hiệu quả (P0, chạy xuyên suốt)

Làm cùng **E13-T1 đến T4** của Phase 2. E13-T4 đã có recall@k và MRR; các task dưới đây bổ sung phần còn thiếu.

### E17-T1. Bộ câu hỏi mẫu từ tài liệu thật — BA + QA, L
Phụ thuộc: quyết định D3-5.
- .1 Chọn tài liệu của một project. Nếu là tài liệu khách hàng, cần xác nhận được phép dùng cho đánh giá.
- .2 Mỗi câu hỏi có danh sách section phải tìm ra, do người gán nhãn. Không dùng AI đang được đo để tạo đáp án. Người gán nhãn không phải người viết code tra cứu.
- .3 Bộ câu hỏi gồm đủ các nhóm:
  - Dùng đúng từ trong tài liệu.
  - Diễn đạt khác chữ, tên gọi khác, tiếng Anh, viết tắt.
  - Thông tin nằm ở nhiều tài liệu.
  - Có hai tài liệu xung đột.
  - Có version cũ và mới.
  - Không có đáp án trong tài liệu.
- .4 Bộ mẫu có version. Bộ `dataset.v1.json` hiện tại (10 tài liệu tự dựng, đang đạt 100%) không dùng làm căn cứ nghiệm thu.

AC: BA và QA duyệt bộ mẫu. Số lượng câu do BA và QA chốt.

### E17-T2. Đo mốc ban đầu — QA + AI, M
Phụ thuộc: E17-T1.
- .1 Chạy bộ câu hỏi trên hệ thống hiện tại (trước M1). Lưu kết quả có version, ghi vào thư mục không tracked.
- .2 Ghi số token ngữ cảnh mỗi lượt theo cách nạp hiện tại.

AC: Có báo cáo mốc. Không có số liệu gán cứng.

### E17-T3. Chỉ số tra cứu — QA + AI, M
Phụ thuộc: E16-T5.
- .1 Recall và precision theo từng nhóm câu hỏi.
- .2 Số token trả về mỗi câu hỏi, so với mốc.
- .3 Tỷ lệ từ chối đúng trên nhóm câu không có đáp án.
- .4 Tỷ lệ trả nội dung của version đã bị thay thế.

AC: Cố ý làm hỏng một kênh tìm kiếm thì chỉ số giảm và eval fail.

### E17-T4. Chỉ số chất lượng đầu ra của AI — QA + AI, M
Phụ thuộc: E16-T6, E16-T7.
- .1 Tỷ lệ ý trong câu trả lời có trích dẫn khớp nguyên văn.
- .2 Tỷ lệ ý không có nguồn.
- .3 Với sinh test case: tỷ lệ yêu cầu được phủ, và Human Correction Rate (đã có ở E10-T2), so cách cũ với cách mới trên cùng đầu vào.

AC: Báo cáo so sánh trước và sau trên cùng bộ mẫu.

### E17-T5. Chặn hồi quy trong CI — QA, S
Phụ thuộc: E17-T3.
- .1 Chỉ số thấp hơn mốc quá ngưỡng cho phép thì pipeline fail. Ngưỡng do TL chốt.

### E17-T6. Phản hồi từ người dùng — FE + BE, S
Phụ thuộc: E16-T4 hoặc E16-T8.
- .1 Nút báo "kết quả sai hoặc thiếu" trên kết quả tìm kiếm và câu trả lời.
- .2 Mỗi báo cáo được xem xét để thêm vào bộ câu hỏi mẫu.

AC: Báo cáo được lưu kèm câu hỏi và các địa chỉ đã trả, có kiểm tra quyền project.

---

## 5. Quyết định cần chốt

Owner: PM + TL. Bổ sung cho D2-1 đến D2-6 của Phase 2.

| ID | Quyết định | Khuyến nghị của TECHVIFY | Ảnh hưởng |
|---|---|---|---|
| D3-1 | Nội dung chưa duyệt có được tìm thấy không | Có, kèm nhãn, cho tra cứu của người và hỏi đáp. Đầu ra chính thức (test case, cảnh báo ảnh hưởng) chỉ dùng dữ liệu Approved. Lưu ý: Phase 2 hiện quy định chỉ dùng dữ liệu Approved (E12-T12, E14-T3), nên điểm này cần chốt rõ | E16-T2, T5, T7 |
| D3-2 | Phạm vi "AI PM tạo task" | Chưa có khuyến nghị; cần PM mô tả task được tạo ở đâu và ai duyệt | E16-T10 |
| D3-3 | Ngưỡng nghiệm thu cho recall, precision, tỷ lệ từ chối đúng | BA và TL chốt sau khi có mốc E17-T2 | Điều kiện sang M3 |
| D3-4 | Hình thức mở cho AI ngoài: REST API hay MCP | Chốt khi tới M3, dựa trên client thực tế | E16-T9 |
| D3-5 | Dùng tài liệu project nào làm bộ mẫu, ai gán nhãn | Cần xác nhận quyền sử dụng dữ liệu nếu là tài liệu khách hàng | E17-T1 |
| D3-6 | Pipeline có gọi LLM thật không, với project nào | Trích entity và quan hệ bằng luật cố định sẽ yếu với tiếng Việt. Dùng LLM phải theo `AI-DATA-POLICY.md`; mặc định hiện là Offline only | E12-T4, T5, E16-T6 |
| D3-7 | Ai duyệt entity và cạnh do AI suy ra | BA hoặc QA của project | E12-T11 |

## 6. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Không ai duyệt entity và cạnh, bản đồ chỉ có dữ liệu chưa xác nhận | Chốt D3-7 trước M2. Đo khối lượng duyệt ở E13-T3 |
| Tài liệu không có heading, chia section kém | E11-T3.2 chia theo đoạn. Đo ở E13-T2 |
| Ngân sách token làm mất thông tin cần thiết | E16-T5.4 luôn báo phần chưa hiển thị. Đo recall ở E17-T3 |
| Cho tìm nội dung chưa duyệt làm AI dùng nhầm | Nhãn bắt buộc trên mọi kết quả, bộ lọc theo mục đích (D3-1), test ở E16-T7 |
| Bộ mẫu không đại diện, số đo đẹp giả | E17-T1.2 và .3; bổ sung từ phản hồi thật (E17-T6) |
| Vẫn còn câu trả lời sai dù có trích dẫn đúng | Giữ bước người review cho đầu ra quan trọng. Theo dõi Human Correction Rate |
| Gửi dữ liệu khách hàng ra provider ngoài | D3-6 và policy theo project; E16-T6.4 |

## 7. Việc dev làm ngay được, không phụ thuộc quyết định

- M0-T1.1, .3, .4 (R7-02, R7-03, R7-04, R7-06).
- M0-T2 và M0-T3 (nối phân loại vào luồng upload).
- E11-T1, E11-T2 (Phase 2).

Các việc còn lại chờ quyết định ở mục 5 hoặc chờ task phụ thuộc.
