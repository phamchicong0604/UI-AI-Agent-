# Backlog Phase 2: Tài liệu chuẩn, Knowledge Graph và Vector

Trạng thái: Draft, cần Tech Lead và PM review trước khi đưa vào sprint.
Nối tiếp: `docs/BACKLOG-AI-DOCUMENT-PIPELINE.md` (E0 đến E10).
Đầu vào: `docs/BUGS-REVIEW-4b1c2a5.md` và `docs/BUGS-VERIFICATION-ROUND1.md`.

## Lộ trình

```text
GATE 0: Fix bugs xong
   │
   v
E11  Hoàn thiện upload, lưu trữ, tài liệu chuẩn
   │        GATE 1
   v
E12  Knowledge Graph trong SQLite + cảnh báo ảnh hưởng tự động
   │        GATE 2
   v
E14  Vector (có điều kiện, chỉ làm khi eval chứng minh cần)

E13  Evaluation mở rộng: chạy xuyên suốt từ E11, là căn cứ cho Gate 1, 2 và quyết định E14
E15  Spike Graphify cho liên kết code (tùy chọn, P2)
```

## Quy ước

Quy ước giống `BACKLOG-AI-DOCUMENT-PIPELINE.md`.

| Trường | Ý nghĩa |
|---|---|
| ID | `E<epic>-T<task>`, subtask đánh số `.1 .2 ...` |
| Priority | P0 nền tảng, làm trước. P1 tính năng lõi. P2 mở rộng |
| Size | S ≤ 1 ngày, M 2–3 ngày, L 4–5 ngày. **Là ước lượng sơ bộ, Tech Lead phải xác nhận lại** |
| Role | BE, FE, AI, QA, BA, TL |
| DoD chung | Có unit test chạy trên DB tạm, `npm run test:all` pass và không sửa file tracked, có audit event cho thao tác thay đổi dữ liệu, có kiểm tra quyền theo project |

---

## GATE 0: Điều kiện bắt đầu

Phase 2 chỉ bắt đầu khi các điều kiện sau đã đạt và đã được review lại:

- [ ] Đã sửa các bug Blocker: BUG-001 đến BUG-011.
- [ ] Đã sửa các bug mới mức Blocker và High: NEW-01 đến NEW-04.
- [ ] Đã sửa các bug ảnh hưởng trực tiếp tới graph: BUG-014, BUG-015, BUG-018, BUG-019 và BUG-020.
- [ ] Xác thực dùng session hoặc token do server ký. Không còn đọc role từ header hoặc body do client gửi.
- [ ] Test chạy trên DB tạm và không ghi vào DB dev.
- [ ] Các thay đổi đã được commit theo nhóm và đã qua review lại.

**Lý do:** graph được xây từ Knowledge Unit đã duyệt và từ các liên kết hiện có. Nếu phân quyền, promote, supersede hay phát hiện conflict còn sai, lỗi sẽ lan theo mọi cạnh của graph.

## Quyết định cần chốt trước Phase 2

| ID | Quyết định | Phương án khuyến nghị | Ảnh hưởng |
|---|---|---|---|
| D2-1 | Lưu graph ở đâu | Bảng quan hệ trong SQLite. Truy vấn nhiều bước bằng recursive CTE. Không dùng Neo4j ở giai đoạn này | E12 |
| D2-2 | Định dạng "tài liệu chuẩn" | Markdown chuẩn hóa theo template của từng loại tài liệu, sinh ra từ file gốc. File gốc vẫn giữ nguyên | E11 |
| D2-3 | Cạnh do AI suy luận có cần duyệt không | Có. Cạnh INFERRED chỉ được dùng cho cảnh báo ảnh hưởng chính thức sau khi được duyệt | E12 |
| D2-4 | Độ sâu tối đa khi lan ảnh hưởng | Mặc định 4 bước, Project Admin cấu hình được. **TL chốt sau khi đo trên dữ liệu thật** | E12-T6 |
| D2-5 | Ngưỡng mở E14 | Do BA và TL chốt dựa trên kết quả E13-T4 | E14 |
| D2-6 | Thư viện vẽ graph trên UI | Bắt đầu bằng dạng danh sách và cây. Chỉ thêm thư viện vẽ graph khi UX yêu cầu, và phải được TL duyệt | E12-T10 |

