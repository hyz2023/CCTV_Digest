// The River's x-axis is monthly (YYYY-MM), but day pages are per-date. Map each
// period to a representative broadcast date — the latest day in that month that
// has data — so clicking the River navigates to a real 每日解读 page.
export function buildPeriodDateMap(dates: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const d of dates) {
    if (!d) continue;
    const period = d.slice(0, 7);
    if (!map[period] || d > map[period]) map[period] = d;
  }
  return map;
}
