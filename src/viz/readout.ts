export const TREND_LOOKBACK = 14;
export const TREND_DEADBAND = 0.15;
export const LEVEL_STRONG = 0.66;
export const LEVEL_MID = 0.33;

export type Level = '强' | '中' | '弱';
export type Trend = 'up' | 'flat' | 'down';

// 档位：相对当天最强主线。dayMax<=0 时一律弱（防除零）。
// 用四舍五入到小数点后2位避免浮点精度问题（如 6.6/10 = 0.6599...）。
export function levelOf(value: number, dayMax: number): Level {
  const ratio = dayMax > 0 ? Math.round((value / dayMax) * 100) / 100 : 0;
  if (ratio >= LEVEL_STRONG) return '强';
  if (ratio >= LEVEL_MID) return '中';
  return '弱';
}

// 趋势：今天平滑值 vs ~lookback 天前；|Δ| < deadband×dayMax 记为持平。
// 历史不足则与最早值比较；越界取 0。
export function trendOf(
  values: number[], idx: number,
  opts: { lookback?: number; deadband?: number; dayMax: number },
): Trend {
  const lookback = opts.lookback ?? TREND_LOOKBACK;
  const deadband = opts.deadband ?? TREND_DEADBAND;
  const past = values[Math.max(0, idx - lookback)] ?? 0;
  const delta = (values[idx] ?? 0) - past;
  if (Math.abs(delta) < deadband * opts.dayMax) return 'flat';
  return delta > 0 ? 'up' : 'down';
}