---

## E11. Hoàn thiện upload, lưu trữ và tài liệu chuẩn (P0)

Mục tiêu: mỗi tài liệu có một nguồn nội dung duy nhất, được chia section ổn định, và có bản chuẩn hóa để trích xuất tri thức.

### E11-T1. Gom về một nguồn nội dung — BE, M
- .1 Route xem và tải tài liệu đọc từ `document_versions` và `stored_files`, không đọc từ `documents.data.contentMarkdown` nữa.
- .2 Viết migration mới để chuyển nội dung cũ sang version. Không sửa migration đã chạy.
- .3 Bỏ ghi `contentMarkdown` ở mọi luồng tạo và cập nhật tài liệu.
- .4 Frontend đọc nội dung qua API version.

AC: Tìm trong code không còn chỗ nào ghi `contentMarkdown`. Mọi tài liệu cũ vẫn xem được. Có test migration với dữ liệu cũ.

### E11-T2. Storage key theo project — BE, S
- .1 Đổi định dạng storage key thành `<projectId>/<yyyy>/<mm>/<fileId>_<safeName>`, đúng như `DOCUMENT-DATA-MODEL.md`.
- .2 Viết migration di chuyển file cũ, kèm bước kiểm tra checksum sau khi di chuyển.

AC: Xóa project chỉ cần xóa một thư mục. Checksum mọi file khớp sau migration.

### E11-T3. Bảng `document_sections` — BE, L
Phụ thuộc: E11-T1.
- .1 Bảng gồm `id`, `document_version_id`, `heading_path`, `level`, `order_no`, `char_start`, `char_end`, `content_hash`, `stable_key`.
- .2 Parser tạo section khi xử lý file. Section cũng sinh được cho tài liệu không có heading bằng cách chia theo đoạn.
- .3 `stable_key` được giữ qua các version nếu heading path không đổi, để so sánh giữa các version.
- .4 `knowledge_sources` trỏ tới `section_id` thay vì chỉ có offset.

AC: Hai version của cùng tài liệu map được section tương ứng. Có test với tài liệu tiếng Việt và tài liệu đổi thứ tự section.

### E11-T4. Tài liệu chuẩn hóa — AI + BA, L
Phụ thuộc: D2-2, E11-T3.
- .1 BA định nghĩa template Markdown cho từng loại trong `DOCUMENT-TAXONOMY.md`, gồm các mục bắt buộc và tùy chọn.
- .2 Pipeline sinh bản chuẩn hóa từ nội dung trích xuất. Phần map được vào template thì giữ nguyên văn. Phần không map được đưa vào mục "Chưa phân loại", không được viết lại.
- .3 Báo cáo mục bắt buộc còn thiếu thành cảnh báo "Not Specified".
- .4 Bản chuẩn hóa được lưu như một artifact của version, có trạng thái review.

AC: Mọi câu trong bản chuẩn hóa truy ngược được về offset trong bản trích xuất. Không có nội dung do AI tự thêm.

### E11-T5. Kiểm thử end-to-end luồng tài liệu — QA, M
Phụ thuộc: E11-T1 đến E11-T4.
- .1 Kịch bản đầy đủ: upload, xử lý, trích xuất unit, duyệt trên UI, promote, rồi upload version mới và supersede.
- .2 Chạy với project Offline only và project cho phép gửi ra ngoài, có mock provider.

AC: Kịch bản chạy tự động trong CI và không cần dữ liệu seed của DB dev.

### GATE 1: Điều kiện sang E12
- [ ] E11-T1 đến E11-T5 đạt AC.
- [ ] E13-T1 và E13-T2 đã có baseline cho trích xuất và section.

---

## E12. Knowledge Graph (P1)

Mục tiêu: mọi liên kết tri thức nằm trong một mô hình graph thống nhất. Cảnh báo ảnh hưởng tự chạy khi có thay đổi, chính xác tới từng section và lan nhiều bước.

