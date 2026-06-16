import { describe, it, expect, vi } from 'vitest';
import { extractDay, shouldSkipExtraction } from './run';
import type { Extraction } from './schema';

const ex: Extraction = { items: [{ ord: 1, segment: 'leader', title: 't', summary: 's' }], tifa: [], sectors: [] };

describe('shouldSkipExtraction', () => {
  it('skips when already extracted', () => {
    expect(shouldSkipExtraction({ status: 'extracted', blobUrl: 'x' })).toBe(true);
  });
  it('does not skip ingested-only', () => {
    expect(shouldSkipExtraction({ status: 'ingested', blobUrl: 'x' })).toBe(false);
  });
});

describe('extractDay', () => {
  it('skips when already extracted', async () => {
    const deps = { getDay: vi.fn(async () => ({ status: 'extracted', blobUrl: 'x' })), loadText: vi.fn(), extract: vi.fn(), persist: vi.fn() };
    const r = await extractDay('2026-06-13', deps);
    expect(r.skipped).toBe(true);
    expect(deps.extract).not.toHaveBeenCalled();
  });
  it('loads text, extracts, persists when ingested', async () => {
    const deps = {
      getDay: vi.fn(async () => ({ status: 'ingested', blobUrl: 'https://blob/x.txt' })),
      loadText: vi.fn(async () => '正文'),
      extract: vi.fn(async () => ex),
      persist: vi.fn(async () => {}),
    };
    const r = await extractDay('2026-06-13', deps);
    expect(r.skipped).toBe(false);
    expect(deps.loadText).toHaveBeenCalledWith('https://blob/x.txt');
    expect(deps.extract).toHaveBeenCalledWith('正文');
    expect(deps.persist).toHaveBeenCalledWith('2026-06-13', ex);
  });
  it('throws if the day was never ingested', async () => {
    const deps = { getDay: vi.fn(async () => undefined), loadText: vi.fn(), extract: vi.fn(), persist: vi.fn() };
    await expect(extractDay('2026-06-13', deps)).rejects.toThrow(/not ingested/i);
  });
  it('skips an extracted day even when blobUrl is null', async () => {
    const deps = { getDay: vi.fn(async () => ({ status: 'extracted', blobUrl: null })), loadText: vi.fn(), extract: vi.fn(), persist: vi.fn() };
    const r = await extractDay('2026-06-13', deps);
    expect(r.skipped).toBe(true);
    expect(deps.extract).not.toHaveBeenCalled();
  });
});
