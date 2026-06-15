import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { getApiKey } from './resolve';
import type { StageModelConfig } from './types';

// All providers (DeepSeek, SiliconFlow, Vercel AI Gateway, generic) expose an
// OpenAI-compatible endpoint, so they share one code path.
export function getModel(cfg: StageModelConfig): LanguageModel {
  if (!cfg.baseURL) {
    throw new Error(`baseURL required for provider '${cfg.provider}'`);
  }
  const provider = createOpenAICompatible({
    name: cfg.provider,
    baseURL: cfg.baseURL,
    apiKey: getApiKey(cfg),
  });
  return provider(cfg.model);
}
