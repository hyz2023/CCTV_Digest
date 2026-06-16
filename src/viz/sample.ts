import type { Mention, SectorSig } from '@/viz/series';

// Deterministic synthetic data — NO Math.random.
// 6 political/economic terms × 18 monthly buckets (2024-01 … 2025-06)
// Counts are generated from simple sinusoidal / linear formulas keyed on the
// month index (m) and term index (t) so the streamgraph looks alive.

const TERMS = [
  '新质生产力',
  '扩内需',
  '国家安全',
  '绿色双碳',
  '一带一路',
  '科技自立',
];

const SECTORS = ['科技', '能源', '军事', '经济'];

// 18 months: 2024-01-15 … 2025-06-15
const MONTHS: string[] = Array.from({ length: 18 }, (_, m) => {
  const year = 2024 + Math.floor(m / 12);
  const mo = String((m % 12) + 1).padStart(2, '0');
  return `${year}-${mo}-15`;
});

// Deterministic count formula:
//   base   = 8 + t * 3
//   wave1  = round(6 * sin(m * π/6 + t))       — seasonal cycle
//   wave2  = round(3 * sin(m * π/3 + t * 0.7)) — faster harmonic
//   trend  = floor(m * (t % 3 === 0 ? 0.4 : -0.2))
//   result = max(1, base + wave1 + wave2 + trend)
function synCount(m: number, t: number): number {
  const base = 8 + t * 3;
  const wave1 = Math.round(6 * Math.sin((m * Math.PI) / 6 + t));
  const wave2 = Math.round(3 * Math.sin((m * Math.PI) / 3 + t * 0.7));
  const trend = Math.floor(m * (t % 3 === 0 ? 0.4 : -0.2));
  return Math.max(1, base + wave1 + wave2 + trend);
}

export const SAMPLE_MENTIONS: Mention[] = MONTHS.flatMap((day, m) =>
  TERMS.map((term, t) => ({ day, term, count: synCount(m, t) })),
);

// Sector strength formula:
//   base   = 0.35 + s * 0.12
//   wave   = 0.25 * sin(m * π/9 + s * 1.1)
//   result = clamp(base + wave, 0, 1), rounded to 3 dp
function synStrength(m: number, s: number): number {
  const base = 0.35 + s * 0.12;
  const wave = 0.25 * Math.sin((m * Math.PI) / 9 + s * 1.1);
  return Math.round(Math.min(1, Math.max(0, base + wave)) * 1000) / 1000;
}

export const SAMPLE_SECTORS: SectorSig[] = MONTHS.flatMap((day, m) =>
  SECTORS.map((sector, s) => ({ day, sector, strength: synStrength(m, s) })),
);