### E12-T1. Viết `KNOWLEDGE-GRAPH-SPEC.md` — TL + BA, M
- .1 Định nghĩa loại node: Document, DocumentVersion, Section, KnowledgeUnit, Requirement, AcceptanceCriterion, BusinessRule, TestCase, Bug, Evidence và Entity. Entity gồm Actor, Term, Screen, API và DataObject.
- .2 Định nghĩa loại cạnh, mỗi loại có chiều, ý nghĩa và chiều lan ảnh hưởng:
  - `DERIVED_FROM`: unit lấy từ section.
  - `DEFINES` và `MENTIONS`: unit với entity.
  - `DEPENDS_ON` và `REFINES`: unit với unit.
  - `CONTRADICTS` và `SUPERSEDES`.
  - `PROMOTED_TO`: unit với requirement hoặc rule.
  - `VERIFIES`: test case với requirement.
  - `EVIDENCES`: evidence với đối tượng.
  - `REPORTED_ON`: bug với test case hoặc requirement.
- .3 Mỗi cạnh có nguồn gốc là `EXTRACTED`, `INFERRED` hoặc `MANUAL`, có `evidence_level` và `status`.
- .4 Quy tắc: loại cạnh nào được tạo tự động, loại nào bắt buộc duyệt, và loại nào được dùng khi lan ảnh hưởng.
- .5 Có ví dụ graph cho một tính năng mẫu như Login và OTP.

AC: BA và TL duyệt. Mỗi loại cạnh có ít nhất một ví dụ và quy tắc lan ảnh hưởng rõ ràng.

### E12-T2. Migration bảng graph — BE, M
Phụ thuộc: E12-T1.
- .1 Bảng `kg_entities` gồm `id`, `project_id`, `entity_type`, `canonical_name`, `aliases` (JSON), `status`, `evidence_level`, `created_from_unit_id`.
- .2 Bảng `kg_edges` gồm:
  - Hai đầu cạnh: `source_type`, `source_id`, `target_type`, `target_id`.
  - Thông tin cạnh: `project_id`, `edge_type`, `provenance`, `evidence_level`, `status`, `confidence`.
  - Nguồn: `knowledge_source_id`, `valid_from_version_id`, `valid_to_version_id`, `created_by`, `created_at`.
- .3 Index theo `(project_id, source_type, source_id)` và `(project_id, target_type, target_id)`. Ràng buộc unique chống trùng cạnh.
- .4 Cạnh của version cũ được đóng bằng cách đặt `valid_to_version_id`, không bị xóa.

AC: Insert trùng cạnh bị chặn. Xóa project xóa sạch graph của project đó. Retention được cập nhật theo.

### E12-T3. Backfill cạnh từ liên kết hiện có — BE, M
Phụ thuộc: E12-T2.
- .1 Chuyển các liên kết hiện có thành cạnh `EXTRACTED`, trạng thái Approved:
  - `requirement.sourceReferences`.
  - `testCase.requirementId`.
  - `evidence.links`.
  - Liên kết của bug.
  - `knowledge_sources`.
  - `conflicts`.
  - `document_relationships`.
- .2 Ghi cạnh song song khi các module cũ tạo hoặc sửa liên kết. Có thể dùng một service `GraphWriter` dùng chung.
- .3 Viết job đối soát, báo cáo chỗ lệch giữa liên kết cũ và cạnh graph.

AC: Job đối soát báo 0 chỗ lệch trên dữ liệu test. Trace matrix hiện tại vẫn hoạt động.

### E12-T4. Trích xuất và hợp nhất Entity — AI + BE, L
Phụ thuộc: E12-T2, E11-T3.
- .1 Viết skill mới `Entity Extraction` có versioning và JSON Schema giống các skill ở E4.
- .2 Hợp nhất entity theo Glossary, alias và cách chuẩn hóa tiếng Việt có dấu và không dấu. Tên khớp nhiều entity thì không tự gộp mà tạo yêu cầu duyệt kèm danh sách ứng viên.
- .3 Entity và cạnh `MENTIONS` mới tạo có trạng thái Draft.
- .4 Bước xác định entity ứng viên bằng rule chạy trước, LLM chỉ xử lý phần còn lại.

AC: Có test cho tên mơ hồ, alias và tiếng Việt. Không có entity nào tự động thành Approved.

