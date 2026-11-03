import { AiProviderId, ModelOption } from '../../common/types.js';

export const PROVIDER_MODELS: Record<AiProviderId, ModelOption[]> = {
  google: [
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      description: 'Mô hình lý luận sâu, cửa sổ ngữ cảnh cực đại 2 triệu token phù hợp đọc toàn bộ SRS/BRD',
      recommended: true,
      contextWindow: '2,000,000 tokens',
      maxOutput: '8,192 tokens',
      category: 'reasoning',
      rateLimits: { rpm: 360, tpm: 4000000, rpd: 10000 },
      pricingType: 'token_billed',
      bestFor: 'Tổng hợp tài liệu lớn, Phân tích Blast-Radius, Sinh test case phức tạp'
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      description: 'Mô hình siêu nhanh, chi phí tối ưu, độ trễ thấp phù hợp rà soát nhanh',
      recommended: false,
      contextWindow: '1,000,000 tokens',
      maxOutput: '8,192 tokens',
      category: 'fast',
      rateLimits: { rpm: 1000, tpm: 4000000, rpd: 20000 },
      pricingType: 'token_billed',
      bestFor: 'Rà soát lỗi chính tả, Kiểm tra format định dạng, Phân loại yêu cầu'
    },
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      description: 'Thế hệ mới đa phương thức với tốc độ phản hồi cực nhanh dưới 1 giây',
      recommended: false,
      contextWindow: '1,000,000 tokens',
      maxOutput: '8,192 tokens',
      category: 'flagship',
      rateLimits: { rpm: 2000, tpm: 4000000, rpd: 30000 },
      pricingType: 'token_billed',
      bestFor: 'Xử lý bằng chứng hình ảnh (EVD Screenshot), Phân tích đa phương thức'
    }
  ],
  anthropic: [
    {
      id: 'claude-3-7-sonnet',
      name: 'Claude 3.7 Sonnet',
      description: 'Mô hình hybrid reasoning hàng đầu, hỗ trợ suy luận mở rộng và phân tích mã nguồn QA chuẩn xác',
      recommended: true,
      contextWindow: '200,000 tokens',
      maxOutput: '64,000 tokens',
      category: 'reasoning',
      rateLimits: { rpm: 1000, tpm: 400000 },
      pricingType: 'subscription_included',
      bestFor: 'Sinh ca kiểm thử ranh giới (Edge Case), Phân tích mâu thuẫn yêu cầu, Review Code'
    },
    {
      id: 'claude-3-5-sonnet',
      name: 'Claude 3.5 Sonnet',
      description: 'Tiêu chuẩn ngành về độ chính xác và tư duy lập trình phân tích lỗi QA',
      recommended: false,
      contextWindow: '200,000 tokens',
      maxOutput: '8,192 tokens',
      category: 'flagship',
      rateLimits: { rpm: 1000, tpm: 300000 },
      pricingType: 'subscription_included',
      bestFor: 'Thiết kế kịch bản E2E Test, Đánh giá Traceability Matrix'
    },
    {
      id: 'claude-3-5-haiku',
      name: 'Claude 3.5 Haiku',
      description: 'Mô hình nhỏ gọn phản hồi tức thì với chi phí tối thiểu',
      recommended: false,
      contextWindow: '200,000 tokens',
      maxOutput: '8,192 tokens',
      category: 'fast',
      rateLimits: { rpm: 2000, tpm: 500000 },
      pricingType: 'subscription_included',
      bestFor: 'Truy vấn nhanh, Tóm tắt ngắn, Gợi ý bước tái hiện bug'
    }
  ],
  openai: [
    {
      id: 'gpt-4o',
      name: 'GPT-4o (Omni)',
      description: 'Mô hình flagship đa phương thức thông minh toàn diện của OpenAI',
      recommended: true,
      contextWindow: '128,000 tokens',
      maxOutput: '16,384 tokens',
      category: 'flagship',
      rateLimits: { rpm: 500, tpm: 800000 },
      pricingType: 'token_billed',
      bestFor: 'Phân tích tài liệu nghiệp vụ đa dạng, Sinh test suite hoàn chỉnh'
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      description: 'Mô hình kinh tế tốc độ cao cho các tác vụ kiểm thử hàng loạt',
      recommended: false,
      contextWindow: '128,000 tokens',
      maxOutput: '16,384 tokens',
      category: 'fast',
      rateLimits: { rpm: 3000, tpm: 2000000 },
      pricingType: 'token_billed',
      bestFor: 'Sinh test case tự động số lượng lớn, Kiểm thử hồi quy nhanh'
    },
    {
      id: 'o1',
      name: 'OpenAI o1',
      description: 'Mô hình tư duy chuỗi suy luận sâu (Chain-of-Thought) cho các ca kiểm thử hóc búa',
      recommended: false,
      contextWindow: '200,000 tokens',
      maxOutput: '100,000 tokens',
      category: 'reasoning',
      rateLimits: { rpm: 1000, tpm: 100000 },
      pricingType: 'token_billed',
      bestFor: 'Bảo mật, Kiểm tra lỗ hổng logic nghiệp vụ phức tạp'
    },
    {
      id: 'o3-mini',
      name: 'OpenAI o3-mini',
      description: 'Mô hình suy luận thế hệ mới tối ưu hoá riêng cho lập trình và khoa học kỹ thuật',
      recommended: false,
      contextWindow: '200,000 tokens',
      maxOutput: '100,000 tokens',
      category: 'reasoning',
      rateLimits: { rpm: 3000, tpm: 150000 },
      pricingType: 'token_billed',
      bestFor: 'Phân tích thuật toán kiểm thử, Tự động viết mã test script'
    }
  ],
  custom: [
    {
      id: 'custom-model',
      name: 'Custom / Local Model',
      description: 'Mô hình tuỳ biến kết nối qua Base URL nội bộ (Ollama, vLLM, LMStudio)',
      recommended: true,
      contextWindow: '128,000 tokens (Tuỳ cấu hình)',
      maxOutput: '8,192 tokens',
      category: 'local',
      rateLimits: { rpm: 9999, tpm: 9999999 },
      pricingType: 'subscription_included',
      bestFor: 'Môi trường On-Premise bảo mật tuyệt đối, Không gửi dữ liệu ra ngoài'
    },
    {
      id: 'llama-3.3-70b',
      name: 'Llama 3.3 70B',
      description: 'Mô hình mã nguồn mở tiên tiến triển khai trên máy chủ GPU riêng',
      recommended: false,
      contextWindow: '128,000 tokens',
      maxOutput: '8,192 tokens',
      category: 'local',
      rateLimits: { rpm: 9999, tpm: 9999999 },
      pricingType: 'subscription_included',
      bestFor: 'Xử lý dữ liệu tài liệu bảo mật nội bộ doanh nghiệp'
    },
    {
      id: 'deepseek-r1',
      name: 'DeepSeek R1',
      description: 'Mô hình suy luận mã nguồn mở mạnh mẽ tương đương mô hình o1',
      recommended: false,
      contextWindow: '64,000 tokens',
      maxOutput: '8,192 tokens',
      category: 'reasoning',
      rateLimits: { rpm: 9999, tpm: 9999999 },
      pricingType: 'subscription_included',
      bestFor: 'Lập luận logic sâu trong môi trường On-Premise'
    }
  ]
};
