import { describe, it, expect } from 'vitest';
import { estimateCostUsd } from './cost';

describe('estimateCostUsd', () => {
  it('prices DeepSeek V4 Pro per the table', () => {
    expect(estimateCostUsd('deepseek-v4-pro', { inputTokens: 1000, outputTokens: 2000 })).toBeCloseTo(0.002175, 9);
  });
  it('prices DeepSeek V4 Flash', () => {
    expect(estimateCostUsd('deepseek-v4-flash', { inputTokens: 1_000_000, outputTokens: 0 })).toBeCloseTo(0.09, 9);
  });
  it('returns null for an unknown model', () => {
    expect(estimateCostUsd('mystery-model', { inputTokens: 100, outputTokens: 100 })).toBeNull();
  });
  it('is zero for zero usage on a known model', () => {
    expect(estimateCostUsd('deepseek-v4-flash', { inputTokens: 0, outputTokens: 0 })).toBe(0);
  });
});
