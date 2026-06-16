import { describe, it, expect, vi } from 'vitest';
import { analyzeDay, shouldSkipAnalysis } from './run';
import type { DeepInterpretation } from './schema';

const interp: DeepInterpretation = { signals: [{ title: 't', theme: 'th', confidence: 'low', sectors: [], tickers: [], thread: 'x', fromRadar: false }] };

describe('shouldSkipAnalysis', () => {
  it('skips already-analyzed days', () => { expect(shouldSkipAnalysis({ status: 'analyzed' })).toBe(true); });
  it('does not skip extracted days', () => { expect(shouldSkipAnalysis({ status: 'extracted' })).toBe(false); });
});

describe('analyzeDay', () => {
  it('skips when already analyzed', async () => {
    const deps = { getDay: vi.fn(async () => ({ status: 'analyzed' })), loadInputs: vi.fn(), detect: vi.fn(), interpret: vi.fn(), persist: vi.fn(), model: 'm' };
    const r = await analyzeDay('2026-06-13', deps);
    expect(r.skipped).toBe(true);
    expect(deps.interpret).not.toHaveBeenCalled();
  });
  it('throws when the day is not extracted yet', async () => {
    const deps = { getDay: vi.fn(async () => ({ status: 'ingested' })), loadInputs: vi.fn(), detect: vi.fn(), interpret: vi.fn(), persist: vi.fn(), model: 'm' };
    await expect(analyzeDay('2026-06-13', deps)).rejects.toThrow(/not extracted/i);
  });
  it('runs radar + interpret + persist for an extracted day', async () => {
    const deps = {
      getDay: vi.fn(async () => ({ status: 'extracted' })),
      loadInputs: vi.fn(async () => ({ items: [{ ord: 1, segment: 'leader', title: 'x', summary: 'y' }], mentions: [{ day: '2026-06-13', term: 'x', count: 1 }] })),
      detect: vi.fn(() => [{ day: '2026-06-13', type: 'new_tifa' as const, target: 'x', magnitude: 1 }]),
      interpret: vi.fn(async () => interp),
      persist: vi.fn(async () => {}),
      model: 'deepseek-v4-pro',
    };
    const r = await analyzeDay('2026-06-13', deps);
    expect(r.skipped).toBe(false);
    expect(deps.detect).toHaveBeenCalled();
    expect(deps.interpret).toHaveBeenCalled();
    expect(deps.persist).toHaveBeenCalledOnce();
  });
});
