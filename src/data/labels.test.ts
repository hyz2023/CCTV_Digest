import { describe, it, expect } from 'vitest';
import { radarLabel, radarIcon, radarStyle, confidenceLabel, polarityLabel, polarityColor } from './labels';

describe('display labels', () => {
  it('maps radar types to Chinese labels', () => {
    expect(radarLabel('new_tifa')).toBe('新提法首现');
    expect(radarLabel('flip')).toBe('口径翻转');
    expect(radarLabel('order_jump')).toBe('位置前移');
    expect(radarIcon('drumbeat_up')).toBe('▲');
  });
  it('passes through unknown radar types', () => {
    expect(radarLabel('mystery')).toBe('mystery');
    expect(radarIcon('mystery')).toBe('•');
  });
  it('maps confidence and polarity', () => {
    expect(confidenceLabel('high')).toBe('高');
    expect(confidenceLabel('mid')).toBe('中');
    expect(polarityLabel('bull')).toBe('利好');
    expect(polarityLabel('bear')).toBe('利空');
    expect(polarityColor('bull')).toBe('#4ade80');
  });
  it('passes through unknown confidence/polarity', () => {
    expect(confidenceLabel('x')).toBe('x');
    expect(polarityLabel('x')).toBe('x');
  });
  it('returns style config for known radar types', () => {
    const up = radarStyle('drumbeat_up');
    expect(up.fg).toBe('#4ade80');
    expect(up.short).toBe('升温');

    const down = radarStyle('drumbeat_down');
    expect(down.fg).toBe('#f87171');
    expect(down.short).toBe('降温');

    const tifa = radarStyle('new_tifa');
    expect(tifa.fg).toBe('#f5c842');
    expect(tifa.short).toBe('首现');
  });

  it('returns fallback style for unknown radar types', () => {
    const unknown = radarStyle('mystery');
    expect(unknown.fg).toBe('#8a8a98');
    expect(unknown.short).toBe('变化');
  });
});
