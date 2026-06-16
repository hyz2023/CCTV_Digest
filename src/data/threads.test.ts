import { describe, it, expect } from 'vitest';
import { threadPointsToStreamSeries } from './threads';

describe('threadPointsToStreamSeries', () => {
  it('pivots thread points into an aligned StreamSeries', () => {
    const s = threadPointsToStreamSeries([
      { threadName: '科技', color: '#f00', period: '2026-01', intensity: 5 },
      { threadName: '科技', color: '#f00', period: '2026-02', intensity: 4 },
      { threadName: '内需', color: '#0f0', period: '2026-02', intensity: 3 },
    ]);
    expect(s.periods).toEqual(['2026-01', '2026-02']);
    const tech = s.streams.find((x) => x.term === '科技')!;
    expect(tech.values).toEqual([5, 4]);
    const need = s.streams.find((x) => x.term === '内需')!;
    expect(need.values).toEqual([0, 3]);
  });
  it('returns empty series for no points', () => {
    expect(threadPointsToStreamSeries([])).toEqual({ periods: [], streams: [] });
  });
});
