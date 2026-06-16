import { put } from '@vercel/blob';
import { getDb } from '@/db/client';
import { broadcastDay } from '@/db/schema';
import type { ParsedTranscript } from './types';

export interface BroadcastDayRow {
  date: string;
  blobUrl: string;
  source: string;
  segmentStats: { itemCount: number };
  status: string;
}

export function buildBroadcastDayRow(t: ParsedTranscript, blobUrl: string): BroadcastDayRow {
  return { date: t.date, blobUrl, source: t.source, segmentStats: { itemCount: t.items.length }, status: 'ingested' };
}

export interface StoreDeps {
  putBlob: (key: string, body: string) => Promise<{ url: string }>;
  upsertDay: (row: BroadcastDayRow) => Promise<void>;
}

const DEFAULT_DEPS: StoreDeps = {
  putBlob: async (key, body) => {
    // Private store: transcripts are not public assets; read back via authenticated
    // fetch in extract (loadText) using BLOB_READ_WRITE_TOKEN. allowOverwrite so
    // re-ingesting a day replaces its blob instead of throwing on the same pathname.
    const r = await put(key, body, {
      access: 'private',
      contentType: 'text/plain; charset=utf-8',
      allowOverwrite: true,
    });
    return { url: r.url };
  },
  upsertDay: async (row) => {
    await getDb().insert(broadcastDay).values(row).onConflictDoUpdate({
      target: broadcastDay.date,
      set: { blobUrl: row.blobUrl, source: row.source, segmentStats: row.segmentStats, status: row.status },
    });
  },
};

export async function storeTranscript(t: ParsedTranscript, deps: StoreDeps = DEFAULT_DEPS): Promise<BroadcastDayRow> {
  const { url } = await deps.putBlob(`xwlb/${t.date}.txt`, t.text);
  const row = buildBroadcastDayRow(t, url);
  await deps.upsertDay(row);
  return row;
}
