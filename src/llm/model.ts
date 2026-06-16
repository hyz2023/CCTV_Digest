import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { getApiKey } from './resolve';
import type { StageModelConfig } from './types';

// DeepSeek (and OpenAI) reject `response_format: json_object` unless the literal
// token "json" appears somewhere in the messages. `generateObject` emits that
// response_format for OpenAI-compatible providers, so every structured call
// passes this as its system message to satisfy the constraint.
export const JSON_SYSTEM =
  'Always respond with a single valid JSON object conforming to the provided schema. 只输出合法的 JSON，不要包含任何多余文字或解释。';

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
    // DeepSeek V4 only supports json_object (not json_schema structured outputs),
    // so we stay in json mode: the schema is described in the prompt and validated
    // client-side by generateObject. Keep schemas lenient to absorb minor drift.
  });
  return provider(cfg.model);
}
