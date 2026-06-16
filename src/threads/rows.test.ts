import { describe, it, expect } from 'vitest';
import { buildThreadRows } from './rows';
import type { ThreadSet } from './schema';

const set: ThreadSet = {
  threads: [
    { name: '科技', status: 'active', memberTerms: ['新质生产力', '科技自立'], read: 'r1' },
    { name: '内需', status: 'active', memberTerms: ['扩内需'], read: 'r2' },
  ],
};
const mentions = [
  { day: '2026-01-05', term: '新质生产力', count: 3 },
  { day: '2026-01-20', term: '科技自立', count: 2 },
  { day: '2026-02-05', term: '新质生产力', count: 4 },
  { day: '2026-01-05', term: '扩内需', count: 1 },
];

describe('buildThreadRows', () => {
  const r = buildThreadRows(set, mentions, ['#f00', '#0f0']);
  it('emits one thread row per thread with color + status + read in meta', () => {
    expect(r.threads).toHaveLength(2);
    expect(r.threads[0]).toMatchObject({ name: '科技', status: 'active', color: '#f00' });
    expect(r.threads[0].meta).toMatchObject({ memberTerms: ['新质生产力', '科技自立'], read: 'r1' });
  });
  it('computes thread_point monthly trajectories summing member-term mentions', () => {
    const tech = r.points.filter((p) => p.threadName === '科技');
    expect(tech).toContainEqual({ threadName: '科技', period: '2026-01', intensity: 5 });
    expect(tech).toContainEqual({ threadName: '科技', period: '2026-02', intensity: 4 });
  });
});
