import { describe, it, expect, vi } from 'vitest';
import { buildBroadcastDayRow, storeTranscript } from './store';
import type { ParsedTranscript } from './types';

const t: ParsedTranscript = { date: '2026-06-13', source: 'github', text: 'full body', items: ['a', 'b'] };

describe('buildBroadcastDayRow', () => {
  it('maps a transcript + blob url to a broadcast_day row', () => {
    const row = buildBroadcastDayRow(t, 'https://blob/xwlb/2026-06-13.txt');
    expect(row).toMatchObject({
      date: '2026-06-13', source: 'github', blobUrl: 'https://blob/xwlb/2026-06-13.txt', status: 'ingested',
    });
    expect(row.segmentStats).toMatchObject({ itemCount: 2 });
  });
});

describe('storeTranscript', () => {
  it('puts text to blob then upserts the row, returning the row', async () => {
    const putBlob = vi.fn(async () => ({ url: 'https://blob/x.txt' }));
    const upsertDay = vi.fn(async () => {});
    const row = await storeTranscript(t, { putBlob, upsertDay });
    expect(putBlob).toHaveBeenCalledOnce();
    expect(upsertDay).toHaveBeenCalledWith(expect.objectContaining({ blobUrl: 'https://blob/x.txt', date: '2026-06-13' }));
    expect(row.blobUrl).toBe('https://blob/x.txt');
  });
});
