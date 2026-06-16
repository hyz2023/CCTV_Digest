import { describe, it, expect } from 'vitest';
import { buildThreadPrompt } from './prompt';

const input = {
  terms: [{ term: '新质生产力', total: 30, trajectory: [{ period: '2025-01', value: 5 }] }],
  recentThreadLabels: [{ label: '科技', count: 4 }],
};

describe('buildThreadPrompt', () => {
  const p = buildThreadPrompt(input);
  it('includes the term trajectories and labels', () => {
    expect(p).toContain('新质生产力');
    expect(p).toContain('科技');
  });
  it('instructs emergent, anti-overfit clustering', () => {
    expect(p).toMatch(/主线/);
    expect(p).toMatch(/数量.*数据|不预设|宁缺毋滥|不要凑/);
    expect(p).toMatch(/持续|跨.*月|多月/);
  });
});
