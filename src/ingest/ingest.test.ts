import { describe, it, expect, vi } from 'vitest';
import { dateRange, shouldSkip, ingestDay } from './ingest';
import type { ParsedTranscript } from './types';

describe('dateRange', () => {
  it('produces inclusive YYYY-MM-DD days across month boundaries', () => {
    expect(dateRange('2026-01-30', '2026-02-02')).toEqual([
      '2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02',
    ]);
  });
  it('returns a single day when start === end', () => {
    expect(dateRange('2026-06-13', '2026-06-13')).toEqual(['2026-06-13']);
  });
});

describe('shouldSkip', () => {
  it('skips an already-ingested day', () => {
    expect(shouldSkip({ status: 'ingested' })).toBe(true);
  });
  it('does not skip when no row or failed status', () => {
    expect(shouldSkip(undefined)).toBe(false);
    expect(shouldSkip({ status: 'failed' })).toBe(false);
  });
});

describe('ingestDay', () => {
  const t: ParsedTranscript = { date: '2026-06-13', source: 'github', text: 'b', items: [] };
  it('skips when already ingested (no fetch/store)', async () => {
    const deps = {
      getExisting: vi.fn(async () => ({ status: 'ingested' })),
      fetch: vi.fn(async () => t),
      store: vi.fn(async () => ({})),
    };
    const r = await ingestDay('2026-06-13', deps);
    expect(r.skipped).toBe(true);
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(deps.store).not.toHaveBeenCalled();
  });
  it('fetches and stores when missing', async () => {
    const deps = {
      getExisting: vi.fn(async () => undefined),
      fetch: vi.fn(async () => t),
      store: vi.fn(async () => ({})),
    };
    const r = await ingestDay('2026-06-13', deps);
    expect(r.skipped).toBe(false);
    expect(deps.fetch).toHaveBeenCalledWith('2026-06-13');
    expect(deps.store).toHaveBeenCalledWith(t);
  });
});
