import { describe, it, expect } from 'vitest';
import { radarLabel, radarIcon, confidenceLabel, polarityLabel, polarityColor } from './labels';

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
});
