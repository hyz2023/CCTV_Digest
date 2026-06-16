import { getDb } from '@/db/client';
import { tifaMention, sectorSignal, item } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { SAMPLE_MENTIONS, SAMPLE_SECTORS } from '@/viz/sample';
import type { Mention, SectorSig } from '@/viz/series';

export function mentionsOrSample(rows: Mention[]): Mention[] {
  return rows.length ? rows : SAMPLE_MENTIONS;
}
export function sectorsOrSample(rows: SectorSig[]): SectorSig[] {
  return rows.length ? rows : SAMPLE_SECTORS;
}

export async function getMentions(): Promise<Mention[]> {
  try {
    const rows = await getDb().select({ day: tifaMention.day, term: tifaMention.term, count: tifaMention.count }).from(tifaMention);
    return mentionsOrSample(rows as Mention[]);
  } catch {
    return SAMPLE_MENTIONS;
  }
}
export async function getSectorSignals(): Promise<SectorSig[]> {
  try {
    const rows = await getDb().select({ day: sectorSignal.day, sector: sectorSignal.sector, strength: sectorSignal.strength }).from(sectorSignal);
    return sectorsOrSample(rows as SectorSig[]);
  } catch {
    return SAMPLE_SECTORS;
  }
}
export interface DayItem { ord: number; segment: string; title: string | null; summary: string | null }
export async function getItemsForDay(date: string): Promise<DayItem[]> {
  try {
    return await getDb().select({ ord: item.ord, segment: item.segment, title: item.title, summary: item.summary })
      .from(item).where(eq(item.day, date)).orderBy(item.ord) as DayItem[];
  } catch {
    return [];
  }
}
