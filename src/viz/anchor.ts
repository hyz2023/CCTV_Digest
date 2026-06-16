// River scrubber 锚点：当日页定位到当前所看日期；首页无 currentDate 时用 lastIdx。
export function anchorIndex(periods: string[], currentDate: string | undefined, lastIdx: number): number {
  if (!currentDate) return lastIdx;
  const i = periods.indexOf(currentDate);
  return i >= 0 ? i : lastIdx;
}
