import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EvalRunner } from './evalRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function updateBaselineAndReport(): void {
  console.log('[EvalRunner] Running AI Evaluation suite on dataset.v1.json...');
  const { metrics, detailedResults } = EvalRunner.run();

  // 1. Write baseline snapshot
  const baselinePath = path.join(__dirname, 'baseline.json');
  fs.writeFileSync(baselinePath, JSON.stringify(metrics, null, 2), 'utf-8');
  console.log(`[EvalRunner] Baseline updated at: ${baselinePath}`);

  // 2. Write official evaluation report
  const reportPath = path.resolve(__dirname, '../../../../docs/AI-EVALUATION-REPORT.md');
  const evalStatus = {
    accuracy: metrics.classificationAccuracy >= 85.0 ? '✅ ĐẠT' : '❌ CHƯA ĐẠT',
    f1: metrics.multiLabelF1 >= 80.0 ? '✅ ĐẠT' : '❌ CHƯA ĐẠT',
    precision: metrics.extractionPrecision >= 80.0 ? '✅ ĐẠT' : '❌ CHƯA ĐẠT',
    recall: metrics.extractionRecall >= 80.0 ? '✅ ĐẠT' : '❌ CHƯA ĐẠT',
    conflict: metrics.conflictDetectionRecall >= 85.0 ? '✅ ĐẠT' : '❌ CHƯA ĐẠT',
    latency: metrics.averageLatencyMs < 500 ? '✅ ĐẠT' : '⚠️ CHẬM'
  };

  const reportMarkdown = `# AI Document Pipeline Evaluation Report (Epic E9)

Báo cáo kết quả kiểm thử định lượng hệ thống trích xuất tri thức và phân loại tài liệu tự động trên bộ dữ liệu kiểm chuẩn chuẩn hóa \`dataset.v1.json\` (DOC-EVAL-01 đến DOC-EVAL-${metrics.totalCases < 10 ? '0' + metrics.totalCases : metrics.totalCases}).

---

## 1. Tổng hợp Chỉ số Đo lường (Benchmark Summary)

| Chỉ số (Metric) | Ngưỡng yêu cầu (Threshold) | Kết quả đạt được (Actual) | Đánh giá |
|---|---|---|---|
| **Classification Accuracy** | $\\ge 85.0\\%$ | **${metrics.classificationAccuracy}%** (${detailedResults.filter(r => r.isCorrect).length}/${metrics.totalCases}) | ${evalStatus.accuracy} |
| **Multi-label F1** | $\\ge 80.0\\%$ | **${metrics.multiLabelF1}%** | ${evalStatus.f1} |
| **Extraction Precision** | $\\ge 80.0\\%$ | **${metrics.extractionPrecision}%** | ${evalStatus.precision} |
| **Extraction Recall** | $\\ge 80.0\\%$ | **${metrics.extractionRecall}%** | ${evalStatus.recall} |
| **Conflict Detection Recall** | $\\ge 85.0\\%$ | **${metrics.conflictDetectionRecall}%** | ${evalStatus.conflict} |
| **Thời gian xử lý trung bình** | $< 500\\text{ms}$ / doc | **${metrics.averageLatencyMs} ms** | ${evalStatus.latency} |
| **Tổng tokens tiêu thụ** | Giám sát | **${metrics.totalTokensEstimated} tokens** | Tiết kiệm 100% token LLM |

---

## 2. Chi tiết Kết quả từng Test Case

| Mã Case | Tiêu đề Tài liệu | Danh mục Kỳ vọng | Phân loại Dự đoán | Điểm số | Trạng thái |
|---|---|---|---|---|---|
${detailedResults.map(r => `| \`${r.id}\` | ${r.title} | \`${r.expectedCategory}\` | \`${r.predictedCategory}\` | **${(r.primaryScore * 100).toFixed(1)}%** | ${r.isCorrect ? '✅ PASS' : '❌ FAIL'} |`).join('\n')}

---

## 3. Kết luận & Khuyến nghị Điều chỉnh Trọng số (E9-T4)

1. Thuật toán **Deterministic Scoring** với tỷ lệ trọng số 35% Tên file/Đường dẫn + 35% Cấu trúc Tiêu đề + 30% Tần suất Từ khóa đạt độ chính xác **${metrics.classificationAccuracy}%** trên ${metrics.totalCases} test cases mà không cần gọi mô hình LLM bên ngoài.
2. Kiểm tra xung đột ngữ nghĩa FTS5 kết hợp phân tích từ khóa phủ định và đơn vị số phát hiện chính xác ${metrics.conflictDetectionRecall}% các trường hợp mâu thuẫn (bao gồm thời gian timeout, xung đột phủ định bắt buộc/không bắt buộc 2FA, và thời gian xử lý số nguyên).
3. Bộ dữ liệu baseline được lưu trữ có phiên bản tại \`server/src/tests/eval/baseline.json\` để phục vụ hồi quy tự động trong CI/CD (chỉ cập nhật khi chạy lệnh \`npm run eval:update-baseline\`).
`;

  fs.writeFileSync(reportPath, reportMarkdown, 'utf-8');
  console.log(`[EvalRunner] Report updated at: ${reportPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  updateBaselineAndReport();
}
