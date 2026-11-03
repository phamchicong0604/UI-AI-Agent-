# AI Skill Contracts & JSON Schemas

Tài liệu này định nghĩa chi tiết hợp đồng giao tiếp (Contracts), JSON Schema đầu vào/đầu ra, cấu trúc trích dẫn bằng chứng (`evidence_level`, `source_anchor`) và quy tắc xác thực cho 6 Kỹ năng AI cốt lõi trong hệ thống xử lý tài liệu tự động.

---

## 1. Hệ thống 6 Cấp độ Bằng chứng (Evidence Levels)

Mọi tri thức, yêu cầu (Requirement) và quy tắc nghiệp vụ (Business Rule) do AI trích xuất bắt buộc phải gắn một trong 6 mức độ bằng chứng sau:

| Mức độ | Định nghĩa | Mức độ rủi ro | Quy tắc phê duyệt |
|---|---|---|---|
| `Explicit` | Trực tiếp được nêu rõ trong văn bản tài liệu, có câu từ trích dẫn nguyên văn chính xác. | Thấp nhất | Có thể được xem xét Tự động duyệt (Auto-Approve) nếu đạt độ tin cậy $\ge 0.90$. |
| `Inferred` | Được suy luận hợp lý từ ngữ cảnh kỹ thuật, kiến trúc hệ thống hoặc tiêu chuẩn ngành. | Trung bình | **Bắt buộc** Reviewer duyệt thủ công (`REVIEW_REQUIRED`). Cấm Auto-Approve. |
| `Assumed` | Giả định ngầm định theo thông lệ chung khi tài liệu không đề cập tường minh. | Cao | **Bắt buộc** Reviewer duyệt hoặc chuyển sang `FEEDBACK_REQUIRED` để tác giả xác nhận. |
| `Not Specified` | Tài liệu có nhắc đến nghiệp vụ nhưng bỏ ngỏ quy cách chi tiết (ví dụ: "chờ cập nhật sau"). | Cảnh báo | Gắn nhãn làm rõ, ngăn tạo Test Case khẳng định. |
| `Conflict` | Mâu thuẫn trực tiếp với điều khoản khác trong cùng tài liệu hoặc tri thức đã duyệt của dự án. | Nghiêm trọng | **Chặn hoàn toàn** trạng thái `ORGANIZED` cho tới khi có quyết định hòa giải xung đột. |
| `Unknown` | Không đủ cơ sở dữ liệu để xác định nguồn gốc hoặc tính đúng đắn. | Rất cao | Yêu cầu kiểm tra lại đầu vào hoặc chuyển sang trạng thái loại bỏ. |

> [!IMPORTANT]
> **Quy tắc bất biến BR-AI-01**: Bất kỳ đề xuất nào có `evidence_level` khác `Explicit` (kể cả `Inferred` hay `Assumed`) đều **tuyệt đối không được gán trạng thái Approved tự động**.

---

## 2. Cấu trúc Neo Nguồn gốc (Source Anchor)

Mọi đơn vị trích xuất bắt buộc phải sở hữu đối tượng `source_anchor` để phục vụ khả năng truy vết (Traceability) đến từng ký tự trong file gốc:

```json
{
  "document_version_id": "DOC-01-v1.0",
  "heading_path": ["2. Yêu cầu Phi chức năng", "2.1 Bảo mật & Xác thực"],
  "char_offset_start": 1420,
  "char_offset_end": 1680,
  "page_number": 3,
  "exact_quote": "Hệ thống phải tự động đăng xuất phiên làm việc của người dùng sau 15 phút không có thao tác."
}
```

---

## 3. Danh mục 6 AI Skill Contracts

```
[File Intake] -> [Understanding] -> [Extraction] -> [Classification] -> [Semantic Validation] -> [Organization]
```

