import { colorFor } from './palette';
import type { Mention, StreamSeries } from './series';

export const SMOOTH_WINDOW = 7;

// 居中滚动平均；window<=1 原样返回（副本）；边缘按可用范围收缩。
export function rollingMean(values: number[], window: number): number[] {
  if (window <= 1) return values.slice();
  const h = Math.floor(window / 2);
  return values.map((_, i) => {
    let sum = 0, cnt = 0;
    const lo = Math.max(0, i - h), hi = Math.min(values.length - 1, i + h);
    for (let j = lo; j <= hi; j++) { sum += values[j]; cnt++; }
    return cnt ? sum / cnt : 0;
  });
}

export interface TermGroup { name: string; color: string; terms: string[] }

// top-N 提法各作为一个单词组（无主线时的兜底）。
export function topTermGroups(mentions: Mention[], n: number): TermGroup[] {
  const totals = new Map<string, number>();
  for (const m of mentions) totals.set(m.term, (totals.get(m.term) ?? 0) + m.count);
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([term], i) => ({ name: term, color: colorFor(i), terms: [term] }));
}

// 由带标签的词组在日级 mentions 上聚合 → 平滑 → 日级 StreamSeries（periods 升序日期）。
export function buildDailyStreamSeries(
  mentions: Mention[], groups: TermGroup[], opts: { window?: number } = {},
): StreamSeries {
  const window = opts.window ?? SMOOTH_WINDOW;
  const days = [...new Set(mentions.map((m) => m.day))].sort();
  const dIndex = new Map(days.map((d, i) => [d, i]));
  const streams = groups.map((g) => {
    const set = new Set(g.terms);
    const raw = new Array<number>(days.length).fill(0);
    for (const m of mentions) if (set.has(m.term)) raw[dIndex.get(m.day)!] += m.count;
    return { term: g.name, color: g.color, values: rollingMean(raw, window) };
  });
  return { periods: days, streams };
}
