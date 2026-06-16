import { describe, it, expect } from 'vitest';
import { buildStreamSeries, buildCrossSection, buildKeywordSeries, buildSectorHeatmap } from './series';

const mentions = [
  { day: '2026-01-05', term: 'A', count: 3 },
  { day: '2026-01-20', term: 'A', count: 2 },
  { day: '2026-02-10', term: 'A', count: 4 },
  { day: '2026-01-15', term: 'B', count: 1 },
  { day: '2026-02-02', term: 'B', count: 5 },
  { day: '2026-01-09', term: 'C', count: 1 },
];

describe('buildStreamSeries', () => {
  const s = buildStreamSeries(mentions, { topN: 2 });
  it('keeps only the top-N terms by total count', () => {
    expect(s.streams.map((x) => x.term).sort()).toEqual(['A', 'B']);
  });
  it('buckets by month into aligned period columns', () => {
    expect(s.periods).toEqual(['2026-01', '2026-02']);
    const a = s.streams.find((x) => x.term === 'A')!;
    expect(a.values).toEqual([5, 4]);
    const b = s.streams.find((x) => x.term === 'B')!;
    expect(b.values).toEqual([1, 5]);
  });
  it('assigns a stable color per stream', () => {
    expect(s.streams[0].color).toMatch(/^#/);
  });
});

describe('buildCrossSection (daily)', () => {
  it('只取精确当天的各提法强度，降序', () => {
    const xs = buildCrossSection([
      { day: '2026-02-15', term: 'A', count: 2 },
      { day: '2026-02-15', term: 'B', count: 5 },
      { day: '2026-02-16', term: 'A', count: 9 },
    ], '2026-02-15', { topN: 3 });
    expect(xs.period).toBe('2026-02-15');
    expect(xs.entries[0]).toMatchObject({ term: 'B', value: 5 });
    expect(xs.entries[1]).toMatchObject({ term: 'A', value: 2 });
  });
});

describe('buildKeywordSeries', () => {
  it('returns a single term monthly series', () => {
    const k = buildKeywordSeries(mentions, 'A');
    expect(k.term).toBe('A');
    expect(k.points).toEqual([{ period: '2026-01', value: 5 }, { period: '2026-02', value: 4 }]);
  });
});

describe('buildSectorHeatmap', () => {
  it('pivots sector signals into a sector x period matrix of summed strength', () => {
    const h = buildSectorHeatmap([
      { day: '2026-01-03', sector: '半导体', strength: 0.5 },
      { day: '2026-01-30', sector: '半导体', strength: 0.5 },
      { day: '2026-02-01', sector: '消费', strength: 0.9 },
    ]);
    expect(h.periods).toEqual(['2026-01', '2026-02']);
    expect(h.sectors).toEqual(expect.arrayContaining(['半导体', '消费']));
    const semi = h.rows.find((r) => r.sector === '半导体')!;
    expect(semi.values).toEqual([1.0, 0]);
  });
});