### 3.1. Skill 1: Intake (`SKILL-INTAKE`)
- **Mục đích**: Nhận văn bản thô, chuẩn hóa định dạng, bao bọc nội dung trong các delimiter chống prompt injection (E5-T3), lọc mã độc/chỉ thị giả lập.
- **Input Schema**:
```json
{
  "type": "object",
  "required": ["filename", "raw_content", "mime_type"],
  "properties": {
    "filename": { "type": "string" },
    "raw_content": { "type": "string" },
    "mime_type": { "type": "string" }
  }
}
```
- **Output Schema**:
```json
{
  "type": "object",
  "required": ["normalized_text", "total_characters", "detected_language", "security_flags"],
  "properties": {
    "normalized_text": { "type": "string" },
    "total_characters": { "type": "integer" },
    "detected_language": { "type": "string", "enum": ["vi", "en", "mixed"] },
    "security_flags": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

---

### 3.2. Skill 2: Understanding (`SKILL-UNDERSTANDING`)
- **Mục đích**: Tóm tắt mục đích cốt lõi của tài liệu, phân tích nhóm độc giả đích, phạm vi hệ thống và cấu trúc logic.
- **Input Schema**:
```json
{
  "type": "object",
  "required": ["document_version_id", "normalized_text"],
  "properties": {
    "document_version_id": { "type": "string" },
    "normalized_text": { "type": "string" }
  }
}
```
- **Output Schema**:
```json
{
  "type": "object",
  "required": ["document_intent", "executive_summary", "target_audience", "key_domains"],
  "properties": {
    "document_intent": { "type": "string" },
    "executive_summary": { "type": "string" },
    "target_audience": {
      "type": "array",
      "items": { "type": "string" }
    },
    "key_domains": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

---

### 3.3. Skill 3: Extraction (`SKILL-EXTRACTION`)
- **Mục đích**: Bóc tách các đơn vị tri thức nguyên tử (Atomic Knowledge Units): Yêu cầu chức năng, Yêu cầu phi chức năng, Quy tắc nghiệp vụ, Ràng buộc kỹ thuật.
- **Input Schema**:
```json
{
  "type": "object",
  "required": ["document_version_id", "normalized_text"],
  "properties": {
    "document_version_id": { "type": "string" },
    "normalized_text": { "type": "string" }
  }
}
```
- **Output Schema**:
```json
{
  "type": "object",
  "required": ["extracted_units"],
  "properties": {
    "extracted_units": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["unit_type", "subject", "action", "evidence_level", "source_anchor"],
        "properties": {
          "unit_type": { "type": "string", "enum": ["Requirement", "BusinessRule", "Constraint", "Definition"] },
          "subject": { "type": "string" },
          "action": { "type": "string" },
          "condition": { "type": "string" },
          "evidence_level": { "type": "string", "enum": ["Explicit", "Inferred", "Assumed", "Not Specified", "Conflict", "Unknown"] },
          "source_anchor": {
            "type": "object",
            "required": ["document_version_id", "heading_path", "char_offset_start", "char_offset_end", "exact_quote"],
            "properties": {
              "document_version_id": { "type": "string" },
              "heading_path": { "type": "array", "items": { "type": "string" } },
              "char_offset_start": { "type": "integer" },
              "char_offset_end": { "type": "integer" },
              "page_number": { "type": "integer" },
              "exact_quote": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

---

### 3.4. Skill 4: Classification (`SKILL-CLASSIFICATION`)
- **Mục đích**: Phân loại tài liệu vào đúng 1 trong 8 thư mục chuẩn của dự án dựa trên cấu trúc taxonomy và từ khóa nhận diện.
- **Input Schema**:
```json
{
  "type": "object",
  "required": ["document_version_id", "filename", "executive_summary"],
  "properties": {
    "document_version_id": { "type": "string" },
    "filename": { "type": "string" },
    "executive_summary": { "type": "string" }
  }
}
```
- **Output Schema**:
```json
{
  "type": "object",
  "required": ["recommended_category", "confidence_score", "reasoning"],
  "properties": {
    "recommended_category": {
      "type": "string",
      "enum": [
        "01_Project_Overview",
        "02_Business_Requirements",
        "03_System_Requirements",
        "04_UI_UX",
        "05_Technical_Documents",
        "06_QA",
        "07_EVD_Evidence",
        "08_Change_History"
      ]
    },
    "confidence_score": { "type": "number", "minimum": 0.0, "maximum": 1.0 },
    "reasoning": { "type": "string" }
  }
}
```

---

### 3.5. Skill 5: Semantic Validation (`SKILL-VALIDATION`)
- **Mục đích**: Đối soát danh sách tri thức vừa trích xuất với tri thức hiện có của dự án để phát hiện mâu thuẫn, tính điểm nhất quán (Consistency Score).
- **Input Schema**:
```json
{
  "type": "object",
  "required": ["project_id", "new_units", "existing_approved_units"],
  "properties": {
    "project_id": { "type": "string" },
    "new_units": { "type": "array", "items": { "type": "object" } },
    "existing_approved_units": { "type": "array", "items": { "type": "object" } }
  }
}
```
- **Output Schema**:
```json
{
  "type": "object",
  "required": ["consistency_score", "conflicts", "validation_status"],
  "properties": {
    "consistency_score": { "type": "number", "minimum": 0.0, "maximum": 1.0 },
    "conflicts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["conflict_type", "severity", "new_unit_quote", "existing_unit_quote", "description"],
        "properties": {
          "conflict_type": { "type": "string", "enum": ["Contradiction", "Ambiguity", "Redundancy"] },
          "severity": { "type": "string", "enum": ["Critical", "Major", "Minor"] },
          "new_unit_quote": { "type": "string" },
          "existing_unit_quote": { "type": "string" },
          "description": { "type": "string" }
        }
      }
    },
    "validation_status": { "type": "string", "enum": ["PASSED", "WARNING", "BLOCKED"] }
  }
}
```

---

### 3.6. Skill 6: Organization (`SKILL-ORGANIZATION`)
- **Mục đích**: Tổng hợp quan hệ giữa các yêu cầu và trường hợp kiểm thử, thiết lập ma trận truy vết (Traceability Links).
- **Input Schema**:
```json
{
  "type": "object",
  "required": ["document_id", "approved_units"],
  "properties": {
    "document_id": { "type": "string" },
    "approved_units": { "type": "array", "items": { "type": "object" } }
  }
}
```
- **Output Schema**:
```json
{
  "type": "object",
  "required": ["traceability_matrix", "suggested_test_cases"],
  "properties": {
    "traceability_matrix": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["unit_id", "target_requirement_id", "coverage_type"],
        "properties": {
          "unit_id": { "type": "string" },
          "target_requirement_id": { "type": "string" },
          "coverage_type": { "type": "string", "enum": ["Full", "Partial", "Uncovered"] }
        }
      }
    },
    "suggested_test_cases": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["title", "preconditions", "steps", "expected_result", "linked_unit_id"],
        "properties": {
          "title": { "type": "string" },
          "preconditions": { "type": "string" },
          "steps": { "type": "array", "items": { "type": "string" } },
          "expected_result": { "type": "string" },
          "linked_unit_id": { "type": "string" }
        }
      }
    }
  }
}
```
