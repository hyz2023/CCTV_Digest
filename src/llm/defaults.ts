import type { ProviderId, Stage, StageModelConfig } from './types';

// baseURL undefined for 'openai-compatible' — caller must supply it via override.
// NOTE: confirm DeepSeek V4 model id strings and the AI Gateway baseURL against
// current provider docs at integration time; both are configurable.
export const PROVIDER_PRESETS: Record<ProviderId, { baseURL?: string; apiKeyEnv: string }> = {
  deepseek: { baseURL: 'https://api.deepseek.com/v1', apiKeyEnv: 'DEEPSEEK_API_KEY' },
  siliconflow: { baseURL: 'https://api.siliconflow.cn/v1', apiKeyEnv: 'SILICONFLOW_API_KEY' },
  gateway: { baseURL: 'https://ai-gateway.vercel.sh/v1', apiKeyEnv: 'AI_GATEWAY_API_KEY' },
  'openai-compatible': { apiKeyEnv: 'OPENAI_COMPATIBLE_API_KEY' },
};

function deepseek(model: string): StageModelConfig {
  return { provider: 'deepseek', model, ...PROVIDER_PRESETS.deepseek } as StageModelConfig;
}

// Default: DeepSeek V4 — Flash for high-volume, Pro for the IP-critical stages.
export const DEFAULT_STAGE_CONFIG: Record<Stage, StageModelConfig> = {
  extraction: deepseek('deepseek-v4-flash'),
  radar: deepseek('deepseek-v4-flash'),
  deep: deepseek('deepseek-v4-pro'),
  thread: deepseek('deepseek-v4-pro'),
};
