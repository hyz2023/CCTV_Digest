import { describe, it, expect, vi } from 'vitest';
import { persistThreads } from './persist';
import type { ThreadRows } from './rows';

const rows: ThreadRows = {
  threads: [{ name: '科技', status: 'active', color: '#f00', meta: { memberTerms: ['x'], read: 'r' } }],
  points: [{ threadName: '科技', period: '2026-01', intensity: 5 }],
  evidence: [{ threadName: '科技', day: '2026-01-05', itemId: 11 }],
};

describe('persistThreads', () => {
  it('clears, inserts threads, resolves points + evidence to ids (in order)', async () => {
    const calls: string[] = [];
    const deps = {
      clearAll: vi.fn(async () => { calls.push('clear'); }),
      insertThreads: vi.fn(async () => { calls.push('threads'); return new Map([['科技', 1]]); }),
      insertPoints: vi.fn(async () => { calls.push('points'); }),
      insertEvidence: vi.fn(async () => { calls.push('evidence'); }),
    };
    await persistThreads(rows, deps);
    expect(calls).toEqual(['clear', 'threads', 'points', 'evidence']);
    expect(deps.insertPoints).toHaveBeenCalledWith([{ threadId: 1, period: '2026-01', intensity: 5 }]);
    expect(deps.insertEvidence).toHaveBeenCalledWith([{ threadId: 1, day: '2026-01-05', itemId: 11 }]);
  });
});
