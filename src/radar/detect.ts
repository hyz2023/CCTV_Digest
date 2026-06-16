export type RadarType = 'new_tifa' | 'drumbeat_up' | 'drumbeat_down' | 'order_jump' | 'flip';
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

export interface ItemPos { day: string; ord: number; title: string; summary: string }
export interface SectorSig { day: string; sector: string; polarity: string }

function positionOf(term: string, items: ItemPos[], day: string): number | undefined {
  const ords = items.filter((i) => i.day === day && (i.title + i.summary).includes(term)).map((i) => i.ord);
  return ords.length ? Math.min(...ords) : undefined;
}

export interface OrderJumpOpts { baselineDays?: number; minJump?: number; minSamples?: number }
export function detectOrderJumps(target: string, items: ItemPos[], mentions: Mention[], opts: OrderJumpOpts = {}): RadarEvent[] {
  const baselineDays = opts.baselineDays ?? 90;
  const minJump = opts.minJump ?? 3;
  const minSamples = opts.minSamples ?? 2;
  const terms = [...new Set(mentions.filter((m) => m.day === target).map((m) => m.term))];
  const events: RadarEvent[] = [];
  for (const term of terms) {
    const posToday = positionOf(term, items, target);
    if (posToday === undefined) continue;
    const past: number[] = [];
    for (const day of [...new Set(items.map((i) => i.day))]) {
      if (day === target) continue;
      const diff = dayDiff(target, day);
      if (diff <= 0 || diff > baselineDays) continue;
      const p = positionOf(term, items, day);
      if (p !== undefined) past.push(p);
    }
    if (past.length < minSamples) continue;
    const avg = past.reduce((a, b) => a + b, 0) / past.length;
    if (avg - posToday >= minJump) {
      events.push({ day: target, type: 'order_jump', target: term, magnitude: +(avg - posToday).toFixed(2), detail: { posToday, avgPast: +avg.toFixed(2) } });
    }
  }
  return events;
}

export interface FlipOpts { recentDays?: number; baselineDays?: number }
function dominantPolarity(sigs: SectorSig[]): 'bull' | 'bear' | null {
  let bull = 0, bear = 0;
  for (const s of sigs) { if (s.polarity === 'bull') bull++; else if (s.polarity === 'bear') bear++; }
  if (bull === 0 && bear === 0) return null;
  return bull >= bear ? 'bull' : 'bear';
}
export function detectSectorFlips(target: string, sectorSignals: SectorSig[], opts: FlipOpts = {}): RadarEvent[] {
  const recentDays = opts.recentDays ?? 21;
  const baselineDays = opts.baselineDays ?? 90;
  const sectors = [...new Set(sectorSignals.map((s) => s.sector))];
  const events: RadarEvent[] = [];
  for (const sector of sectors) {
    const recent: SectorSig[] = [], base: SectorSig[] = [];
    for (const s of sectorSignals) {
      if (s.sector !== sector) continue;
      const d = dayDiff(target, s.day);
      if (d < 0) continue;
      if (d < recentDays) recent.push(s);
      else if (d < recentDays + baselineDays) base.push(s);
    }
    const r = dominantPolarity(recent), b = dominantPolarity(base);
    if (r && b && r !== b) {
      events.push({ day: target, type: 'flip', target: sector, magnitude: 1, detail: { from: b, to: r } });
    }
  }
  return events;
}

export interface AllRadarInput { target: string; mentions: Mention[]; items: ItemPos[]; sectorSignals: SectorSig[] }
export function detectAllRadar(input: AllRadarInput): RadarEvent[] {
  return [
    ...detectRadar(input.target, input.mentions),
    ...detectOrderJumps(input.target, input.items, input.mentions),
    ...detectSectorFlips(input.target, input.sectorSignals),
  ];
}
