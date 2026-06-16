import { describe, it, expect } from 'vitest';
import { rollingMean, SMOOTH_WINDOW, topTermGroups, buildDailyStreamSeries } from './dailyStream';

describe('rollingMean', () => {
  it('window <= 1 原样返回（副本）', () => {
    expect(rollingMean([1, 2, 3], 1)).toEqual([1, 2, 3]);
  });
  it('居中 3 窗口、边缘收缩', () => {
    const r = rollingMean([0, 0, 9, 0, 0], 3);
    expect(r[0]).toBe(0);
    expect(r[1]).toBeCloseTo(3);
    expect(r[2]).toBeCloseTo(3);
    expect(r[4]).toBe(0);
  });
  it('平直序列保持不变', () => {
    expect(rollingMean([2, 2, 2, 2], 7)).toEqual([2, 2, 2, 2]);
  });
  it('SMOOTH_WINDOW 默认 7', () => {
    expect(SMOOTH_WINDOW).toBe(7);
  });
});

describe('topTermGroups', () => {
  it('取 top-N 提法各作为单词组，带颜色', () => {
    const g = topTermGroups([
      { day: '2026-01-01', term: 'A', count: 5 },
      { day: '2026-01-02', term: 'B', count: 9 },
      { day: '2026-01-03', term: 'C', count: 1 },
    ], 2);
    expect(g.map((x) => x.name)).toEqual(['B', 'A']);
    expect(g[0].terms).toEqual(['B']);
    expect(g[0].color).toMatch(/^#/);
  });
});

describe('buildDailyStreamSeries', () => {
  const mentions = [
    { day: '2026-01-01', term: 'x1', count: 2 },
    { day: '2026-01-01', term: 'y1', count: 1 },
    { day: '2026-01-02', term: 'x2', count: 4 },
    { day: '2026-01-03', term: 'y1', count: 3 },
  ];
  const groups = [
    { name: 'X', color: '#f00', terms: ['x1', 'x2'] },
    { name: 'Y', color: '#0f0', terms: ['y1'] },
  ];
  it('periods 为升序日期', () => {
    const s = buildDailyStreamSeries(mentions, groups, { window: 1 });
    expect(s.periods).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });
  it('按成员词逐日聚合（window=1 即原始）', () => {
    const s = buildDailyStreamSeries(mentions, groups, { window: 1 });
    expect(s.streams.find((v) => v.term === 'X')!.values).toEqual([2, 4, 0]);
    expect(s.streams.find((v) => v.term === 'Y')!.values).toEqual([1, 0, 3]);
  });
  it('默认窗口做平滑（3 点全覆盖 → 均值）', () => {
    const s = buildDailyStreamSeries(mentions, groups);
    const x = s.streams.find((v) => v.term === 'X')!.values;
    expect(x.every((v) => Math.abs(v - 2) < 1e-9)).toBe(true);
  });
});
