import { describe, it, expect, vi } from 'vitest';
import { synthesizeThreads } from './synthesize';
import type { ThreadSet } from './schema';

const canned: ThreadSet = { threads: [{ name: '科技', status: 'active', memberTerms: ['新质生产力'], read: 'r' }] };

describe('synthesizeThreads', () => {
  it('returns the model ThreadSet via injected generate', async () => {
    const generate = vi.fn(async () => canned);
    const out = await synthesizeThreads({ terms: [{ term: '新质生产力', total: 1, trajectory: [] }], recentThreadLabels: [] }, { generate });
    expect(out).toEqual(canned);
  });
  it('throws when there are no terms', async () => {
    const generate = vi.fn(async () => canned);
    await expect(synthesizeThreads({ terms: [], recentThreadLabels: [] }, { generate })).rejects.toThrow(/no terms|empty/i);
    expect(generate).not.toHaveBeenCalled();
  });
});
