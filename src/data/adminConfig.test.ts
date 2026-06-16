import { describe, it, expect } from 'vitest';
import { validateStageUpdate } from './adminConfig';

describe('validateStageUpdate', () => {
  it('accepts a valid update', () => {
    const r = validateStageUpdate({ stage: 'deep', provider: 'deepseek', model: 'deepseek-v4-pro', baseUrl: 'https://api.deepseek.com/v1', apiKeyEnv: 'DEEPSEEK_API_KEY' });
    expect(r.ok).toBe(true);
  });
  it('rejects an unknown stage', () => {
    expect(validateStageUpdate({ stage: 'nope', provider: 'deepseek', model: 'm', apiKeyEnv: 'X' }).ok).toBe(false);
  });
  it('rejects an unknown provider', () => {
    expect(validateStageUpdate({ stage: 'deep', provider: 'bogus', model: 'm', apiKeyEnv: 'X' }).ok).toBe(false);
  });
  it('rejects a missing model', () => {
    expect(validateStageUpdate({ stage: 'deep', provider: 'deepseek', model: '', apiKeyEnv: 'X' }).ok).toBe(false);
  });
  it('never passes through an apiKey value (keys stay in env)', () => {
    const r = validateStageUpdate({ stage: 'deep', provider: 'deepseek', model: 'm', apiKeyEnv: 'X', apiKey: 'sk-leak' } as Record<string, unknown>);
    expect(r.ok).toBe(true);
    expect('apiKey' in (r.value ?? {})).toBe(false);
  });
});
