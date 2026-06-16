import { describe, it, expect } from 'vitest';
import { buildThreadInput } from './aggregate';

const mentions = [
  { day: '2026-01-05', term: '新质生产力', count: 3 },
  { day: '2026-02-05', term: '新质生产力', count: 4 },
  { day: '2026-01-05', term: '科技自立', count: 2 },
  { day: '2026-01-05', term: '小词', count: 1 },
];

describe('buildThreadInput', () => {
  const input = buildThreadInput(mentions, ['科技', '科技'], { topTerms: 2 });
  it('keeps the top-N terms with their monthly trajectories', () => {
    expect(input.terms.map((t) => t.term).sort()).toEqual(['新质生产力', '科技自立']);
    const t = input.terms.find((x) => x.term === '新质生产力')!;
    expect(t.trajectory).toEqual([{ period: '2026-01', value: 3 }, { period: '2026-02', value: 4 }]);
  });
  it('passes through recent thread labels (deduped with counts)', () => {
    expect(input.recentThreadLabels).toContainEqual({ label: '科技', count: 2 });
  });
});
