import { describe, it, expect, vi } from 'vitest';
import { persistAnalysis } from './persist';
import type { DeepInterpretation } from './schema';
import type { RadarEvent } from '@/radar/detect';

const interp: DeepInterpretation = { signals: [{ title: 't', theme: 'th', confidence: 'high', sectors: [], tickers: [], thread: '科技', fromRadar: false }] };
const radar: RadarEvent[] = [{ day: '2026-06-13', type: 'new_tifa', target: '人工智能+', magnitude: 3 }];

describe('persistAnalysis', () => {
  it('replaces radar, upserts interpretation, then marks analyzed (in order)', async () => {
    const calls: string[] = [];
    const deps = {
      replaceRadar: vi.fn(async () => { calls.push('radar'); }),
      upsertInterpretation: vi.fn(async () => { calls.push('interp'); }),
      markAnalyzed: vi.fn(async () => { calls.push('mark'); }),
    };
    await persistAnalysis('2026-06-13', radar, interp, 'deepseek-v4-pro', deps);
    expect(deps.replaceRadar).toHaveBeenCalledWith('2026-06-13', radar);
    expect(deps.upsertInterpretation).toHaveBeenCalledWith('2026-06-13', interp, 'deepseek-v4-pro');
    expect(calls).toEqual(['radar', 'interp', 'mark']);
  });
});
