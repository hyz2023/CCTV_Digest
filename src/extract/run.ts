import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { broadcastDay } from '@/db/schema';
import { extractTranscript } from './extract';
import { persistExtraction } from './persist';
import type { Extraction } from './schema';

export function shouldSkipExtraction(day: { status?: string; blobUrl?: string | null } | undefined): boolean {
  return day?.status === 'extracted';
}

export interface ExtractRunDeps {
  getDay: (date: string) => Promise<{ status?: string; blobUrl?: string | null } | undefined>;
  loadText: (blobUrl: string) => Promise<string>;
  extract: (text: string) => Promise<Extraction>;
  persist: (date: string, ex: Extraction) => Promise<void>;
}

const DEFAULT_DEPS: ExtractRunDeps = {
  getDay: async (date) => {
    const rows = await getDb().select().from(broadcastDay).where(eq(broadcastDay.date, date)).limit(1);
    return rows[0];
  },
  loadText: async (blobUrl) => {
    // Private blob store: reads require the read-write token as a Bearer header.
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const res = await fetch(blobUrl, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
    if (!res.ok) throw new Error(`failed to load transcript blob: HTTP ${res.status}`);
    return res.text();
  },
  extract: (text) => extractTranscript(text),
  persist: (date, ex) => persistExtraction(date, ex),
};

export async function extractDay(date: string, deps: ExtractRunDeps = DEFAULT_DEPS): Promise<{ date: string; skipped: boolean }> {
  const day = await deps.getDay(date);
  if (!day) throw new Error(`day ${date} is not ingested (no transcript)`);
  if (shouldSkipExtraction(day)) return { date, skipped: true };
  if (!day.blobUrl) throw new Error(`day ${date} has no transcript blob`);
  const text = await deps.loadText(day.blobUrl);
  const ex = await deps.extract(text);
  await deps.persist(date, ex);
  return { date, skipped: false };
}
