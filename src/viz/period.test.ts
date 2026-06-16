import { describe, it, expect } from 'vitest';
import { buildPeriodDateMap } from './period';

describe('buildPeriodDateMap', () => {
  it('maps each month to its latest available date', () => {
    const m = buildPeriodDateMap(['2025-06-01', '2025-06-15', '2025-06-09', '2025-07-03']);
    expect(m['2025-06']).toBe('2025-06-15');
    expect(m['2025-07']).toBe('2025-07-03');
  });
  it('handles an empty list', () => {
    expect(buildPeriodDateMap([])).toEqual({});
  });
  it('ignores falsy entries', () => {
    expect(buildPeriodDateMap(['', '2026-01-02'])).toEqual({ '2026-01': '2026-01-02' });
  });
});
