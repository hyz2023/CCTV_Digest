import { SEGMENTS, type Extraction, type Segment } from './schema';

export interface ItemRow { day: string; ord: number; segment: string; title: string; summary: string; lengthProxy: number }
export interface TifaMentionRow { day: string; term: string; count: number }
export interface SectorSignalRow { day: string; sector: string; polarity: string; strength: number }
export type SegmentStats = Record<Segment, { count: number; share: number }>;

export interface ExtractionRows {
  items: ItemRow[];
  tifaTerms: string[];
  tifaMentions: TifaMentionRow[];
  sectorSignals: SectorSignalRow[];
  segmentStats: SegmentStats;
}

export function buildExtractionRows(day: string, ex: Extraction): ExtractionRows {
  const total = ex.items.length || 1;
  const counts = Object.fromEntries(SEGMENTS.map((s) => [s, 0])) as Record<Segment, number>;
  for (const it of ex.items) counts[it.segment]++;
  const segmentStats = Object.fromEntries(
    SEGMENTS.map((s) => [s, { count: counts[s], share: counts[s] / total }]),
  ) as SegmentStats;

  return {
    items: ex.items.map((it) => ({
      day, ord: it.ord, segment: it.segment, title: it.title, summary: it.summary,
      lengthProxy: it.summary.length,
    })),
    tifaTerms: ex.tifa.map((t) => t.term),
    tifaMentions: ex.tifa.map((t) => ({ day, term: t.term, count: t.count })),
    sectorSignals: ex.sectors.map((s) => ({ day, sector: s.sector, polarity: s.polarity, strength: s.strength })),
    segmentStats,
  };
}
