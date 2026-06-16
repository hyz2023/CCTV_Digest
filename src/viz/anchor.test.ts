import { describe, it, expect } from 'vitest';
import { anchorIndex } from './anchor';

describe('anchorIndex', () => {
  const periods = ['2025-06-01', '2025-06-02', '2025-06-03'];
  it('无 currentDate → lastIdx', () => { expect(anchorIndex(periods, undefined, 2)).toBe(2); });
  it('命中 currentDate → 其下标', () => { expect(anchorIndex(periods, '2025-06-02', 2)).toBe(1); });
  it('未命中 → 回退 lastIdx', () => { expect(anchorIndex(periods, '2025-12-31', 2)).toBe(2); });
  it('空 periods → lastIdx', () => { expect(anchorIndex([], '2025-06-02', 0)).toBe(0); });
});
