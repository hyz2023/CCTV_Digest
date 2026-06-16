import { describe, it, expect, vi } from 'vitest';
import { fetchTranscript, validateTranscript } from './sources';
import type { ParsedTranscript } from './types';

const ok = (source: ParsedTranscript['source']): ParsedTranscript =>
  ({ date: '2026-06-13', source, text: 'x'.repeat(300), items: ['a', 'b', 'c'] });

describe('fetchTranscript fallback chain', () => {
  it('returns govopendata when it succeeds (no fallback)', async () => {
    const deps = {
      govopendata: vi.fn(async () => ok('govopendata')),
      tushare: vi.fn(async () => ok('tushare')),
      github: vi.fn(async () => ok('github')),
    };
    const t = await fetchTranscript('2026-06-13', deps);
    expect(t.source).toBe('govopendata');
    expect(deps.tushare).not.toHaveBeenCalled();
    expect(deps.github).not.toHaveBeenCalled();
  });

  it('falls back to tushare, then github, on failure', async () => {
    const deps = {
      govopendata: vi.fn(async () => { throw new Error('403'); }),
      tushare: vi.fn(async () => { throw new Error('no token'); }),
      github: vi.fn(async () => ok('github')),
    };
    const t = await fetchTranscript('2026-06-13', deps);
    expect(t.source).toBe('github');
    expect(deps.govopendata).toHaveBeenCalledOnce();
    expect(deps.tushare).toHaveBeenCalledOnce();
  });

  it('throws if all sources fail', async () => {
    const fail = vi.fn(async () => { throw new Error('x'); });
    await expect(fetchTranscript('2026-06-13', { govopendata: fail, tushare: fail, github: fail }))
      .rejects.toThrow(/all sources failed/i);
  });
});

describe('validateTranscript', () => {
  it('returns the transcript when text is substantial', () => {
    const t = ok('github');
    expect(validateTranscript(t)).toBe(t);
  });
  it('throws on a too-short (missing/error) page', () => {
    const t: ParsedTranscript = { date: '2026-06-13', source: 'govopendata', text: '对不起，无此页面', items: [] };
    expect(() => validateTranscript(t)).toThrow(/too short/);
  });
  it('throws on a site nav/placeholder stub (unaired day)', () => {
    // govopendata returns a nav stub before the broadcast airs
    const t: ParsedTranscript = {
      date: '2026-06-16', source: 'govopendata',
      text: '跳转到主要内容 首页 新闻联播 ' + 'x'.repeat(300), items: ['a', 'b', 'c'],
    };
    expect(() => validateTranscript(t)).toThrow(/stub|placeholder|nav/i);
  });
  it('throws when there are too few items (stub/error parse)', () => {
    const t: ParsedTranscript = { date: '2026-06-16', source: 'govopendata', text: 'y'.repeat(300), items: ['只有一条'] };
    expect(() => validateTranscript(t)).toThrow(/too few items/);
  });
});