### E12-T5. Trích xuất quan hệ giữa các unit — AI, L
Phụ thuộc: E12-T4.
- .1 Tìm cặp ứng viên một cách deterministic: hai unit dùng chung entity, cùng section, hoặc tham chiếu id của nhau.
- .2 LLM phân loại quan hệ của từng cặp thành `DEPENDS_ON`, `REFINES`, `CONTRADICTS` hoặc không có quan hệ. Mỗi kết quả phải kèm trích dẫn.
- .3 Mọi cạnh do bước này tạo đều là `INFERRED`, trạng thái Draft.
- .4 Thay logic phát hiện conflict bằng regex trong `semanticValidator.ts` bằng cạnh `CONTRADICTS` có duyệt. Logic cũ chỉ giữ làm tín hiệu phụ.

AC: Kết quả đo bằng E13-T3. Không có cạnh INFERRED nào được dùng cho cảnh báo chính thức khi chưa duyệt.

### E12-T6. Graph Query Service — BE, L
Phụ thuộc: E12-T2, D2-4.
- .1 `neighbors(node, edgeTypes, direction)`.
- .2 `path(a, b)` trả về đường đi kèm bằng chứng trên từng cạnh.
- .3 `impact(node)` dùng recursive CTE, có giới hạn độ sâu, lọc loại cạnh theo chiều lan ảnh hưởng, và chống vòng lặp. Mặc định chỉ dùng cạnh Approved. Tùy chọn bao gồm cả cạnh Draft với nhãn "chưa xác nhận".
- .4 `explain(node)` mô tả node lấy từ đâu, phụ thuộc vào gì và được kiểm chứng bởi gì.
- .5 Mọi truy vấn bắt buộc có `project_id` và kiểm tra quyền.

AC: Có test cho vòng lặp, giới hạn độ sâu và truy vấn khác project. Thời gian phản hồi được đo trên dữ liệu mẫu. Ngưỡng do TL chốt.

### E12-T7. Phát hiện thay đổi theo section — BE, M
Phụ thuộc: E11-T3.
- .1 So version mới với version cũ theo `stable_key` và `content_hash`. Kết quả gồm section thêm, xóa, sửa và di chuyển.
- .2 Từ section thay đổi, tìm các unit có cạnh `DERIVED_FROM` tới section đó.
- .3 Section chỉ di chuyển mà nội dung không đổi thì không sinh cảnh báo.

AC: Sửa một section chỉ đánh dấu các unit thuộc section đó, không đánh dấu cả tài liệu.

### E12-T8. Tự kích hoạt cảnh báo ảnh hưởng — BE, L
Phụ thuộc: E12-T6, E12-T7.
- .1 Các sự kiện kích hoạt:
  - Version mới được duyệt.
  - Requirement hoặc Business Rule bị sửa trực tiếp.
  - Unit bị supersede.
  - Thuật ngữ trong Glossary đổi.
  - Conflict được resolve.
- .2 Mỗi sự kiện tạo job tính ảnh hưởng qua job queue, không chạy trong request.
- .3 Thay `analyzeChangeImpact` trong `ai.service.ts` và cascade so khớp `title.includes(subject)` trong `knowledgeService.ts` bằng Graph Query Service.
- .4 Test case, bug và evidence bị ảnh hưởng chuyển sang trạng thái cần xem lại theo quy tắc trong spec, kèm đường đi giải thích lý do.

AC: Có test cho từng loại sự kiện. Kịch bản mẫu: đổi thời gian hết hạn OTP thì cảnh báo được rule khóa tài khoản phụ thuộc và test case của rule đó, qua ít nhất 2 bước.

### E12-T9. Impact Alert — BE, M
Phụ thuộc: E12-T8.
- .1 Bảng `impact_alerts` gồm sự kiện gốc, node bị ảnh hưởng, đường đi, mức độ, trạng thái (Open, Acknowledged, Resolved, Dismissed), người xử lý và lý do.
- .2 API danh sách, lọc, xác nhận và bỏ qua. Bỏ qua bắt buộc có lý do.
- .3 Chống trùng: cùng sự kiện và cùng node chỉ tạo một alert.

AC: Mọi thao tác trên alert có audit event.

### E12-T10. UI: Impact Panel và Graph Explorer — FE, L
Phụ thuộc: E12-T6, E12-T9, D2-6.
- .1 Thêm panel "Ảnh hưởng" trên màn Requirement, Business Rule và Document. Panel hiển thị cây ảnh hưởng theo từng bước.
- .2 Màn danh sách Impact Alert, có nút xem đường đi giải thích.
- .3 Explorer cho phép xem hàng xóm của một node, phân biệt rõ cạnh Approved và cạnh chưa xác nhận.
- .4 Toàn bộ chuỗi giao diện dùng i18n.

