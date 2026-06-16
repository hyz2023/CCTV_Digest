import { describe, it, expect } from 'vitest';
import { DeepInterpretationSchema } from './schema';

describe('DeepInterpretationSchema — json_object drift tolerance', () => {
  it('accepts the canonical shape unchanged', () => {
    const r = DeepInterpretationSchema.safeParse({
      signals: [{ title: 't', theme: 'th', confidence: 'high', sectors: [{ sector: '半导体', polarity: 'bull' }], tickers: [], thread: '科技', fromRadar: true }],
    });
    expect(r.success).toBe(true);
  });

  it('aliases sector `name`/`direction` onto sector/polarity (and drops extra keys)', () => {
    const r = DeepInterpretationSchema.safeParse({
      signals: [{ title: '中朝友谊', theme: '深化中朝友谊。', confidence: 'high', sectors: [{ name: '东北概念', direction: 'bull', reason: '边境合作' }], tickers: ['长白山'], thread: '地缘', fromRadar: false }],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.signals[0].sectors[0].sector).toBe('东北概念');
      expect(r.data.signals[0].sectors[0].polarity).toBe('bull');
    }
  });

  it('derives a title from theme when title is missing', () => {
    const r = DeepInterpretationSchema.safeParse({
      signals: [{ theme: '外贸延续强劲增长，彰显制造业出口韧性。后续政策聚焦稳外贸。', confidence: 'mid', sectors: [], tickers: [], thread: '出口', fromRadar: false }],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.signals[0].title.length).toBeGreaterThan(0);
      expect(r.data.signals[0].title).toContain('外贸');
    }
  });

  it('caps signals to at most 3', () => {
    const sig = { theme: 'x', confidence: 'low', sectors: [], tickers: [], thread: 't', fromRadar: false };
    const r = DeepInterpretationSchema.safeParse({ signals: [sig, sig, sig, sig, sig] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.signals.length).toBe(3);
  });
});
