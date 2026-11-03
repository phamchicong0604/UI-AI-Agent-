# Project Knowledge Specification & Atomic Knowledge Units (AKU)

Tài liệu này đặc tả cấu trúc dữ liệu, mô hình cơ sở dữ liệu và tiêu chuẩn kỹ thuật cho lớp tri thức nguyên tử (**Atomic Knowledge Units**) và quan hệ nguồn gốc (**Knowledge Sources**) trong nền tảng QA.

---

## 1. Cấu trúc Đơn vị Tri thức Nguyên tử (Atomic Knowledge Unit Schema)

Một Đơn vị Tri thức Nguyên tử (AKU) là mệnh đề logic nhỏ nhất không thể phân tách thêm mà vẫn giữ nguyên ý nghĩa nghiệp vụ hoàn chỉnh.

### Cấu trúc trường dữ liệu (`knowledge_units`):
```json
{
  "id": "KU-REQ-20261103-001",
  "project_id": "PRJ-01",
  "unit_type": "Requirement",
  "content": "Hệ thống phải tự động đăng xuất người dùng sau 15 phút không hoạt động.",
  "subject": "Phiên làm việc người dùng",
  "action": "tự động đăng xuất",
  "condition": "khi thời gian không thao tác đạt 15 phút",
  "evidence_level": "Explicit",
  "status": "Approved",
  "created_at": "2026-11-03 10:00:00",
  "updated_at": "2026-11-03 10:00:00"
}
```

### Cấu trúc Neo Nguồn gốc (`knowledge_sources`):
```json
{
  "id": "SRC-20261103-001",
  "unit_id": "KU-REQ-20261103-001",
  "document_version_id": "DOC-01-v1.0",
  "heading_path": ["2. Phi chức năng", "2.1 Bảo mật"],
  "char_offset_start": 1250,
  "char_offset_end": 1340,
  "page_number": 3,
  "exact_quote": "Hệ thống phải tự động đăng xuất người dùng sau 15 phút không hoạt động.",
  "created_at": "2026-11-03 10:00:00"
}
```

---

## 2. Quy tắc Thăng hạng sang Requirement & BusinessRule (Promote Rule - E6-T3)

Khi một `knowledge_units` được Reviewer hoặc quy tắc hệ thống phê duyệt (`status = 'Approved'`):

1. **Với `unit_type === 'Requirement'`**:
   - Nếu Requirement chưa tồn tại: Tạo mới bản ghi trong bảng `requirements` với `status: 'Approved'`.
   - Nếu Requirement đã tồn tại: Cập nhật mô tả và đồng bộ tiêu chuẩn chấp thuận.
   - Trường `sourceReferences` được ghi đè/bổ sung chính xác:
     ```json
     {
       "documentId": "DOC-01",
       "documentTitle": "Đặc tả yêu cầu phần mềm",
       "version": "v1.0",
       "section": "2.1 Bảo mật (Offset: 1250-1340)"
     }
     ```

2. **Với `unit_type === 'BusinessRule'`**:
   - Đưa vào danh sách `businessRules[]` của Requirement tương ứng hoặc gắn vào Global Catalog của dự án.

3. **Tính toàn vẹn (Integrity Guarantee)**:
   - Một rule chỉ có **duy nhất một bản ghi sự thật (Single Source of Truth)**.
   - Ma trận truy vết Traceability Matrix thể hiện từ Test Case -> Requirement -> Knowledge Unit -> Vị trí chính xác trong File tài liệu gốc.
