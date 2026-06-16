# River 按日河流 + 一屏布局 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 首页 River 改为「按日 + 7 天居中平滑」、整页压到一屏（100dvh）以河流为主体，并把 `/day` 的"今日横截面"改成真·当天。

**Architecture:** 新增纯函数 `src/viz/dailyStream.ts`（`rollingMean` / `topTermGroups` / `buildDailyStreamSeries`），首页从 `tifa_mention`（日级）+ `thread.meta.memberTerms` 实时聚合并平滑，得到日级 `StreamSeries` 交给 `RiverChart`。不动 schema、不改流水线。点击 River 直接用日期跳 `/day/[date]`，移除 `buildPeriodDateMap`/`getBroadcastDates`/`getThreadStreamSeries`。

**Tech Stack:** Next.js 16 (App Router, force-dynamic)、React 19、TypeScript、Vitest、Drizzle/Neon。包为 CommonJS，测试配置 `vitest.config.mts`，`@/` → `./src`。

---

### Task 1: `rollingMean` + `SMOOTH_WINDOW`（新建 dailyStream.ts）

**Files:**
- Create: `src/viz/dailyStream.ts`
- Test: `src/viz/dailyStream.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/viz/dailyStream.test.ts
import { describe, it, expect } from 'vitest';
import { rollingMean, SMOOTH_WINDOW } from './dailyStream';

describe('rollingMean', () => {
  it('window <= 1 原样返回（副本）', () => {
    expect(rollingMean([1, 2, 3], 1)).toEqual([1, 2, 3]);
  });
  it('居中 3 窗口、边缘收缩', () => {
    const r = rollingMean([0, 0, 9, 0, 0], 3);
    expect(r[0]).toBe(0);          // [0,0]/2
    expect(r[1]).toBeCloseTo(3);   // (0+0+9)/3
    expect(r[2]).toBeCloseTo(3);   // (0+9+0)/3
    expect(r[4]).toBe(0);          // [0,0]/2
  });
  it('平直序列保持不变', () => {
    expect(rollingMean([2, 2, 2, 2], 7)).toEqual([2, 2, 2, 2]);
  });
  it('SMOOTH_WINDOW 默认 7', () => {
    expect(SMOOTH_WINDOW).toBe(7);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/viz/dailyStream.test.ts`
Expected: FAIL（`Cannot find module './dailyStream'` 或导出不存在）

- [ ] **Step 3: 写最小实现**

```ts
// src/viz/dailyStream.ts
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
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/viz/dailyStream.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 提交**

```bash
git add src/viz/dailyStream.ts src/viz/dailyStream.test.ts
git commit -m "feat(viz): rollingMean + SMOOTH_WINDOW for daily smoothing"
```

---

### Task 2: `topTermGroups` + `buildDailyStreamSeries`

**Files:**
- Modify: `src/viz/dailyStream.ts`
- Test: `src/viz/dailyStream.test.ts`

- [ ] **Step 1: 追加失败测试**

在 `src/viz/dailyStream.test.ts` 末尾追加：

```ts
import { topTermGroups, buildDailyStreamSeries } from './dailyStream';

