import { colorFor } from './palette';

const month = (day: string) => day.slice(0, 7);
function sortedMonths(days: string[]): string[] {
  return [...new Set(days.map(month))].sort();
}

export interface Mention { day: string; term: string; count: number }
export interface StreamSeries { periods: string[]; streams: { term: string; color: string; values: number[] }[] }

export function buildStreamSeries(mentions: Mention[], opts: { topN?: number } = {}): StreamSeries {
  const topN = opts.topN ?? 8;
  const totals = new Map<string, number>();
  for (const m of mentions) totals.set(m.term, (totals.get(m.term) ?? 0) + m.count);
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN).map(([t]) => t);
  const periods = sortedMonths(mentions.map((m) => m.day));
  const pIndex = new Map(periods.map((p, i) => [p, i]));
  const streams = top.map((term, i) => {
    const values = new Array(periods.length).fill(0);
    for (const m of mentions) {
      if (m.term !== term) continue;
      values[pIndex.get(month(m.day))!] += m.count;
    }
    return { term, color: colorFor(i), values };
  });
  return { periods, streams };
}

export interface CrossSection { period: string; entries: { term: string; value: number }[] }
export function buildCrossSection(mentions: Mention[], date: string, opts: { topN?: number } = {}): CrossSection {
  const period = month(date);
  const totals = new Map<string, number>();
  for (const m of mentions) {
    if (month(m.day) !== period) continue;
    totals.set(m.term, (totals.get(m.term) ?? 0) + m.count);
  }
  const entries = [...totals.entries()]
    .map(([term, value]) => ({ term, value }))
    .sort((a, b) => b.value - a.value || a.term.localeCompare(b.term))
    .slice(0, opts.topN ?? 8);
  return { period, entries };
}

export interface KeywordSeries { term: string; points: { period: string; value: number }[] }
export function buildKeywordSeries(mentions: Mention[], term: string): KeywordSeries {
  const periods = sortedMonths(mentions.filter((m) => m.term === term).map((m) => m.day));
  const map = new Map(periods.map((p) => [p, 0]));
  for (const m of mentions) if (m.term === term) map.set(month(m.day), (map.get(month(m.day)) ?? 0) + m.count);
  return { term, points: periods.map((p) => ({ period: p, value: map.get(p)! })) };
}

export interface SectorSig { day: string; sector: string; strength: number }
export interface SectorHeatmap { periods: string[]; sectors: string[]; rows: { sector: string; values: number[] }[] }
export function buildSectorHeatmap(sigs: SectorSig[]): SectorHeatmap {
  const periods = sortedMonths(sigs.map((s) => s.day));
  const pIndex = new Map(periods.map((p, i) => [p, i]));
  const sectors = [...new Set(sigs.map((s) => s.sector))].sort();
  const rows = sectors.map((sector) => {
    const values = new Array(periods.length).fill(0);
    for (const s of sigs) if (s.sector === sector) values[pIndex.get(month(s.day))!] += s.strength;
    return { sector, values };
  });
  return { periods, sectors, rows };
}