AC: Wireframe được BA và QA duyệt. Có test UI cho cây ảnh hưởng.

### E12-T11. UI duyệt Entity và cạnh INFERRED — FE, M
Phụ thuộc: E12-T4, E12-T5.
- .1 Hàng đợi duyệt entity, có thao tác gộp, tách và đổi tên.
- .2 Hàng đợi duyệt cạnh, hiển thị hai đầu cạnh và trích dẫn nguồn.
- .3 Server áp dụng cùng guardrail như Knowledge Unit: không bulk approve cạnh có evidence_level khác Explicit.

AC: Guardrail được kiểm tra ở server, có test.

### E12-T12. Graph Context Builder cho AI — AI + BE, M
Phụ thuộc: E12-T6.
- .1 Khi chạy skill như sinh test case hay semantic validation, lấy subgraph quanh đối tượng làm ngữ cảnh. Ngữ cảnh chỉ gồm node và cạnh Approved, kèm trích dẫn.
- .2 Giới hạn kích thước ngữ cảnh theo số token. Ưu tiên cạnh gần và có evidence_level Explicit.
- .3 Áp dụng policy dữ liệu của project trước khi gửi ngữ cảnh.

AC: Output của skill trích dẫn được node trong ngữ cảnh. Eval cho thấy chất lượng không giảm so với baseline.

### GATE 2: Điều kiện xem xét E14
- [ ] E12-T1 đến E12-T12 đạt AC.
- [ ] E13-T3 có kết quả đo cảnh báo ảnh hưởng, gồm cả cảnh báo bỏ sót và cảnh báo giả.
- [ ] E13-T4 có baseline truy xuất bằng FTS kết hợp graph.

---

## E13. Evaluation mở rộng (P0, chạy xuyên suốt)

### E13-T1. Sửa nền eval — QA + AI, M
- .1 Đóng phần còn thiếu của BUG-007:
  - Bỏ số liệu gán cứng.
  - Bỏ nhãn lộ trong tên file.
  - Thêm ca âm tính cho conflict.
  - Báo cáo không gán cứng kết quả đạt.
- .2 Báo cáo eval ghi vào thư mục không tracked.

AC: Cố ý làm giảm chất lượng một skill thì eval fail.

### E13-T2. Eval cho section và tài liệu chuẩn — QA + BA, M
Phụ thuộc: E11-T3, E11-T4.
- .1 Dataset gồm tài liệu có cấu trúc section đã biết, có cặp version với thay đổi đã biết.
- .2 Đo độ chính xác khi map section và khi phát hiện thay đổi. Đo tỷ lệ câu trong bản chuẩn hóa không truy ngược được về nguồn, mục tiêu là 0.

### E13-T3. Eval cho graph và cảnh báo ảnh hưởng — QA + BA, L
Phụ thuộc: E12-T1.
- .1 BA dựng graph đúng cho ít nhất một tính năng mẫu, gồm entity, cạnh và tập node bị ảnh hưởng khi thay đổi từng rule.
- .2 Các chỉ số:
  - Precision và recall của entity.
  - Precision và recall của quan hệ giữa unit.
  - Precision và recall của tập ảnh hưởng.
  - Số cảnh báo giả trên mỗi thay đổi.
- .3 Dataset có tài liệu tiếng Việt và tài liệu song ngữ.

### E13-T4. Baseline truy xuất — AI + QA, M
Phụ thuộc: E12-T6.
- .1 Tạo bộ câu hỏi kèm tập unit đúng. Có câu dùng đúng từ trong tài liệu, và có câu diễn đạt khác chữ hoặc đồng nghĩa.
- .2 Đo recall@k và MRR cho FTS và cho FTS kết hợp graph. Tách riêng kết quả nhóm câu diễn đạt khác chữ.
- .3 Báo cáo là căn cứ cho quyết định D2-5.

---

## E14. Vector Search (P2, có điều kiện)

**Chỉ bắt đầu khi:** Gate 2 đạt, và kết quả E13-T4 cho nhóm câu diễn đạt khác chữ thấp hơn ngưỡng D2-5. Nếu không đạt điều kiện, epic này đóng lại với ghi chú lý do.

