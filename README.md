# DocQA: AI-Ready Project Documentation & QA Management Platform

Hệ thống Fullstack gồm **Frontend (React + TypeScript + Tailwind)** và **Backend (Node.js + Express + TypeScript + AI Engine)** được xây dựng hoàn chỉnh và tuân thủ chặt chẽ tài liệu đặc tả **`AI_Project_Documentation_QA_Platform_Proposal.docx`**.

---

## 🏗️ Kiến trúc Hệ thống (Fullstack Architecture)

```
UI-QA/
├── server/                     # Backend API Server (Port 5001)
│   ├── src/
│   │   ├── common/             # Tiện ích dùng chung
│   │   │   ├── crypto.ts       # Mã băm SHA-256 & Chained Hash Block
│   │   │   ├── response.ts     # Standardized JSON response envelope
│   │   │   └── types.ts        # Data Models & Interfaces
│   │   ├── modules/
│   │   │   ├── ai/             # Động cơ AI Copilot (Gemini / OpenAI / Grounded Engine)
│   │   │   │   ├── ai.controller.ts
│   │   │   │   ├── ai.service.ts
│   │   │   │   └── ai.prompts.ts
│   │   │   ├── documents/      # Quản trị tài liệu, versioning & checksum
│   │   │   ├── requirements/   # Quản lý yêu cầu, ACs, Business rules
│   │   │   ├── evidence/       # Bằng chứng EVD, SHA-256 storageChecksum
│   │   │   ├── testcases/      # 3-column workspace data & export
│   │   │   ├── testruns/       # Execution console & auto defect filing
│   │   │   ├── bugs/           # Defect management & backlinks
│   │   │   ├── traceability/   # End-to-end trace matrix & gap analysis (AC-08)
│   │   │   └── audit/          # Tamper-evident chained block hash audit trail
│   │   ├── app.ts
│   │   └── main.ts
│   ├── .env.example
│   └── package.json
│
├── src/                        # Frontend Single Page App (Port 3000)
│   ├── common/                 # Phân hệ dùng chung
│   │   ├── components/         # Button, Badge, Card, Modal, Input
│   │   ├── i18n/               # Quản lý đa ngôn ngữ (Tiếng Việt & English)
│   │   ├── services/api.ts     # API client kết nối Backend port 5001
│   │   └── utils/              # Hash, Date, Export CSV (UTF-8 BOM), Storage
│   ├── locales/                # vi.ts và en.ts
│   ├── components/             # Các màn hình theo tài liệu Proposal
│   ├── context/AppContext.tsx  # Global State & Persistence
│   └── types/index.ts
```

---

## 🤖 Tính năng Tích hợp AI (Backend AI Copilot Engine)

Tuân thủ nghiêm ngặt **Mục 8 & Mục 8.1 Proposal**:

1. **Grounded Output (Có căn cứ)**:
   - AI chỉ sinh Test Case dựa trên Yêu cầu đã duyệt và tài liệu nguồn tham chiếu.
   - Mỗi Test Case được gán mã băm trích dẫn nguồn `citationHash` (`sha256:...`).
2. **No Silent Assumptions (Không suy đoán nghiệp vụ)**:
   - Các điểm thiếu sót hoặc mơ hồ trong quy tắc nghiệp vụ được trích xuất thành danh sách `unconfirmedAssumptions` để BA/PM làm rõ, ngăn chặn việc AI tự suy đoán.
3. **Human-in-the-loop (Con người kiểm soát)**:
   - Tất cả ca kiểm thử sinh ra bởi AI bắt buộc có trạng thái `Draft` (`Draft Status Only`). Không bao giờ tự động chuyển thành `Approved`.
4. **Change Impact Blast-Radius Analysis (Phân tích phạm vi ảnh hưởng)**:
   - Khi tài liệu hoặc yêu cầu thay đổi phiên bản, AI tự động tính toán blast radius và đánh dấu các ca kiểm thử liên quan cần xem xét lại (`In Review`) thay vì âm thầm cập nhật kết quả mong đợi.
5. **Hỗ trợ đa mô hình (Multi-provider Support)**:
   - Hỗ trợ **Google Gemini API** (`gemini-1.5-pro`).
   - Hỗ trợ **OpenAI API** (`gpt-4o`).
   - **Grounded Deterministic Engine**: Tích hợp sẵn động cơ cục bộ chạy ngay lập tức mà không bắt buộc có API key, phục vụ thử nghiệm offline hoặc trong môi trường sandbox an toàn.

---

## 📡 Danh sách API Endpoints chính

### AI Copilot (`/api/v1/ai`)
- `GET  /api/v1/ai/status` : Kiểm tra trạng thái động cơ AI và chính sách kiểm soát.
- `POST /api/v1/ai/generate-testcases` : Sinh kịch bản kiểm thử có căn cứ kèm mã băm SHA-256.
- `POST /api/v1/ai/impact-analysis` : Phân tích phạm vi ảnh hưởng khi tài liệu thay đổi.

### Documents & Requirements
- `GET  /api/v1/documents` : Danh sách tài liệu theo 8 thư mục chuẩn.
- `POST /api/v1/documents` : Tải lên / Tạo tài liệu kèm mã băm SHA-256 Checksum.
- `PATCH /api/v1/documents/:id/status` : Chuyển trạng thái tài liệu (kiểm soát quyền RBAC).
- `GET  /api/v1/requirements` : Danh sách yêu cầu có cấu trúc.
- `PATCH /api/v1/requirements/:id/status` : Duyệt yêu cầu (chỉ cho phép Approver/Admin).

### Evidence & Test Cases
- `GET  /api/v1/evidence` : Thư viện bằng chứng kiểm thử (Screenshot, Log, Response).
- `POST /api/v1/evidence` : Đăng ký bằng chứng kèm `storageChecksum`.
- `PATCH /api/v1/evidence/:id/verify` : Ký xác nhận chứng thực bằng chứng.
- `GET  /api/v1/testcases/:id/workspace` : Dữ liệu không gian làm việc 3 cột đặc tả.

### Audit & Security
- `GET  /api/v1/audit/events` : Danh sách sự kiện kiểm toán.
- `POST /api/v1/audit/verify-chain` : Kiểm tra tính toàn vẹn chuỗi khối mã băm SHA-256 (`Tamper-evident verification`).

---

## 🚀 Khởi chạy toàn bộ hệ thống

### 1. Khởi chạy Backend Server (Port 5001)
```bash
cd server
npm install
npm run dev
# hoặc chạy production:
npm run build && npm start
```

### 2. Khởi chạy Frontend UI (Port 3000)
```bash
npm install
npm run dev
```

Truy cập: **[http://localhost:3000](http://localhost:3000)**
Health check Backend: **[http://localhost:5001/health](http://localhost:5001/health)**
