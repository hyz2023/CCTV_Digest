import { describe, it, expect } from 'vitest';
import { buildInterpretationPrompt } from './prompt';

const input = {
  date: '2026-06-13',
  items: [{ ord: 1, segment: 'leader', title: '头条X', summary: '摘要X' }],
  radar: [{ type: 'new_tifa', target: '人工智能+', magnitude: 3 }],
};

describe('buildInterpretationPrompt', () => {
  const p = buildInterpretationPrompt(input);
  it('includes the date, items, and radar context', () => {
    expect(p).toContain('2026-06-13');
    expect(p).toContain('头条X');
    expect(p).toContain('人工智能+');
  });
  it('instructs the three-layer read with confidence and from-radar linkage', () => {
    expect(p).toMatch(/政策主题/);
    expect(p).toMatch(/行业|板块/);
    expect(p).toMatch(/标的/);
    expect(p).toMatch(/置信|confidence/i);
    expect(p).toMatch(/最多.?3|三个|Top-?3/);
  });
  it('frames it as signal-reading (propaganda), with epistemic humility', () => {
    expect(p).toMatch(/信号|编排|宣传/);
    expect(p).toMatch(/不等于|谨慎|置信|不臆造/);
  });
});
