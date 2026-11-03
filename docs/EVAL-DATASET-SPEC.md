# Evaluation Dataset Specification (Epic E9-T1)

Tài liệu này định nghĩa cấu trúc dữ liệu kiểm chuẩn (**Evaluation Dataset Specification**), danh mục 8 bộ kiểm thử tiêu chuẩn từ `DOC-EVAL-01` đến `DOC-EVAL-08`, và phương pháp đo lường các chỉ số định lượng (Metrics) cho AI Document Pipeline.

---

## 1. Định dạng Tiêu chuẩn cho Dataset (Evaluation Schema)

Mỗi trường hợp kiểm thử (Evaluation Case) được cấu trúc theo định dạng JSON chuẩn hóa:

```typescript
export interface EvalTestCase {
  id: string; // e.g., "DOC-EVAL-01"
  title: string;
  language: 'vi' | 'en' | 'bilingual';
  filePath: string;
  headings: string[];
  content: string;
  groundTruth: {
    primaryCategory: string;
    secondaryCategories?: string[];
    extractedUnits: Array<{
      subject: string;
      action: string;
      condition?: string;
      evidenceLevel: 'Explicit' | 'Inferred' | 'Assumed';
      exactQuote: string;
    }>;
    expectedConflicts?: Array<{
      conflictType: 'Contradiction' | 'Ambiguity' | 'Redundancy';
      severity: 'Critical' | 'Major' | 'Minor';
      conflictingWithSubject: string;
    }>;
  };
}
```

> [!IMPORTANT]
> **Quy định bảo mật dữ liệu mẫu**: Toàn bộ dữ liệu trong bộ kiểm chuẩn là dữ liệu giả định tổng hợp (Synthetic Data), không chứa bất kỳ thông tin nhận dạng cá nhân (PII) hoặc dữ liệu khách hàng thật nào.

---

## 2. Danh mục 8 Test Cases Tiêu chuẩn (DOC-EVAL-01 đến DOC-EVAL-08)

### DOC-EVAL-01: Yêu cầu Nghiệp vụ Cổng Thanh toán (Tiếng Việt)
- **Danh mục kỳ vọng**: `02_Business_Requirements`
- **Mục tiêu**: Đánh giá khả năng trích xuất quy tắc nghiệp vụ số liệu (hạn mức giao dịch, timeout thanh toán QR).
- **Ground Truth Units**:
  1. Hạn mức giao dịch QR: Tối đa 50,000,000 VND / giao dịch (Explicit).
  2. Thời gian chờ thanh toán: Timeout phiên là 15 phút (Explicit).
  3. Hoàn tiền tự động: Giao dịch lỗi được hoàn trong 24 giờ (Inferred).

### DOC-EVAL-02: Software Requirements Specification (English)
- **Danh mục kỳ vọng**: `03_System_Requirements`
- **Mục tiêu**: Đánh giá khả năng nhận diện yêu cầu phi chức năng (NFR), độ trễ API và khả năng chịu tải.
- **Ground Truth Units**:
  1. Peak Concurrency: System shall support 10,000 CCU with CPU utilization under 70% (Explicit).
  2. API Response Latency: P99 latency shall be under 200ms for read endpoints (Explicit).
  3. Failover RTO: Recovery Time Objective shall be less than 60 seconds (Explicit).

### DOC-EVAL-03: UI/UX Guidelines & Component Specs (Bilingual)
- **Danh mục kỳ vọng**: `04_UI_UX`
- **Mục tiêu**: Đánh giá tài liệu song ngữ Anh-Việt về thiết kế Figma, style tokens, và tính tương thích di động.
- **Ground Truth Units**:
  1. Color Palette: Primary brand color là `#4F46E5` (Indigo-600) (Explicit).
  2. Touch Target Size: Nút bấm trên thiết bị di động tối thiểu 44x44px (Explicit).
  3. Dark Mode Contrast: Tỷ lệ tương phản văn bản đạt chuẩn WCAG AA 4.5:1 (Explicit).

