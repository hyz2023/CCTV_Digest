import type { ThreadSet } from './schema';

export interface Mention { day: string; term: string; count: number }
export interface ThreadItem { id: number; day: string; title: string | null; summary: string | null }
export interface ThreadRow { name: string; status: string; color: string; meta: { memberTerms: string[]; read: string } }
export interface ThreadPointRow { threadName: string; period: string; intensity: number }
export interface EvidenceRow { threadName: string; day: string; itemId: number }
export interface ThreadRows { threads: ThreadRow[]; points: ThreadPointRow[]; evidence: EvidenceRow[] }

const month = (d: string) => d.slice(0, 7);

export function buildThreadRows(set: ThreadSet, mentions: Mention[], colors: string[], items: ThreadItem[] = []): ThreadRows {
  const threads: ThreadRow[] = set.threads.map((t, i) => ({
    name: t.name, status: t.status, color: colors[i % colors.length],
    meta: { memberTerms: t.memberTerms, read: t.read },
  }));
  const points: ThreadPointRow[] = [];
  const evidence: EvidenceRow[] = [];
  for (const t of set.threads) {
    const member = new Set(t.memberTerms);
    const byMonth = new Map<string, number>();
    for (const m of mentions) if (member.has(m.term)) byMonth.set(month(m.day), (byMonth.get(month(m.day)) ?? 0) + m.count);
    for (const [period, intensity] of [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      points.push({ threadName: t.name, period, intensity });
    }
    const seen = new Set<number>();
    for (const it of items) {
      if (seen.has(it.id)) continue;
      const text = (it.title ?? '') + (it.summary ?? '');
      if ([...member].some((term) => text.includes(term))) {
        evidence.push({ threadName: t.name, day: it.day, itemId: it.id });
        seen.add(it.id);
      }
    }
  }
  return { threads, points, evidence };
}
