import { getDb } from '@/db/client';
import { tifaMention, sectorSignal, item, dailyInterpretation, radarEvent } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
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

// 每日解读的 Top-3 信号（三层读）。topSignals 由 analyze 阶段写入。
export interface SignalSector { sector: string; polarity: string }
export interface Signal {
  title: string;
  theme: string;
  thread: string;
  sectors: SignalSector[];
  tickers: string[];
  fromRadar: boolean;
  confidence: string;
}
export async function getInterpretation(date: string): Promise<Signal[]> {
  try {
    const rows = await getDb().select({ ts: dailyInterpretation.topSignals })
      .from(dailyInterpretation).where(eq(dailyInterpretation.day, date)).limit(1);
    const ts = rows[0]?.ts as Signal[] | undefined;
    return Array.isArray(ts) ? ts : [];
  } catch {
    return [];
  }
}

// 当日雷达事件，按强度降序、限量（避免冷启动期 new_tifa 噪声铺满）。
export interface RadarView { type: string; target: string; magnitude: number | null }
export async function getRadar(date: string, limit = 12): Promise<RadarView[]> {
  try {
    return await getDb().select({ type: radarEvent.type, target: radarEvent.target, magnitude: radarEvent.magnitude })
      .from(radarEvent).where(eq(radarEvent.day, date)).orderBy(desc(radarEvent.magnitude)).limit(limit) as RadarView[];
  } catch {
    return [];
  }
}