### DOC-EVAL-04: Technical Architecture & SQLite Data Model (Bilingual)
- **Danh mục kỳ vọng**: `05_Technical_Documents`
- **Mục tiêu**: Đánh giá trích xuất sơ đồ bảng cơ sở dữ liệu, khóa ngoại và cơ chế SQLite WAL.
- **Ground Truth Units**:
  1. Storage Engine: SQLite cơ sở dữ liệu hoạt động ở chế độ Write-Ahead Logging (WAL) (Explicit).
  2. Document Hash: File tải lên bắt buộc băm SHA-256 bảo đảm tính toàn vẹn (Explicit).
  3. Job Retry Backoff: Job thất bại được thử lại tối đa 3 lần theo lũy thừa mũ (Explicit).

### DOC-EVAL-05: Master Test Plan & QA Strategy (Tiếng Việt)
- **Danh mục kỳ vọng**: `06_QA`
- **Mục tiêu**: Đánh giá phân loại kế hoạch kiểm thử, tiêu chí nghiệm thu và ma trận truy vết RTM.
- **Ground Truth Units**:
  1. Môi trường kiểm thử STG: Môi trường Staging phải đồng nhất cấu hình với Production (Explicit).
  2. Tiêu chí Pass Release: 100% test case P0 đạt kết quả Pass, không còn bug Critical mở (Explicit).
  3. Phạm vi kiểm thử hồi quy: Thực thi tối thiểu 150 kịch bản Regression tự động (Explicit).

### DOC-EVAL-06: UAT Sign-off & Bằng chứng Nghiệm thu (Tiếng Việt)
- **Danh mục kỳ vọng**: `07_EVD_Evidence`
- **Mục tiêu**: Nhận diện biên bản nghiệm thu, audit trail và chữ ký phê duyệt của các bên liên quan.
- **Ground Truth Units**:
  1. Phê duyệt UAT Sprint 3: Đại diện Product Owner đã ký xác nhận bàn giao tính năng (Explicit).
  2. Kết quả kiểm thử tự động: 45/45 test cases automated chạy thành công trên STG (Explicit).

### DOC-EVAL-07: Đặc tả Đa mục đích Feature & API Spec (Song ngữ)
- **Danh mục kỳ vọng**: `02_Business_Requirements` (Primary) và `05_Technical_Documents` (Secondary)
- **Mục tiêu**: Đánh giá phân loại đa nhãn (Multi-label Classification) và Multi-label F1.
- **Ground Truth Units**:
  1. Điều kiện cấp tín dụng: Khách hàng có điểm tín dụng trên 650 (Explicit).
  2. Payload Endpoint POST /api/credit: Body JSON chứa trường identity_number và amount (Explicit).

### DOC-EVAL-08: Tài liệu Xung đột Ngữ nghĩa (Contradiction Stress Test)
- **Danh mục kỳ vọng**: `02_Business_Requirements`
- **Mục tiêu**: Kiểm định thuật toán phát hiện mâu thuẫn (Conflict Detection Precision & Recall).
- **Ground Truth Conflicts**:
  1. Mâu thuẫn Critical: Thời gian timeout 30 phút (mâu thuẫn với DOC-EVAL-01 quy định 15 phút).
  2. Mâu thuẫn Critical: Xác thực MFA là tùy chọn không bắt buộc (mâu thuẫn với quy chuẩn bảo mật bắt buộc).

---

## 3. Các Chỉ số Đánh giá Đầu ra (Benchmark Metrics)

$$\text{Accuracy}_{\text{class}} = \frac{\text{Số tài liệu phân loại đúng}}{N_{\text{total}}}$$

$$\text{Precision}_{\text{extract}} = \frac{\text{Số units trích xuất đúng}}{\text{Tổng số units trích xuất}}, \quad \text{Recall}_{\text{extract}} = \frac{\text{Số units trích xuất đúng}}{\text{Tổng số units ground truth}}$$

$$\text{Recall}_{\text{conflict}} = \frac{\text{Số xung đột phát hiện đúng}}{\text{Tổng số xung đột ground truth}}$$

- **Ngưỡng chất lượng tối thiểu (Acceptance Thresholds)**:
  - $\text{Accuracy}_{\text{class}} \ge 85\%$
  - $\text{Precision}_{\text{extract}} \ge 80\%$
  - $\text{Recall}_{\text{extract}} \ge 80\%$
  - $\text{Recall}_{\text{conflict}} \ge 85\%$
