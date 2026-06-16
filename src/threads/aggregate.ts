export interface Mention { day: string; term: string; count: number }
export interface TermTrajectory { term: string; total: number; trajectory: { period: string; value: number }[] }
export interface ThreadInput { terms: TermTrajectory[]; recentThreadLabels: { label: string; count: number }[] }

const month = (d: string) => d.slice(0, 7);

export function buildThreadInput(mentions: Mention[], threadLabels: string[], opts: { topTerms?: number } = {}): ThreadInput {
  const topTerms = opts.topTerms ?? 40;
  const totals = new Map<string, number>();
  for (const m of mentions) totals.set(m.term, (totals.get(m.term) ?? 0) + m.count);
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, topTerms).map(([t]) => t);
  const terms: TermTrajectory[] = top.map((term) => {
    const byMonth = new Map<string, number>();
    for (const m of mentions) if (m.term === term) byMonth.set(month(m.day), (byMonth.get(month(m.day)) ?? 0) + m.count);
    const trajectory = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([period, value]) => ({ period, value }));
    return { term, total: totals.get(term)!, trajectory };
  });
  const labelCounts = new Map<string, number>();
  for (const l of threadLabels) if (l) labelCounts.set(l, (labelCounts.get(l) ?? 0) + 1);
  const recentThreadLabels = [...labelCounts.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
  return { terms, recentThreadLabels };
}
