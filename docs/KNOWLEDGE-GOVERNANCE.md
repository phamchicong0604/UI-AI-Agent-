# Knowledge Governance & Lifecycle Specification

Tài liệu này quy định kiến trúc quản trị tri thức dự án (**Project Knowledge Governance**), vòng đời của các đơn vị tri thức nguyên tử (**Atomic Knowledge Units - AKU**), sự phân tách giữa trạng thái phê duyệt và mức độ bằng chứng, thứ tự ưu tiên nguồn tri thức và quy trình hòa giải xung đột.

---

## 1. Phân định Review Status và Evidence Level

Hệ thống phân tách rạch ròi 2 thuộc tính độc lập cho mỗi đơn vị tri thức:

```
+------------------------------------+------------------------------------+
| Review Status (Quyền quyết định)   | Evidence Level (Bằng chứng ngữ văn)|
|                                    |                                    |
| - Draft                            | - Explicit                         |
| - In Review                        | - Inferred                         |
| - Approved                         | - Assumed                          |
| - Rejected                         | - Not Specified                    |
| - Superseded                       | - Conflict                         |
| - Deprecated                       | - Unknown                          |
+------------------------------------+------------------------------------+
```

1. **`review_status` (Trạng thái kiểm duyệt do con người/hệ thống quản trị)**:
   - `Draft`: Mới bóc tách từ tài liệu, chưa gửi duyệt.
   - `In Review`: Đang chờ Reviewer/BA/PO kiểm tra và xác nhận.
   - `Approved`: Đã được phê duyệt chính thức, trở thành "Single Source of Truth" để sinh Requirement và Test Case.
   - `Rejected`: Bị từ chối do thông tin sai, lỗi thời hoặc không phù hợp định hướng dự án.
   - `Superseded`: Bị thay thế bởi phiên bản tài liệu mới hơn đã được duyệt.
   - `Deprecated`: Quy tắc nghiệp vụ hết hạn hiệu lực do hệ thống ngừng cung cấp tính năng.

2. **`evidence_level` (Mức độ tin cậy của câu từ trong tài liệu gốc)**:
   - Không bị ghi đè khi thay đổi `review_status`. Đây là đặc tính kỹ thuật phản ánh khách quan mức độ rõ ràng của nguồn văn bản gốc.

---

## 2. Thứ tự Ưu tiên Nguồn (Source Precedence Hierarchy)

Khi phát sinh hai quy tắc trái ngược nhau, hệ thống tự động xác định thứ tự ưu tiên giải quyết:

```
[1. Hợp đồng / Đặc tả đã ký duyệt (Signed Specifications)]
                           v
[2. Phiên bản tài liệu mới hơn (v2.0 > v1.0)]
                           v
[3. Quy tắc đặc thù (Specific Rule > General Rule)]
                           v
[4. Mức độ bằng chứng (Explicit > Inferred > Assumed)]
```

| Mức ưu tiên | Loại nguồn | Nguyên tắc |
|---|---|---|
| **Ưu tiên 1 (Cao nhất)** | Signed Specifications / Legal Compliance | Quy chuẩn bảo mật, pháp lý hoặc BRD đã có chữ ký phê duyệt của PM/Khách hàng luôn đè bẹp các tài liệu thảo luận nội bộ. |
| **Ưu tiên 2** | Version Timestamp Recency | Phiên bản sau đè phiên bản trước. Tài liệu phát hành tháng 11/2026 tự động thay thế (`Supersede`) tài liệu tháng 08/2026. |
| **Ưu tiên 3** | Specificity (Độ chi tiết chuyên biệt) | Quy định tại module thanh toán cụ thể ghi đè quy định chung toàn hệ thống. |
| **Ưu tiên 4** | Evidence Purity | Đoạn văn `Explicit` luôn có trọng số cao hơn nhận định `Inferred` hoặc `Assumed`. |

---

## 3. Quy trình Xử lý Xung đột Tri thức (Conflict Resolution)

```
[Phát hiện xung đột A & B] -> [Ghi nhận vào bảng conflicts] -> [Đánh giá mức độ Severity]
                                                                        |
     +------------------------------------------------------------------+
     |
     +--> Critical : Chặn hoàn toàn trạng thái ORGANIZED, phát alert tới PM/BA
     +--> Major    : Cảnh báo In Review, yêu cầu Reviewer chọn phương án hòa giải
     +--> Minor    : Tự động đề xuất giữ bản ghi mới nhất, ghi log giải thích
```

### 3.1. Các phương án hòa giải (Resolution Actions)
1. `KEEP_NEW_SUPERSEDE_OLD`: Chấp thuận đơn vị tri thức mới, chuyển đơn vị tri thức cũ sang trạng thái `Superseded`.
2. `REJECT_NEW_PRESERVE_OLD`: Từ chối đơn vị tri thức mới, bảo lưu đơn vị tri thức cũ làm chuẩn.
3. `MERGE_SPECIFICATION`: Gộp cả hai đơn vị thành một quy tắc mới với điều kiện ngoại lệ được chỉ định rõ ràng.

---

## 4. Tác động Lan truyền (Change Impact & Test Case Linkage)

Khi một đơn vị tri thức chuyển sang trạng thái `Superseded` hoặc bị chỉnh sửa nội dung:
1. Xác định toàn bộ `RequirementItem` liên kết với đơn vị này thông qua `sourceReferences`.
2. Kích hoạt động cơ Change Impact:
   - Mọi `TestCaseItem` đang ở trạng thái `Approved` được liên kết với Requirement bị ảnh hưởng sẽ **tự động chuyển về trạng thái `In Review`**.
   - Cảnh báo được gắn lên ma trận truy vết: *"Test Case cần được thẩm định lại do tri thức nguồn đã thay đổi"*.
