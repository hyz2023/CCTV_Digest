import { describe, it, expect, vi } from 'vitest';
import { persistExtraction } from './persist';
import type { Extraction } from './schema';

const ex: Extraction = {
  items: [{ ord: 1, segment: 'leader', title: 'a', summary: 'sa' }],
  tifa: [{ term: '新质生产力', count: 2 }],
  sectors: [{ sector: '半导体', polarity: 'bull', strength: 0.5 }],
};

describe('persistExtraction', () => {
  it('writes items/tifa/mentions/sector + marks extracted via injected deps', async () => {
    const calls: string[] = [];
    const deps = {
      insertItems: vi.fn(async () => { calls.push('items'); }),
      upsertTifa: vi.fn(async () => { calls.push('tifa'); }),
      insertTifaMentions: vi.fn(async () => { calls.push('mentions'); }),
      insertSectorSignals: vi.fn(async () => { calls.push('sectors'); }),
      markExtracted: vi.fn(async () => { calls.push('mark'); }),
    };
    await persistExtraction('2026-06-13', ex, deps);
    expect(deps.insertItems).toHaveBeenCalledOnce();
    expect(deps.upsertTifa).toHaveBeenCalledWith('2026-06-13', ['新质生产力']);
    expect(deps.insertSectorSignals).toHaveBeenCalledOnce();
    expect(calls).toContain('mark');
  });
});
