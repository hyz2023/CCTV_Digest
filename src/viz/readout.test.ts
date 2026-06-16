import { describe, it, expect } from 'vitest';
import { levelOf, trendOf, TREND_LOOKBACK } from './readout';

describe('levelOf (相对当天最强)', () => {
  it('强：>=66%', () => { expect(levelOf(7, 10)).toBe('强'); expect(levelOf(6.6, 10)).toBe('强'); });
  it('中：>=33% 且 <66%', () => { expect(levelOf(5, 10)).toBe('中'); expect(levelOf(3.3, 10)).toBe('中'); });
  it('弱：<33%', () => { expect(levelOf(3.2, 10)).toBe('弱'); expect(levelOf(0, 10)).toBe('弱'); });
  it('dayMax=0 视为弱（防除零）', () => { expect(levelOf(0, 0)).toBe('弱'); });
});

describe('trendOf (今天 vs ~14 天前，死区 15%×dayMax)', () => {
  const dayMax = 10; // 死区 = 1.5
  it('up：超出死区且为正', () => {
    const v = [2,2,2,2,2,2,2,2,2,2,2,2,2,2,9];
    expect(trendOf(v, 14, { dayMax })).toBe('up');
  });
  it('down：超出死区且为负', () => {
    const v = [9,9,9,9,9,9,9,9,9,9,9,9,9,9,2];
    expect(trendOf(v, 14, { dayMax })).toBe('down');
  });
  it('flat：变化在死区内', () => {
    const v = [5,5,5,5,5,5,5,5,5,5,5,5,5,5,6];
    expect(trendOf(v, 14, { dayMax })).toBe('flat');
  });
  it('历史不足 lookback 时与最早值比较', () => {
    expect(trendOf([2, 8], 1, { dayMax })).toBe('up');
  });
  it('越界 idx 取 0', () => {
    expect(trendOf([5, 5], 9, { dayMax })).toBe('down');
  });
  it('暴露默认 lookback 常量', () => { expect(TREND_LOOKBACK).toBe(14); });
});
