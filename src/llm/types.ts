export type Stage = 'extraction' | 'radar' | 'deep' | 'thread';
export type ProviderId = 'deepseek' | 'siliconflow' | 'gateway' | 'openai-compatible';

export interface StageModelConfig {
  provider: ProviderId;
  model: string;
  baseURL?: string;   // OpenAI-compatible endpoint
  apiKeyEnv: string;  // name of the env var holding the key
}
