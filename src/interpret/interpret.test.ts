import { describe, it, expect, vi } from 'vitest';
import { interpretDay } from './interpret';
import type { DeepInterpretation } from './schema';

const canned: DeepInterpretation = {
  signals: [{ title: 't', theme: 'th', confidence: 'high', sectors: [{ sector: '半导体', polarity: 'bull' }], tickers: [], thread: '科技', fromRadar: true }],
};

describe('interpretDay', () => {
  it('returns the model interpretation via injected generate', async () => {
    const generate = vi.fn(async () => canned);
    const out = await interpretDay({ date: '2026-06-13', items: [{ ord: 1, segment: 'leader', title: 'x', summary: 'y' }], radar: [] }, { generate });
    expect(out).toEqual(canned);
    expect(generate).toHaveBeenCalledOnce();
  });
  it('throws when there are no items', async () => {
    const generate = vi.fn(async () => canned);
    await expect(interpretDay({ date: '2026-06-13', items: [], radar: [] }, { generate })).rejects.toThrow(/no items|empty/i);
    expect(generate).not.toHaveBeenCalled();
  });
});
