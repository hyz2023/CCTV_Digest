import { describe, it, expect } from 'vitest';
import { normalizeUsage, buildLlmRunRow } from './usage';

describe('normalizeUsage', () => {
  it('reads AI-SDK v6 inputTokens/outputTokens', () => {
    expect(normalizeUsage({ inputTokens: 12, outputTokens: 7, totalTokens: 19 })).toEqual({ inputTokens: 12, outputTokens: 7 });
  });
  it('falls back to prompt/completion token names', () => {
    expect(normalizeUsage({ promptTokens: 5, completionTokens: 3 })).toEqual({ inputTokens: 5, outputTokens: 3 });
  });
  it('defaults missing/undefined usage to zeros', () => {
    expect(normalizeUsage(undefined)).toEqual({ inputTokens: 0, outputTokens: 0 });
    expect(normalizeUsage({})).toEqual({ inputTokens: 0, outputTokens: 0 });
  });
});

describe('buildLlmRunRow', () => {
  it('maps an entry to a pipeline_run row with computed cost', () => {
    const row = buildLlmRunRow({ day: '2026-06-13', stage: 'deep', provider: 'deepseek', model: 'deepseek-v4-pro', usage: { inputTokens: 1000, outputTokens: 2000 } });
    expect(row).toMatchObject({ day: '2026-06-13', stage: 'deep', provider: 'deepseek', model: 'deepseek-v4-pro', inputTokens: 1000, outputTokens: 2000, status: 'ok' });
    expect(row.costUsd).toBeCloseTo(0.002175, 9);
  });
  it('day defaults to null and unknown model → costUsd null', () => {
    const row = buildLlmRunRow({ stage: 'thread', provider: 'x', model: 'mystery', usage: { inputTokens: 1, outputTokens: 1 } });
    expect(row.day).toBeNull();
    expect(row.costUsd).toBeNull();
  });
});