### E14-T1. Chọn model embedding — AI + TL, M
- .1 So sánh các model chạy local có hỗ trợ tiếng Việt về chất lượng trên E13-T4, tốc độ, bộ nhớ và giấy phép.
- .2 Project Offline only bắt buộc dùng model local. Model bên ngoài chỉ được dùng theo policy của project, và lời gọi phải qua cùng điểm kiểm soát với LLM.
- .3 Viết ADR ghi lại lựa chọn.

AC: ADR được TL duyệt. Cập nhật `AI-DATA-POLICY.md` cho embedding.

### E14-T2. Spike sqlite-vec — BE, M
- .1 Kiểm tra extension chạy được với better-sqlite3 trên các môi trường mục tiêu.
- .2 Đo tốc độ index và tốc độ truy vấn trên dữ liệu mẫu.

AC: Có báo cáo spike. Nếu không đạt thì đề xuất phương án thay thế.

### E14-T3. Pipeline index — BE + AI, L
Phụ thuộc: E14-T1, E14-T2.
- .1 Đơn vị index là section và Knowledge Unit. Chỉ index dữ liệu Approved.
- .2 Index lại khi supersede, xóa khi reject hoặc khi xóa project.
- .3 Lưu `model_id` và phiên bản embedding. Đổi model thì index lại toàn bộ.

AC: Không có vector nào của dữ liệu chưa duyệt hoặc của project khác lọt vào kết quả, có test chứng minh.

### E14-T4. Hybrid retrieval — AI, M
Phụ thuộc: E14-T3.
- .1 Kết hợp FTS, vector và bộ lọc graph theo project, trạng thái và loại node.
- .2 Áp dụng cho các bài toán: tìm ứng viên conflict ở E12-T5, chống trùng tài liệu, và Graph Context Builder.

AC: Kết quả E13-T4 tốt hơn baseline. Nếu không tốt hơn thì không bật tính năng.

---

## E15. Spike Graphify cho liên kết code (P2, tùy chọn)

Mục tiêu: đánh giá khả năng nối Requirement và API với module mã nguồn, để cảnh báo ảnh hưởng tới cả code.

### E15-T1. Chạy thử có kiểm soát — TL, M
- .1 Chạy trên repo không nhạy cảm, ở chế độ chỉ phân tích code để không có nội dung nào gửi ra ngoài.
- .2 Tắt query log local, và review cơ chế hook trước khi cài lên máy dùng chung.
- .3 Đo độ chính xác của graph code trên một repo đã biết cấu trúc.

AC: Có báo cáo spike, nêu rõ rủi ro, giấy phép, và kết luận có dùng hay không.

### E15-T2. Importer graph.json — BE, M
Phụ thuộc: E15-T1 kết luận là dùng.
- .1 Nhập node code và cạnh vào `kg_entities` và `kg_edges` với nguồn gốc INFERRED, trạng thái Draft.
- .2 Liên kết API trong tài liệu với API trong code qua bước duyệt ở E12-T11.

AC: Không có cạnh từ Graphify nào được dùng cho cảnh báo chính thức khi chưa duyệt.

---

## Rủi ro chính

| Rủi ro | Giảm thiểu |
|---|---|
| Graph xây trên dữ liệu sai do bug chưa sửa | Gate 0 bắt buộc, có review lại |
| Quá nhiều cạnh INFERRED làm nghẽn hàng đợi duyệt | Tìm cặp ứng viên deterministic trước. Duyệt theo mức ưu tiên. Đo khối lượng duyệt trong E13-T3 |
| Cảnh báo giả nhiều khiến người dùng bỏ qua | Cảnh báo theo section. Mặc định chỉ dùng cạnh Approved. Theo dõi tỷ lệ alert bị bỏ qua |
| Recursive CTE chậm khi graph lớn | Giới hạn độ sâu, index hai chiều, đo trong E12-T6 |
| Hai nguồn liên kết cũ và graph lệch nhau | Dùng GraphWriter chung và job đối soát ở E12-T3 |
| Embedding làm lộ dữ liệu project Offline | Bắt buộc model local, policy kiểm soát chung, có test ở E14-T3 |
| Làm vector khi chưa cần | E14 có cổng điều kiện dựa trên số đo từ E13-T4 |
