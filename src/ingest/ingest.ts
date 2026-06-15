import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { broadcastDay } from '@/db/schema';
import { fetchTranscript } from './sources';
import { storeTranscript } from './store';
import type { ParsedTranscript } from './types';

/** Inclusive list of 'YYYY-MM-DD' days. UTC to avoid DST drift. */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (d.getTime() <= last.getTime()) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function shouldSkip(existing: { status?: string } | undefined): boolean {
  return existing?.status === 'ingested';
}

export interface IngestDeps {
  getExisting: (date: string) => Promise<{ status?: string } | undefined>;
  fetch: (date: string) => Promise<ParsedTranscript>;
  store: (t: ParsedTranscript) => Promise<unknown>;
}

const DEFAULT_DEPS: IngestDeps = {
  getExisting: async (date) => {
    const rows = await getDb().select().from(broadcastDay).where(eq(broadcastDay.date, date)).limit(1);
    return rows[0];
  },
  fetch: (date) => fetchTranscript(date),
  store: (t) => storeTranscript(t),
};

export async function ingestDay(
  date: string,
  deps: IngestDeps = DEFAULT_DEPS,
): Promise<{ date: string; skipped: boolean }> {
  const existing = await deps.getExisting(date);
  if (shouldSkip(existing)) return { date, skipped: true };
  const t = await deps.fetch(date);
  await deps.store(t);
  return { date, skipped: false };
}
