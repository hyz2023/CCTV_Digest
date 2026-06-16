export interface Usage { inputTokens: number; outputTokens: number }

// 美元 / 每百万 token（in / out）。落地前以各官方为准。
const PRICE_PER_M: Record<string, { in: number; out: number }> = {
  'deepseek-v4-pro': { in: 0.435, out: 0.87 },
  'deepseek-v4-flash': { in: 0.09, out: 0.18 },
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-fable-5': { in: 10, out: 50 },
};

export function estimateCostUsd(model: string, u: Usage): number | null {
  const p = PRICE_PER_M[model];
  if (!p) return null;
  return +((u.inputTokens / 1e6) * p.in + (u.outputTokens / 1e6) * p.out).toFixed(8);
}