describe('topTermGroups', () => {
  it('取 top-N 提法各作为单词组，带颜色', () => {
    const g = topTermGroups([
      { day: '2026-01-01', term: 'A', count: 5 },
      { day: '2026-01-02', term: 'B', count: 9 },
      { day: '2026-01-03', term: 'C', count: 1 },
    ], 2);
    expect(g.map((x) => x.name)).toEqual(['B', 'A']);
    expect(g[0].terms).toEqual(['B']);
    expect(g[0].color).toMatch(/^#/);
  });
});

describe('buildDailyStreamSeries', () => {
  const mentions = [
    { day: '2026-01-01', term: 'x1', count: 2 },
    { day: '2026-01-01', term: 'y1', count: 1 },
    { day: '2026-01-02', term: 'x2', count: 4 },
    { day: '2026-01-03', term: 'y1', count: 3 },
  ];
  const groups = [
    { name: 'X', color: '#f00', terms: ['x1', 'x2'] },
    { name: 'Y', color: '#0f0', terms: ['y1'] },
  ];
  it('periods 为升序日期', () => {
    const s = buildDailyStreamSeries(mentions, groups, { window: 1 });
    expect(s.periods).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });
  it('按成员词逐日聚合（window=1 即原始）', () => {
    const s = buildDailyStreamSeries(mentions, groups, { window: 1 });
    expect(s.streams.find((v) => v.term === 'X')!.values).toEqual([2, 4, 0]);
    expect(s.streams.find((v) => v.term === 'Y')!.values).toEqual([1, 0, 3]);
  });
  it('默认窗口做平滑（3 点全覆盖 → 均值）', () => {
    const s = buildDailyStreamSeries(mentions, groups); // 默认窗口 7
    const x = s.streams.find((v) => v.term === 'X')!.values; // (2+4+0)/3 = 2
    expect(x.every((v) => Math.abs(v - 2) < 1e-9)).toBe(true);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/viz/dailyStream.test.ts`
Expected: FAIL（`topTermGroups`/`buildDailyStreamSeries` 未导出）

- [ ] **Step 3: 实现（追加到 dailyStream.ts 顶部 import + 函数）**

在 `src/viz/dailyStream.ts` 顶部加 import，并追加以下导出：

```ts
import { colorFor } from './palette';
import type { Mention, StreamSeries } from './series';

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
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/viz/dailyStream.test.ts`
Expected: PASS（全部）

- [ ] **Step 5: 提交**

```bash
git add src/viz/dailyStream.ts src/viz/dailyStream.test.ts
git commit -m "feat(viz): buildDailyStreamSeries + topTermGroups (daily grouped+smoothed streams)"
```

---

### Task 3: `buildCrossSection` 改为真·当天

**Files:**
- Modify: `src/viz/series.ts:30-43`
- Test: `src/viz/series.test.ts:30-37`

- [ ] **Step 1: 替换 cross-section 测试**

把 `src/viz/series.test.ts` 中现有的 `describe('buildCrossSection', ...)` 块（约 30-37 行）整体替换为：

```ts
describe('buildCrossSection (daily)', () => {
  it('只取精确当天的各提法强度，降序', () => {
    const xs = buildCrossSection([
      { day: '2026-02-15', term: 'A', count: 2 },
      { day: '2026-02-15', term: 'B', count: 5 },
      { day: '2026-02-16', term: 'A', count: 9 }, // 不同天，排除
    ], '2026-02-15', { topN: 3 });
    expect(xs.period).toBe('2026-02-15');
    expect(xs.entries[0]).toMatchObject({ term: 'B', value: 5 });
    expect(xs.entries[1]).toMatchObject({ term: 'A', value: 2 });
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/viz/series.test.ts`
Expected: FAIL（旧实现按月聚合，`period` 为 `2026-02` 且会把 02-16 的 A 也算进来）

- [ ] **Step 3: 改实现**

把 `src/viz/series.ts` 的 `buildCrossSection` 整体替换为（仅过滤条件与 `period` 改动）：

```ts
export function buildCrossSection(mentions: Mention[], date: string, opts: { topN?: number } = {}): CrossSection {
  const totals = new Map<string, number>();
  for (const m of mentions) {
    if (m.day !== date) continue;
    totals.set(m.term, (totals.get(m.term) ?? 0) + m.count);
  }
  const entries = [...totals.entries()]
    .map(([term, value]) => ({ term, value }))
    .sort((a, b) => b.value - a.value || a.term.localeCompare(b.term))
    .slice(0, opts.topN ?? 8);
  return { period: date, entries };
}
```

（`month` 仍被 `buildStreamSeries`/`buildKeywordSeries`/`buildSectorHeatmap` 使用，保留不动。）

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/viz/series.test.ts`
Expected: PASS（含其余 buildStreamSeries / buildKeywordSeries / buildSectorHeatmap 测试）

- [ ] **Step 5: 提交**

```bash
git add src/viz/series.ts src/viz/series.test.ts
git commit -m "feat(viz): buildCrossSection aggregates the exact day (真·当天)"
```

---

### Task 4: `getThreads` 数据查询

**Files:**
- Modify: `src/data/threads.ts`

说明：与现有 `getMentions` 等一致，DB 适配器不做单测（纯查询）。

- [ ] **Step 1: 在 `src/data/threads.ts` 顶部加 import**

```ts
import type { TermGroup } from '@/viz/dailyStream';
```

- [ ] **Step 2: 追加 `getThreads`（文件末尾）**

```ts
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
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无输出（通过）

- [ ] **Step 4: 提交**

```bash
git add src/data/threads.ts
git commit -m "feat(data): getThreads → TermGroup[] from thread.meta.memberTerms"
```

---

### Task 5: `RiverChart` — 日期点击 + SVG 填满父高 + 去掉 periodDate

**Files:**
- Modify: `src/components/RiverChart.tsx`

- [ ] **Step 1: 改 Props 与点击逻辑**

把 `interface Props { ... }` 及组件签名/导航逻辑改为（删除 `periodDate`，点击直接用日期）：

```ts
interface Props {
  series: StreamSeries;
}

export default function RiverChart({ series }: Props) {
  const lastIdx = Math.max(0, series.periods.length - 1);
  const [hoverIdx, setHoverIdx] = useState<number>(lastIdx);
  const svgRef = useRef<SVGSVGElement>(null);
  const router = useRouter();

  // periods 现在是真实日期（YYYY-MM-DD）→ 点击直接进当天
  const navigateToIdx = useCallback(
    (idx: number) => {
      const date = series.periods[idx];
      if (!date) return;
      const go = () => router.push(`/day/${date}`);
      const d = document as Document & { startViewTransition?: (cb: () => void) => void };
      if (typeof d.startViewTransition === 'function') d.startViewTransition(go);
      else go();
    },
    [series.periods, router],
  );
  const clickable = series.periods.length > 0;
```

- [ ] **Step 2: SVG/容器填满父高**

把最外层包裹 `div` 的 style 加上 `height: '100%'`，并把 `<svg>` 的 style 由 `height: 'auto'` 改为 `height: '100%'`：

外层 div：
```tsx
<div style={{ position: 'relative', width: '100%', height: '100%', background: 'radial-gradient(ellipse at 50% 40%, #0e1520 0%, #060a10 100%)' }}>
```
svg：
```tsx
<svg
  ref={svgRef}
  viewBox={`0 0 ${SVG_W} ${SVG_H}`}
  preserveAspectRatio="none"
  style={{ display: 'block', width: '100%', height: '100%' }}
  aria-label="Keyword stream chart"
>
```

（`handleClick`、overlay rect 的 `onClick={clickable ? handleClick : undefined}` 与 `cursor`、读数面板的"点击进入当日解读"提示均保持现状，无需改。`hoverPeriod` 现在显示日期，天然正确。）

- [ ] **Step 3: 构建 + 类型检查**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 无输出；build `✓ Compiled successfully`

- [ ] **Step 4: 提交**

```bash
git add src/components/RiverChart.tsx
git commit -m "feat(river): click navigates to exact day; svg fills parent height"
```

---

### Task 6: 首页 `page.tsx` — 日级聚合 + 一屏紧凑布局

**Files:**
- Modify: `src/app/page.tsx`（整文件替换）

- [ ] **Step 1: 整文件替换为**

```tsx
import RiverChart from '@/components/RiverChart';
import { getMentions } from '@/data/queries';
import { getThreads } from '@/data/threads';
import { buildDailyStreamSeries, topTermGroups } from '@/viz/dailyStream';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [threads, mentions] = await Promise.all([getThreads(), getMentions()]);
  const groups = threads.length ? threads : topTermGroups(mentions, 6);
  const series = buildDailyStreamSeries(mentions, groups);
  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', background: '#08080e', color: '#ECEAE3' }}>
      <header style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 28px', borderBottom: '1px solid #1b1b26' }}>
        <div style={{ fontWeight: 800, letterSpacing: 1 }}>联播 · 脉络</div>
        <nav style={{ display: 'flex', gap: 20, fontSize: 13, color: '#8a8a98' }}>
          <span style={{ color: '#ECEAE3', borderBottom: '2px solid #e0436b' }}>脉络</span>
          <a href="/explore" style={{ color: '#8a8a98' }}>探索</a>
        </nav>
      </header>
      <section style={{ flex: '0 0 auto', padding: '14px 28px 10px' }}>
        <div style={{ fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: '#c99' }}>The Currents of China</div>
        <h1 className="serif" style={{ fontSize: 'clamp(22px,3vw,40px)', fontWeight: 800, margin: '4px 0 0' }}>几条主线，如何此消彼长</h1>
      </section>
      <div style={{ flex: 1, minHeight: 0 }}>
        <RiverChart series={series} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: 构建**

Run: `npm run build`
Expected: `✓ Compiled successfully`，路由表含 `ƒ /`

- [ ] **Step 3: 本地肉眼验证（可选但推荐）**

```bash
npm run dev
```
浏览器开 `http://localhost:3000`：整页不滚动（一屏内）、River 填满中下部、hover 显示某一天读数、点击 River 跳到 `/day/<那一天>`。看完 Ctrl-C 停 dev。

- [ ] **Step 4: 提交**

```bash
git add src/app/page.tsx
git commit -m "feat(home): daily smoothed river + one-screen 100dvh compact layout"
```

---

### Task 7: 清理死代码（period 映射 / getBroadcastDates / getThreadStreamSeries）

**Files:**
- Delete: `src/viz/period.ts`, `src/viz/period.test.ts`
- Modify: `src/data/queries.ts`, `src/data/threads.ts`

- [ ] **Step 1: 删除 period 文件**

```bash
git rm src/viz/period.ts src/viz/period.test.ts
```

- [ ] **Step 2: `src/data/queries.ts` 移除 `getBroadcastDates` 及其专用 import**

删除整个 `getBroadcastDates` 函数（及其上方注释）。并把顶部 import 改回：

```ts
import { tifaMention, sectorSignal, item, dailyInterpretation, radarEvent } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
```
（即移除 `broadcastDay` 与 `sql` —— 二者仅 `getBroadcastDates` 使用；`eq`/`desc` 仍被其它查询使用。）

- [ ] **Step 3: `src/data/threads.ts` 移除未用的 `getThreadStreamSeries` / `threadPointsToStreamSeries` / `ThreadPointFull`**

删除这三个导出（首页已不再使用）。保留 `getThreads`。把顶部 import 改为仅保留实际用到的：

```ts
import { getDb } from '@/db/client';
import { thread } from '@/db/schema';
import type { TermGroup } from '@/viz/dailyStream';
```
（移除 `threadPoint` 与 `import type { StreamSeries }` —— 已无引用。）

- [ ] **Step 4: 确认无残留引用**

Run: `grep -rn "buildPeriodDateMap\|getBroadcastDates\|getThreadStreamSeries\|threadPointsToStreamSeries\|periodDate" src/`
Expected: 无输出（全部清除）

- [ ] **Step 5: 类型检查 + 测试**

Run: `npx tsc --noEmit && npm test`
Expected: tsc 无输出；测试全绿

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "chore: remove monthly period→date mapping and unused thread-stream helpers"
```

---

### Task 8: 全量验证 + 线上回归

**Files:** 无（验证）

- [ ] **Step 1: 全套门禁**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc 无输出；vitest 全绿；build `✓ Compiled successfully`

- [ ] **Step 2: 推送（触发 Vercel 自动部署）**

```bash
git push origin main
```

- [ ] **Step 3: 线上回归（Playwright，部署完成后）**

- 首页 `https://cctv-digest.vercel.app/`：整页一屏不滚动、River 填满、河流为按日平滑形态。
- 点击 River → 跳到 `/day/<某一天>`（精确到日）。
- `/day/<某天>` 的"今日横截面"显示**当天**提法（非整月）。

---

## 备注（不在本计划内）

- `validateTranscript` 拒绝导航占位页/过短稿的加固为独立已批任务，单独实现。
- `thread_point` 月度表保留不动（不再喂 River，无害）。
