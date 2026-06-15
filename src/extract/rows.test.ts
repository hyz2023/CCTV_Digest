import { describe, it, expect } from 'vitest';
import { buildExtractionRows } from './rows';
import type { Extraction } from './schema';

const ex: Extraction = {
  items: [
    { ord: 1, segment: 'leader', title: 'a', summary: 'sa' },
    { ord: 2, segment: 'leader', title: 'b', summary: 'sb' },
    { ord: 3, segment: 'intl', title: 'c', summary: 'sc' },
  ],
  tifa: [{ term: '新质生产力', count: 3 }, { term: '扩内需', count: 1 }],
  sectors: [{ sector: '半导体', polarity: 'bull', strength: 0.8 }],
};

describe('buildExtractionRows', () => {
  const r = buildExtractionRows('2026-06-13', ex);

  it('maps items with the day', () => {
    expect(r.items).toHaveLength(3);
    expect(r.items[0]).toMatchObject({ day: '2026-06-13', ord: 1, segment: 'leader', title: 'a', summary: 'sa' });
  });
  it('maps tifa terms and per-day mentions', () => {
    expect(r.tifaTerms).toEqual(['新质生产力', '扩内需']);
    expect(r.tifaMentions).toContainEqual({ day: '2026-06-13', term: '新质生产力', count: 3 });
  });
  it('maps sector signals', () => {
    expect(r.sectorSignals).toContainEqual({ day: '2026-06-13', sector: '半导体', polarity: 'bull', strength: 0.8 });
  });
  it('computes segment stats (count + share) per segment', () => {
    expect(r.segmentStats.leader.count).toBe(2);
    expect(r.segmentStats.intl.count).toBe(1);
    expect(r.segmentStats.dev.count).toBe(0);
    expect(r.segmentStats.leader.share).toBeCloseTo(2 / 3, 5);
  });
});
