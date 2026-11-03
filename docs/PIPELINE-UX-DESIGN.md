# Pipeline UX & Human Review Design Specification (Epic E8-T1)

Tài liệu này định nghĩa kiến trúc trải nghiệm người dùng (UX), cấu trúc màn hình (Wireframe) và tiêu chí chấp nhận (AC) cho hệ thống duyệt tài liệu và tri thức (**Human Review UI**).

---

## 1. Tổng quan Kiến trúc Giao diện Review

```
+----------------------------------------------------------------------------------------------------+
| Top Navigation: [Documents / AI Pipeline Review Queue]           Filter: [Project ▼] [Risk: High ▼] |
+----------------------------------------------------------------------------------------------------+
|  REVIEW QUEUE (Sắp xếp theo Risk Score giảm dần)                                                  |
|  +-----------------------------------------------------------------------------------------------+ |
|  | [DOC-102] BRD_Payment_Gateway_v2.md | Risk: 85 (HIGH) | Stage: REVIEW_REQUIRED | [Review Now]  | |
|  | ⚠️ 1 Critical Conflict | 1 Ambiguity | 6 Units Extracted (4 Explicit, 2 Inferred)              | |
|  +-----------------------------------------------------------------------------------------------+ |
|  | [DOC-099] Architecture_Design.md   | Risk: 30 (MED)  | Stage: REVIEW_REQUIRED | [Review Now]  | |
|  +-----------------------------------------------------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Chi tiết Màn hình Split-Screen Duyệt Tri thức (Knowledge Review Screen)

```
+----------------------------------------------------------------------------------------------------+
| Header: BRD_Payment_Gateway_v2.md (v1.0) | Risk Score: 85/100 | Status: REVIEW_REQUIRED            |
| Actions: [Approve Explicit Only] [Resolve Conflicts (1)] [Approve All Document] [Reject Document]  |
+----------------------------------------------------------------------------------------------------+
| LEFT PANE: Tài liệu Gốc (Original Source)       | RIGHT PANE: Atomic Knowledge Units Extracted     |
| (Kèm highlight ký tự theo offset & heading)     |                                                  |
|-------------------------------------------------|--------------------------------------------------|
| # 2. Quy định thanh toán nội địa                | [Unit #1] BusinessRule | Badge: [Explicit]       |
|                                                 | Subject: Timeout phiên thanh toán                |
| Khách hàng thực hiện quét mã QR.                | Action: Thiết lập thời gian chờ                  |
| >>> Thời gian timeout phiên thanh toán là 15m.<<<| Exact Quote: "Thời gian timeout phiên là 15m."    |
| (Highlight vàng khi click vào Unit #1 bên phải)  | [✓ Approve] [✗ Reject] [✎ Request Change]        |
|                                                 |--------------------------------------------------|
|                                                 | [Unit #2] Requirement | Badge: [Inferred] ⚠️     |
|                                                 | Subject: Tự động hoàn tiền khi lỗi               |
|                                                 | (Bulk approve disabled for Inferred)             |
|                                                 | [✓ Approve (Manual Only)] [✗ Reject]             |
|                                                 |--------------------------------------------------|
|                                                 | [CONFLICT BANNER] ⚠️ Critical Conflict Detected!   |
|                                                 | Unit #1 mâu thuẫn với Approved Doc "Core_Policy" |
|                                                 | Giá trị: 15m (mới) vs 30m (đã duyệt)             |
|                                                 | [Open Conflict Resolver Modal]                   |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. Màn hình Xử lý Xung đột Tri thức (Conflict Resolution Modal - E8-T4)

```
+----------------------------------------------------------------------------------------------------+
| ⚠️ XỬ LÝ XUNG ĐỘT TRI THỨC (Knowledge Conflict Resolution)                                        |
+----------------------------------------------------------------------------------------------------+
| Mâu thuẫn thuộc tính: "Timeout phiên thanh toán"                                                  |
| Mức độ nghiêm trọng: CRITICAL                                                                      |
|                                                                                                    |
| +-------------------------------------------+   +------------------------------------------------+ |
| | BẢN GHI ĐÃ PHÊ DUYỆT TRƯỚC ĐÂY            |   | ĐỀ XUẤT TÀI LIỆU MỚI (CANDIDATE)               | |
| | Nguồn: Core_Policy_v1.0.docx              |   | Nguồn: BRD_Payment_Gateway_v2.md               | |
| | Trích dẫn: "Thời gian timeout phiên là 30m"|   | Trích dẫn: "Thời gian timeout phiên là 15m"    | |
| +-------------------------------------------+   +------------------------------------------------+ |
|                                                                                                    |
| Chọn phương án phân giải:                                                                         |
|  ( ) 1. KEEP_NEW_SUPERSEDE_OLD: Phê duyệt giá trị mới (15m), chuyển giá trị cũ thành Superseded    |
|         -> Tự động đưa các Test Case liên quan về trạng thái "In Review".                          |
|  ( ) 2. REJECT_NEW_PRESERVE_OLD: Giữ nguyên bản ghi cũ (30m), từ chối đề xuất mới.                |
|  ( ) 3. MERGE_SPECIFICATION: Hợp nhất (ví dụ: áp dụng 15m cho QR, 30m cho thẻ quốc tế).           |
|                                                                                                    |
| [Xác nhận Phân giải]                                                                [Hủy bỏ]      |
+----------------------------------------------------------------------------------------------------+
```

---

## 4. Tiêu chí Chấp nhận (Acceptance Criteria)

1. **AC-E8-1 (Queue Ordering)**: Hàng đợi Review Queue luôn hiển thị các tài liệu cần duyệt sắp xếp theo `riskScore` từ cao xuống thấp.
2. **AC-E8-2 (Source Offset Highlighting)**: Khi click vào bất kỳ Knowledge Unit nào bên cột phải, màn hình bên trái tự động cuộn đến và bôi sáng chính xác đoạn văn bản gốc tương ứng theo `char_offset_start` và `char_offset_end`.
3. **AC-E8-3 (Bulk Approval Guardrail - BR-AI-01)**: Nút "Approve Hàng loạt" chỉ được phép áp dụng cho các unit có `evidence_level = 'Explicit'`. Các unit `Inferred`, `Assumed`, `Not Specified`, `Unknown` bắt buộc phải duyệt thủ công từng mục với cảnh báo rõ ràng.
4. **AC-E8-4 (Mandatory Reject Reason)**: Khi nhấn Reject một unit hoặc document, form bắt buộc người dùng nhập lý do từ chối (min 5 ký tự) để phục vụ Audit Trail.
5. **AC-E8-5 (Conflict Gatekeeper)**: Tài liệu có Critical Conflict chưa được phân giải sẽ bị khóa nút "Approve All" cho tới khi người dùng hoàn thành Conflict Resolution.
