# CCTV_Digest — P3 UI (River homepage + Explore) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.

**Goal:** A full-screen **River** streamgraph homepage built from real 提法 time-series, with a hover scrubber + cross-section readout and a click→animated transition into a **每日解读 (Editorial)** day page; plus an **Explore** page (keyword time-series + sector drumbeat heatmap). Visual language ported from the approved brainstorm prototypes (dark cinematic River skeleton + 大字编辑刊 reading pages).

**Architecture:** Pure data transforms (`src/viz/`) turn DB rows (`tifa_mention`, `sector_signal`, `item`, `broadcast_day`) into stream series / cross-sections / heatmap matrices — fully unit-tested. A pure `computeStreamPaths` produces the streamgraph SVG geometry (ported from the prototype's stacked-smoothed-area math) — unit-tested. React components (`src/components/`) render from props. App Router pages (`/`, `/day/[date]`, `/explore`) load data via a thin DB layer (server components) with a **sample-data fallback** so the app renders before the live pipeline runs. Until P5 produces named threads, River streams = top-N 提法 by frequency over time.

**Tech Stack:** Next.js 16 App Router (server + client components), TypeScript, SVG (no chart lib), Vitest. Builds on P0-P2 (`@/db`, `tifa_mention`/`sector_signal`/`item`/`broadcast_day`).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/viz/series.ts` / `.test.ts` | pure transforms: rows → stream series / cross-section / keyword series / sector heatmap |
| `src/viz/stream.ts` / `.test.ts` | pure `computeStreamPaths(streams, dims)` → stacked smoothed SVG path geometry |
| `src/viz/palette.ts` | stable color palette + theme tokens (River + Editorial) |
| `src/viz/sample.ts` | synthetic sample series/cross-section (dev + empty-DB fallback) |
| `src/data/queries.ts` | DB query fns (server-only) → feed the transforms; fall back to sample when empty |
| `src/components/RiverChart.tsx` | client SVG streamgraph + hover scrubber + cross-section readout |
| `src/components/DailyRead.tsx` | editorial day view (cross-section strip + items) |
| `src/components/Explore.tsx` | keyword time-series + sector heatmap (infographic) |
| `src/app/page.tsx` | full-screen River homepage (loads series; renders RiverChart) |
| `src/app/day/[date]/page.tsx` | daily-read page |
| `src/app/explore/page.tsx` | explore page |
| `src/app/globals.css` | River/Editorial theme (dark, editorial type) |

---

## Task 1: Data transforms (pure)

**Files:** Create `src/viz/series.ts`, `src/viz/palette.ts`; Test `src/viz/series.test.ts`.

- [ ] **Step 1: Write `src/viz/palette.ts`:**
```typescript
// Stable, deterministic colors for streams (assigned by sorted key order).
export const STREAM_COLORS = [
  '#ff8a3d', '#2bb6c8', '#e0436b', '#8a7bff', '#38c172', '#ff6fae',
  '#ffce7a', '#7be3f0', '#ff8fa8', '#c3b8ff',
];
export function colorFor(index: number): string {
  return STREAM_COLORS[index % STREAM_COLORS.length];
}
```

- [ ] **Step 2: Write the failing test** — `src/viz/series.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { buildStreamSeries, buildCrossSection, buildKeywordSeries, buildSectorHeatmap } from './series';

const mentions = [
  { day: '2026-01-05', term: 'A', count: 3 },
  { day: '2026-01-20', term: 'A', count: 2 },
  { day: '2026-02-10', term: 'A', count: 4 },
  { day: '2026-01-15', term: 'B', count: 1 },
  { day: '2026-02-02', term: 'B', count: 5 },
  { day: '2026-01-09', term: 'C', count: 1 },
];

describe('buildStreamSeries', () => {
  const s = buildStreamSeries(mentions, { topN: 2 });
  it('keeps only the top-N terms by total count', () => {
    expect(s.streams.map((x) => x.term).sort()).toEqual(['A', 'B']);
  });
  it('buckets by month into aligned period columns', () => {
    expect(s.periods).toEqual(['2026-01', '2026-02']);
    const a = s.streams.find((x) => x.term === 'A')!;
    expect(a.values).toEqual([5, 4]); // Jan: 3+2, Feb: 4
    const b = s.streams.find((x) => x.term === 'B')!;
    expect(b.values).toEqual([1, 5]);
  });
  it('assigns a stable color per stream', () => {
    expect(s.streams[0].color).toMatch(/^#/);
  });
});

describe('buildCrossSection', () => {
  it('returns per-term intensity for the period containing a date, sorted desc', () => {
    const xs = buildCrossSection(mentions, '2026-02-15', { topN: 3 });
    expect(xs.period).toBe('2026-02');
    expect(xs.entries[0]).toMatchObject({ term: 'B', value: 5 }); // Feb: B=5 > A=4
    expect(xs.entries[1]).toMatchObject({ term: 'A', value: 4 });
  });
});

describe('buildKeywordSeries', () => {
  it('returns a single term monthly series', () => {
    const k = buildKeywordSeries(mentions, 'A');
    expect(k.term).toBe('A');
    expect(k.points).toEqual([{ period: '2026-01', value: 5 }, { period: '2026-02', value: 4 }]);
  });
});

describe('buildSectorHeatmap', () => {
  it('pivots sector signals into a sector x period matrix of summed strength', () => {
    const h = buildSectorHeatmap([
      { day: '2026-01-03', sector: '半导体', strength: 0.5 },
      { day: '2026-01-30', sector: '半导体', strength: 0.5 },
      { day: '2026-02-01', sector: '消费', strength: 0.9 },
    ]);
    expect(h.periods).toEqual(['2026-01', '2026-02']);
    expect(h.sectors).toEqual(expect.arrayContaining(['半导体', '消费']));
    const semi = h.rows.find((r) => r.sector === '半导体')!;
    expect(semi.values).toEqual([1.0, 0]); // Jan summed 1.0, Feb 0
  });
});
```

- [ ] **Step 3: Run — FAIL.** `npm test src/viz/series.test.ts`

- [ ] **Step 4: Implement `src/viz/series.ts`.** All pure. Month bucket = `day.slice(0,7)`. Periods = sorted unique months across the input (so streams align). Top-N by total count.
```typescript
import { colorFor } from './palette';

const month = (day: string) => day.slice(0, 7);
function sortedMonths(days: string[]): string[] {
  return [...new Set(days.map(month))].sort();
}

export interface Mention { day: string; term: string; count: number }
export interface StreamSeries { periods: string[]; streams: { term: string; color: string; values: number[] }[] }

export function buildStreamSeries(mentions: Mention[], opts: { topN?: number } = {}): StreamSeries {
  const topN = opts.topN ?? 8;
  const totals = new Map<string, number>();
  for (const m of mentions) totals.set(m.term, (totals.get(m.term) ?? 0) + m.count);
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN).map(([t]) => t);
  const periods = sortedMonths(mentions.map((m) => m.day));
  const pIndex = new Map(periods.map((p, i) => [p, i]));
  const streams = top.map((term, i) => {
    const values = new Array(periods.length).fill(0);
    for (const m of mentions) {
      if (m.term !== term) continue;
      values[pIndex.get(month(m.day))!] += m.count;
    }
    return { term, color: colorFor(i), values };
  });
  return { periods, streams };
}

export interface CrossSection { period: string; entries: { term: string; value: number }[] }
export function buildCrossSection(mentions: Mention[], date: string, opts: { topN?: number } = {}): CrossSection {
  const period = month(date);
  const totals = new Map<string, number>();
  for (const m of mentions) {
    if (month(m.day) !== period) continue;
    totals.set(m.term, (totals.get(m.term) ?? 0) + m.count);
  }
  const entries = [...totals.entries()]
    .map(([term, value]) => ({ term, value }))
    .sort((a, b) => b.value - a.value || a.term.localeCompare(b.term))
    .slice(0, opts.topN ?? 8);
  return { period, entries };
}

export interface KeywordSeries { term: string; points: { period: string; value: number }[] }
export function buildKeywordSeries(mentions: Mention[], term: string): KeywordSeries {
  const periods = sortedMonths(mentions.filter((m) => m.term === term).map((m) => m.day));
  const map = new Map(periods.map((p) => [p, 0]));
  for (const m of mentions) if (m.term === term) map.set(month(m.day), (map.get(month(m.day)) ?? 0) + m.count);
  return { term, points: periods.map((p) => ({ period: p, value: map.get(p)! })) };
}

export interface SectorSig { day: string; sector: string; strength: number }
export interface SectorHeatmap { periods: string[]; sectors: string[]; rows: { sector: string; values: number[] }[] }
export function buildSectorHeatmap(sigs: SectorSig[]): SectorHeatmap {
  const periods = sortedMonths(sigs.map((s) => s.day));
  const pIndex = new Map(periods.map((p, i) => [p, i]));
  const sectors = [...new Set(sigs.map((s) => s.sector))].sort();
  const rows = sectors.map((sector) => {
    const values = new Array(periods.length).fill(0);
    for (const s of sigs) if (s.sector === sector) values[pIndex.get(month(s.day))!] += s.strength;
    return { sector, values };
  });
  return { periods, sectors, rows };
}
```

- [ ] **Step 5: Run — PASS.** Then `npm test` + `npx tsc --noEmit`.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(viz): pure data transforms (stream series, cross-section, heatmap)"`

---

## Task 2: Streamgraph geometry + RiverChart component

**Files:** Create `src/viz/stream.ts`, `src/viz/sample.ts`, `src/components/RiverChart.tsx`; Test `src/viz/stream.test.ts`.

- [ ] **Step 1: Write the failing test** — `src/viz/stream.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { computeStreamPaths } from './stream';

const streams = [
  { term: 'A', color: '#f00', values: [1, 2, 3] },
  { term: 'B', color: '#0f0', values: [3, 2, 1] },
];

describe('computeStreamPaths', () => {
  const paths = computeStreamPaths(streams, { width: 600, height: 200 });
  it('returns one closed path per stream', () => {
    expect(paths).toHaveLength(2);
    for (const p of paths) {
      expect(p.term).toBeDefined();
      expect(p.d).toMatch(/^M /);
      expect(p.d.trim().endsWith('Z')).toBe(true);
      expect(p.color).toBeDefined();
    }
  });
  it('handles a single period without NaN', () => {
    const one = computeStreamPaths([{ term: 'X', color: '#00f', values: [5] }], { width: 100, height: 100 });
    expect(one[0].d).not.toMatch(/NaN/);
  });
  it('handles empty streams gracefully', () => {
    expect(computeStreamPaths([], { width: 100, height: 100 })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — FAIL.** `npm test src/viz/stream.test.ts`

- [ ] **Step 3: Implement `src/viz/stream.ts`** — stacked, center-baselined (ThemeRiver), Catmull-Rom-smoothed area paths. (Ported from the approved prototype's streamgraph math.)
```typescript
export interface Stream { term: string; color: string; values: number[] }
export interface StreamPath { term: string; color: string; d: string }
export interface Dims { width: number; height: number; padX?: number }

interface Pt { x: number; y: number }
function curve(points: Pt[], move: boolean): string {
  if (points.length === 0) return '';
  let d = move ? `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}` : `L ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function computeStreamPaths(streams: Stream[], dims: Dims): StreamPath[] {
  if (streams.length === 0) return [];
  const padX = dims.padX ?? 8;
  const n = streams[0].values.length;
  const plotW = dims.width - 2 * padX;
  const xs = Array.from({ length: n }, (_, i) => padX + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1)));
  const totals = Array.from({ length: n }, (_, i) => streams.reduce((s, st) => s + (st.values[i] ?? 0), 0));
  const maxTotal = Math.max(1, ...totals);
  const cy = dims.height * 0.5;
  const scaleY = (dims.height * 0.66) / maxTotal;

  const tops: Pt[][] = streams.map(() => []);
  const bots: Pt[][] = streams.map(() => []);
  for (let i = 0; i < n; i++) {
    let top = cy - (totals[i] * scaleY) / 2;
    streams.forEach((st, si) => {
      tops[si].push({ x: xs[i], y: top });
      top += (st.values[i] ?? 0) * scaleY;
      bots[si].push({ x: xs[i], y: top });
    });
  }
  return streams.map((st, si) => ({
    term: st.term,
    color: st.color,
    d: `${curve(tops[si], true)} ${curve([...bots[si]].reverse(), false)} Z`,
  }));
}
```

- [ ] **Step 4: Run — PASS.** Then `npm test`.

- [ ] **Step 5: Write `src/viz/sample.ts`** — synthetic `Mention[]` + `SectorSig[]` for dev/empty-DB (a handful of terms across ~18 months with plausible rising/falling shapes; deterministic, no Math.random). Export `SAMPLE_MENTIONS`, `SAMPLE_SECTORS`. Keep it ~30-60 rows.

- [ ] **Step 6: Write `src/components/RiverChart.tsx`** (client component). Props: `{ series: StreamSeries }`. Renders a full-bleed SVG via `computeStreamPaths` (use a fixed viewBox e.g. 1000x600, `preserveAspectRatio="none"`), draws each path filled with its color (opacity ~.9) over a dark gradient bg; a vertical scrubber line follows pointer; a readout panel shows the hovered period's cross-section (derive from `series` at the nearest period index). Keep it faithful to the dark River prototype but minimal. `'use client'` at top. No external chart lib.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(viz): streamgraph geometry + RiverChart component + sample data"`

---

## Task 3: Data layer + pages (River home, daily read, explore)

**Files:** Create `src/data/queries.ts`, `src/components/DailyRead.tsx`, `src/components/Explore.tsx`; replace `src/app/page.tsx`; create `src/app/day/[date]/page.tsx`, `src/app/explore/page.tsx`; edit `src/app/globals.css`. Test `src/data/queries.test.ts`.

- [ ] **Step 1: Write the failing test** — `src/data/queries.test.ts` (test the pure fallback/merge logic, not live DB):
```typescript
import { describe, it, expect } from 'vitest';
import { mentionsOrSample } from './queries';
import { SAMPLE_MENTIONS } from '@/viz/sample';

describe('mentionsOrSample', () => {
  it('returns DB rows when present', () => {
    const rows = [{ day: '2026-01-01', term: 'X', count: 1 }];
    expect(mentionsOrSample(rows)).toBe(rows);
  });
  it('falls back to sample when DB is empty', () => {
    expect(mentionsOrSample([])).toBe(SAMPLE_MENTIONS);
  });
});
```

- [ ] **Step 2: Run — FAIL.** `npm test src/data/queries.test.ts`

- [ ] **Step 3: Implement `src/data/queries.ts`** — server-only DB fns + the pure fallback. Keep DB reads thin; the fallback keeps pages renderable before the live pipeline.
```typescript
import { getDb } from '@/db/client';
import { tifaMention, sectorSignal } from '@/db/schema';
import { SAMPLE_MENTIONS, SAMPLE_SECTORS } from '@/viz/sample';
import type { Mention, SectorSig } from '@/viz/series';

export function mentionsOrSample(rows: Mention[]): Mention[] {
  return rows.length ? rows : SAMPLE_MENTIONS;
}
export function sectorsOrSample(rows: SectorSig[]): SectorSig[] {
  return rows.length ? rows : SAMPLE_SECTORS;
}

export async function getMentions(): Promise<Mention[]> {
  const rows = await getDb().select({ day: tifaMention.day, term: tifaMention.term, count: tifaMention.count }).from(tifaMention);
  return mentionsOrSample(rows as Mention[]);
}
export async function getSectorSignals(): Promise<SectorSig[]> {
  const rows = await getDb().select({ day: sectorSignal.day, sector: sectorSignal.sector, strength: sectorSignal.strength }).from(sectorSignal);
  return sectorsOrSample(rows as SectorSig[]);
}
```

- [ ] **Step 4: Run — PASS.** Then `npm test`.

- [ ] **Step 5: Build the pages + components.** (No new unit tests — verified via `tsc` + `build` + a render smoke-check.)
  - `src/app/page.tsx` (server component): `const mentions = await getMentions();` → `buildStreamSeries` → `<RiverChart series=... />` full-screen, with the editorial masthead + title overlay (port the prototype). Wrap in `<Suspense>` if needed. Because `getMentions` falls back to sample, the page renders even with an empty/unset DB **at request time** — but note: `getDb()` throws if `DATABASE_URL` unset. To keep the homepage renderable with no DB at all, wrap the DB read in try/catch and fall back to sample on error: implement `getMentions` to `try { ...db... } catch { return SAMPLE_MENTIONS }`. (Same for sectors.) This makes the app demoable with zero infra.
  - `src/components/DailyRead.tsx`: editorial day view — props `{ date, crossSection, items }`; render the §雷达-less interim (P4 adds radar): a cross-section strip + the day's item list grouped by segment. Port the Editorial styling.
  - `src/app/day/[date]/page.tsx`: `const { date } = await params;` load mentions → `buildCrossSection(mentions, date)`, load items for the date (query `item` by day, fallback empty) → `<DailyRead .../>`.
  - `src/components/Explore.tsx` + `src/app/explore/page.tsx`: keyword time-series (pick top term → `buildKeywordSeries`) as a line/sparkline + `buildSectorHeatmap` as a CSS-grid heatmap.
  - `src/app/globals.css`: dark River theme tokens + editorial type (serif headings). Keep Tailwind; add a few CSS custom properties.
  - Nav: simple links 脉络 `/` · 探索 `/explore`.
  - **Update `getMentions`/`getSectorSignals` to try/catch → sample fallback** (so `npm run build` static analysis and a no-DB dev server both render).

- [ ] **Step 6: Verify.** `npm test` (all pass), `npx tsc --noEmit` (clean), `npm run build` (green — `/`, `/day/[date]`, `/explore` present). Smoke-render: `npx next build` already exercises RSC; additionally start `npm run dev` briefly and confirm `/` returns 200 with an `<svg` in the HTML (e.g. `curl -s localhost:3000 | grep -c '<svg'`), then stop dev. Report the curl result.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(ui): River homepage, daily-read, explore pages with sample-data fallback"`

---

## Self-Review

**Spec coverage (P3 / §8):** full-screen River from real time-series (interim = top 提法; threads in P5) ✓; hover scrub + cross-section readout ✓; daily-read page (editorial; radar added P4) ✓; Explore (keyword series + sector heatmap) ✓; River/Editorial visual language ✓; renders before live pipeline via sample fallback ✓. Out of scope: animated transition polish (acceptable minimal version), radar (P4), named threads (P5), admin (P7).

**Placeholder scan:** none — sample.ts has real synthetic rows; try/catch fallback is concrete.

**Type consistency:** `Mention`/`SectorSig`/`StreamSeries`/`Stream`/`CrossSection` shared across series.ts, stream.ts, queries.ts, components. `computeStreamPaths` consumes `StreamSeries.streams`. Color palette deterministic.

---

## Live note
Once the pipeline has run (P1 backfill + P2 extraction populate `tifa_mention`/`sector_signal`/`item`), the pages automatically switch from sample to real data (the try/catch returns real rows). P5 will replace the top-提法 streams with synthesized named 主线.
