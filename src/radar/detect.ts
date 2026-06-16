export type RadarType = 'new_tifa' | 'drumbeat_up' | 'drumbeat_down';
export interface RadarEvent { day: string; type: RadarType; target: string; magnitude: number; detail?: Record<string, unknown> }
export interface Mention { day: string; term: string; count: number }
export interface RadarOpts { recentDays?: number; baselineDays?: number; riseFactor?: number; minRecent?: number; baselineHot?: number }

const MS = 86_400_000;
function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / MS);
}

export function detectRadar(target: string, mentions: Mention[], opts: RadarOpts = {}): RadarEvent[] {
  const recentDays = opts.recentDays ?? 14;
  const baselineDays = opts.baselineDays ?? 90;
  const riseFactor = opts.riseFactor ?? 2;
  const minRecent = opts.minRecent ?? 3;
  const baselineHot = opts.baselineHot ?? 10;

  const terms = [...new Set(mentions.map((m) => m.term))];
  const events: RadarEvent[] = [];

  for (const term of terms) {
    const ms = mentions.filter((m) => m.term === term);
    let recent = 0, baseline = 0, before = 0;
    for (const m of ms) {
      const d = dayDiff(target, m.day);
      if (d < 0) continue;
      if (d < recentDays) recent += m.count;
      else if (d < recentDays + baselineDays) baseline += m.count;
      if (d >= recentDays) before += m.count;
    }
    if (recent > 0 && before === 0) {
      events.push({ day: target, type: 'new_tifa', target: term, magnitude: recent });
      continue;
    }
    const expectedRecent = (baseline / baselineDays) * recentDays;
    if (recent >= minRecent && recent >= riseFactor * Math.max(expectedRecent, 1)) {
      events.push({ day: target, type: 'drumbeat_up', target: term, magnitude: +(recent / Math.max(expectedRecent, 1)).toFixed(2), detail: { recent, baseline } });
    } else if (baseline >= baselineHot && recent === 0) {
      events.push({ day: target, type: 'drumbeat_down', target: term, magnitude: baseline, detail: { recent, baseline } });
    }
  }
  return events;
}
