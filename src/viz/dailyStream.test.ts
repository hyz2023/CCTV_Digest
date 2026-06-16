import { describe, it, expect } from 'vitest';
import { rollingMean, SMOOTH_WINDOW } from './dailyStream';

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
