import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { item, tifa, tifaMention, sectorSignal, broadcastDay } from '@/db/schema';
import { buildExtractionRows, type ExtractionRows, type SegmentStats } from './rows';
import type { Extraction } from './schema';

export interface PersistDeps {
  insertItems: (rows: ExtractionRows['items']) => Promise<void>;
  upsertTifa: (day: string, terms: string[]) => Promise<void>;
  insertTifaMentions: (rows: ExtractionRows['tifaMentions']) => Promise<void>;
  insertSectorSignals: (rows: ExtractionRows['sectorSignals']) => Promise<void>;
  markExtracted: (day: string, stats: SegmentStats) => Promise<void>;
}

const DEFAULT_DEPS: PersistDeps = {
  insertItems: async (rows) => { if (rows.length) await getDb().insert(item).values(rows).onConflictDoNothing(); },
  upsertTifa: async (day, terms) => {
    if (!terms.length) return;
    await getDb().insert(tifa)
      .values(terms.map((term) => ({ term, firstSeen: day })))
      .onConflictDoUpdate({
        target: tifa.term,
        set: { firstSeen: sql`least(${tifa.firstSeen}, excluded.first_seen)` },
      });
  },
  insertTifaMentions: async (rows) => { if (rows.length) await getDb().insert(tifaMention).values(rows).onConflictDoNothing(); },
  insertSectorSignals: async (rows) => { if (rows.length) await getDb().insert(sectorSignal).values(rows).onConflictDoNothing(); },
  markExtracted: async (day, stats) => {
    await getDb().update(broadcastDay).set({ status: 'extracted', segmentStats: stats }).where(eq(broadcastDay.date, day));
  },
};

export async function persistExtraction(day: string, ex: Extraction, deps: PersistDeps = DEFAULT_DEPS): Promise<void> {
  const rows = buildExtractionRows(day, ex);
  await deps.upsertTifa(day, rows.tifaTerms);
  await deps.insertItems(rows.items);
  await deps.insertTifaMentions(rows.tifaMentions);
  await deps.insertSectorSignals(rows.sectorSignals);
  await deps.markExtracted(day, rows.segmentStats);
}
