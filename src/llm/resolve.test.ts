import { describe, it, expect } from 'vitest';
import { resolveStageConfig, getApiKey } from './resolve';

describe('resolveStageConfig', () => {
  it('defaults extraction to DeepSeek V4 Flash', () => {
    const c = resolveStageConfig('extraction');
    expect(c.provider).toBe('deepseek');
    expect(c.model).toBe('deepseek-v4-flash');
    expect(c.baseURL).toBe('https://api.deepseek.com/v1');
    expect(c.apiKeyEnv).toBe('DEEPSEEK_API_KEY');
  });

  it('defaults deep to DeepSeek V4 Pro', () => {
    expect(resolveStageConfig('deep').model).toBe('deepseek-v4-pro');
  });

  it('applies admin overrides over defaults', () => {
    const c = resolveStageConfig('deep', {
      provider: 'siliconflow', model: 'Qwen3', baseURL: 'https://api.siliconflow.cn/v1', apiKeyEnv: 'SILICONFLOW_API_KEY',
    });
    expect(c.provider).toBe('siliconflow');
    expect(c.model).toBe('Qwen3');
  });

  it('ignores undefined override fields', () => {
    const c = resolveStageConfig('deep', { model: undefined });
    expect(c.model).toBe('deepseek-v4-pro');
  });

  it('throws on an unknown stage', () => {
    // @ts-expect-error runtime guard
    expect(() => resolveStageConfig('nope')).toThrow(/Unknown stage/);
  });
});

describe('getApiKey', () => {
  it('reads the configured env var', () => {
    const c = resolveStageConfig('extraction');
    expect(getApiKey(c, { DEEPSEEK_API_KEY: 'sk-x' })).toBe('sk-x');
  });

  it('throws a clear error when the key is missing', () => {
    const c = resolveStageConfig('extraction');
    expect(() => getApiKey(c, {})).toThrow(/DEEPSEEK_API_KEY/);
  });
});
