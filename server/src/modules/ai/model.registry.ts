import { AiProviderId } from '../../common/types.js';

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  recommended?: boolean;
}

export const PROVIDER_MODELS: Record<AiProviderId, ModelOption[]> = {
  google: [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Recommended for complex reasoning and grounded synthesis', recommended: true },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast, lightweight and cost-efficient' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Next-gen low-latency multimodal model' }
  ],
  anthropic: [
    { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet', description: 'Advanced hybrid reasoning and code analysis', recommended: true },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Industry-leading code generation and QA logic' },
    { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku', description: 'Lightning fast sub-second analysis' }
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o (Omni)', description: 'Flagship multimodal high-intelligence model', recommended: true },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable for standard test generation' },
    { id: 'o1', name: 'OpenAI o1', description: 'Deep reasoning model for rigorous edge cases' },
    { id: 'o3-mini', name: 'OpenAI o3-mini', description: 'Reasoning model tailored for STEM and coding' }
  ],
  custom: [
    { id: 'custom-model', name: 'Custom / Local Model', description: 'Configured via Custom Base URL (Ollama, vLLM, etc.)', recommended: true },
    { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', description: 'Open source local deployment' },
    { id: 'deepseek-r1', name: 'DeepSeek R1', description: 'Reasoning model for local/private inference' }
  ]
};
