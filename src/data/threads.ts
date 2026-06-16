import { getDb } from '@/db/client';
import { thread, threadPoint } from '@/db/schema';
import type { StreamSeries } from '@/viz/series';
import type { TermGroup } from '@/viz/dailyStream';

export interface ThreadPointFull { threadName: string; color: string; period: string; intensity: number }

export function threadPointsToStreamSeries(points: ThreadPointFull[]): StreamSeries {
  const periods = [...new Set(points.map((p) => p.period))].sort();
  const pIndex = new Map(periods.map((p, i) => [p, i]));
  const byThread = new Map<string, { color: string; values: number[] }>();
  for (const p of points) {
    if (!byThread.has(p.threadName)) byThread.set(p.threadName, { color: p.color, values: new Array(periods.length).fill(0) });
    byThread.get(p.threadName)!.values[pIndex.get(p.period)!] += p.intensity;
  }
  return { periods, streams: [...byThread.entries()].map(([term, v]) => ({ term, color: v.color, values: v.values })) };
}

// Returns a StreamSeries from synthesized threads, or null if none exist (caller falls back to tifa streams).
export async function getThreadStreamSeries(): Promise<StreamSeries | null> {
  try {
    const threads = await getDb().select().from(thread);
    if (!threads.length) return null;
    const nameById = new Map(threads.map((t) => [t.id, t.name]));
    const colorByName = new Map(threads.map((t) => [t.name, t.color ?? '#888']));
    const pts = await getDb().select().from(threadPoint);
    if (!pts.length) return null;
    const full: ThreadPointFull[] = pts
      .filter((p) => nameById.has(p.threadId))
      .map((p) => ({ threadName: nameById.get(p.threadId)!, color: colorByName.get(nameById.get(p.threadId)!) ?? '#888', period: p.period, intensity: p.intensity }));
    return threadPointsToStreamSeries(full);
  } catch {
    return null;
  }
}

// 主线 → 词组（name/color/memberTerms），供首页日级聚合用。
export async function getThreads(): Promise<TermGroup[]> {
  try {
    const rows = await getDb().select({ name: thread.name, color: thread.color, meta: thread.meta }).from(thread);
    return rows
      .map((r) => ({
        name: r.name,
        color: r.color ?? '#888',
        terms: (r.meta as { memberTerms?: string[] } | null)?.memberTerms ?? [],
      }))
      .filter((g) => g.terms.length > 0);
  } catch {
    return [];
  }
}
