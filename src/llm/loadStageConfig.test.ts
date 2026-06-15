import { describe, it, expect } from 'vitest';
import { mergeStageConfig } from './loadStageConfig';

describe('mergeStageConfig', () => {
  it('returns the default when no row exists', () => {
    const c = mergeStageConfig('deep', undefined);
    expect(c.provider).toBe('deepseek');
    expect(c.model).toBe('deepseek-v4-pro');
  });

  it('overlays a DB row over the default', () => {
    const c = mergeStageConfig('extraction', {
      stage: 'extraction',
      provider: 'siliconflow',
      model: 'Qwen3-Flash',
      baseUrl: 'https://api.siliconflow.cn/v1',
      apiKeyEnv: 'SILICONFLOW_API_KEY',
      params: null,
    });
    expect(c.provider).toBe('siliconflow');
    expect(c.model).toBe('Qwen3-Flash');
    expect(c.baseURL).toBe('https://api.siliconflow.cn/v1');
    expect(c.apiKeyEnv).toBe('SILICONFLOW_API_KEY');
  });
});
