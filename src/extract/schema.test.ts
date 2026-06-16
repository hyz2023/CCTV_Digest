import { describe, it, expect } from 'vitest';
import { ExtractionSchema } from './schema';

describe('ExtractionSchema — json_object drift tolerance', () => {
  it('accepts the canonical shape unchanged', () => {
    const r = ExtractionSchema.safeParse({
      items: [{ ord: 1, segment: 'leader', title: 't', summary: 's' }],
      tifa: [{ term: '新质生产力', count: 2 }],
      sectors: [{ sector: '半导体', polarity: 'bull', strength: 0.7 }],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.tifa[0].term).toBe('新质生产力');
      expect(r.data.sectors[0].sector).toBe('半导体');
    }
  });

  it('maps DeepSeek `name` alias onto term/sector', () => {
    const r = ExtractionSchema.safeParse({
      items: [{ ord: 1, segment: 'leader', title: 't', summary: 's' }],
      tifa: [{ name: '中朝传统友谊', count: 4 }],
      sectors: [{ name: '机电行业', polarity: 'bull', strength: 0.8 }],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.tifa[0].term).toBe('中朝传统友谊');
      expect(r.data.sectors[0].sector).toBe('机电行业');
    }
  });

  it('coerces numeric strings for ord / count / strength', () => {
    const r = ExtractionSchema.safeParse({
      items: [{ ord: '1', segment: 'dev', title: 't', summary: 's' }],
      tifa: [{ term: 'x', count: '3' }],
      sectors: [{ sector: 'y', polarity: 'neutral', strength: '0.5' }],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.items[0].ord).toBe(1);
      expect(r.data.tifa[0].count).toBe(3);
      expect(r.data.sectors[0].strength).toBe(0.5);
    }
  });

  it('still rejects a tifa entry with neither term nor name', () => {
    const r = ExtractionSchema.safeParse({
      items: [{ ord: 1, segment: 'leader', title: 't', summary: 's' }],
      tifa: [{ count: 1 }],
      sectors: [],
    });
    expect(r.success).toBe(false);
  });
});
