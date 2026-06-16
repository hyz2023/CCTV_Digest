import { describe, it, expect, vi } from 'vitest';
import { synthesizeAllThreads } from './run';
import type { ThreadSet } from './schema';

const set: ThreadSet = { threads: [{ name: '科技', status: 'active', memberTerms: ['x'], read: 'r' }] };

describe('synthesizeAllThreads', () => {
  it('aggregates → synthesizes → builds rows → persists', async () => {
    const deps = {
      loadMentions: vi.fn(async () => [{ day: '2026-01-01', term: 'x', count: 2 }]),
      loadThreadLabels: vi.fn(async () => ['科技']),
      synthesize: vi.fn(async () => set),
      persist: vi.fn(async () => {}),
    };
    const r = await synthesizeAllThreads(deps);
    expect(deps.synthesize).toHaveBeenCalledOnce();
    expect(deps.persist).toHaveBeenCalledOnce();
    expect(r.threadCount).toBe(1);
  });
  it('throws when there are no mentions to cluster', async () => {
    const deps = { loadMentions: vi.fn(async () => []), loadThreadLabels: vi.fn(async () => []), synthesize: vi.fn(), persist: vi.fn() };
    await expect(synthesizeAllThreads(deps)).rejects.toThrow(/no mentions|empty/i);
  });
});
