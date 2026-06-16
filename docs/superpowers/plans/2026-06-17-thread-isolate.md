# River 单主线隔离（捞起摊平）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全屏 River 首页悬停某主线 dwell 后，把它原地柔和形变成"从 0 基线起的面积"（其余淡出），单条趋势从"厚度"变"高度"易读；移开沉回。有设计质感。

**Architecture:** `stream.ts` 抽出 `computeStreamGeometry`（边点几何）并导出 `curve`/`Pt`，`computeStreamPaths` 复用它（DRY、行为不变）。新纯模块 `focus.ts`（`peakIndex`/`hitStream`/`flattenedTop`/`morphTop`/`morphIsolatedPath`）。`RiverChart` 加 `enableIsolate` prop + `useStreamFocus` hook（命中测试 + dwell + rAF 推进 progress）+ `StreamFocus` 覆盖组件（渐变填充 + 顶描边 + 峰值/今日点 + 轻刻度，HTML 标注防 `preserveAspectRatio="none"` 拉伸失真，尊重 reduced-motion）。当日页顶部条 `enableIsolate={false}`。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Vitest。`@/`→`./src`。单测 `npx vitest run <path>`，全套 `npm test`，类型 `npx tsc --noEmit`，构建 `npm run build`。SVG `preserveAspectRatio="none"`（会拉伸）→ 文本/圆点用 HTML 覆盖、线条用 `vector-effect="non-scaling-stroke"`。

---

### Task 1: 重构 `stream.ts` — 抽 `computeStreamGeometry`、导出 `curve`/`Pt`

**Files:** Modify `src/viz/stream.ts`; Test `src/viz/stream.test.ts`（追加）

- [ ] **Step 1: 追加几何测试** 到 `src/viz/stream.test.ts`

```ts
import { computeStreamGeometry } from './stream';

describe('computeStreamGeometry', () => {
  const streams = [
    { term: 'A', color: '#f00', values: [1, 3] },
    { term: 'B', color: '#0f0', values: [2, 1] },
  ];
  const geom = computeStreamGeometry(streams, { width: 100, height: 100, padX: 10 });
  it('每条流有 top/bot 边点、x 对齐', () => {
    expect(geom.tops).toHaveLength(2);
    expect(geom.tops[0]).toHaveLength(2);
    expect(geom.xs[0]).toBe(10);
    expect(geom.xs[1]).toBe(90);
  });
  it('堆叠：A 的 bot == B 的 top（同一列相接）', () => {
    expect(geom.bots[0][0].y).toBeCloseTo(geom.tops[1][0].y);
    expect(geom.bots[0][1].y).toBeCloseTo(geom.tops[1][1].y);
  });
  it('某列带高 ∝ 值（A 第1列高 = 1*scaleY）', () => {
    expect(geom.bots[0][0].y - geom.tops[0][0].y).toBeCloseTo(1 * geom.scaleY);
  });
});
```

- [ ] **Step 2: 跑确认失败**：`npx vitest run src/viz/stream.test.ts` → FAIL（`computeStreamGeometry` 未导出）

- [ ] **Step 3: 重构 `src/viz/stream.ts`** —— 整文件替换为：

```ts
export interface Stream { term: string; color: string; values: number[] }
export interface StreamPath { term: string; color: string; d: string }
export interface Dims { width: number; height: number; padX?: number }
export interface Pt { x: number; y: number }

export function curve(points: Pt[], move: boolean): string {
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

export interface StreamGeometry {
  xs: number[]; tops: Pt[][]; bots: Pt[][]; cy: number; scaleY: number; maxTotal: number;
}

export function computeStreamGeometry(streams: Stream[], dims: Dims): StreamGeometry {
  const padX = dims.padX ?? 8;
  const n = streams[0]?.values.length ?? 0;
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
  return { xs, tops, bots, cy, scaleY, maxTotal };
}

export function computeStreamPaths(streams: Stream[], dims: Dims): StreamPath[] {
  if (streams.length === 0) return [];
  const geom = computeStreamGeometry(streams, dims);
  return streams.map((st, si) => ({
    term: st.term,
    color: st.color,
    d: `${curve(geom.tops[si], true)} ${curve([...geom.bots[si]].reverse(), false)} Z`,
  }));
}
```

- [ ] **Step 4: 跑测试**：`npx vitest run src/viz/stream.test.ts && npm test` → 新几何测试 + **现有 computeStreamPaths 测试全绿**（行为未变）

- [ ] **Step 5: 提交**：`git add src/viz/stream.ts src/viz/stream.test.ts && git commit -m "refactor(viz): extract computeStreamGeometry + export curve/Pt (DRY)"`

---

### Task 2: 新纯模块 `src/viz/focus.ts`（TDD）

**Files:** Create `src/viz/focus.ts`; Test `src/viz/focus.test.ts`

- [ ] **Step 1: 写失败测试** `src/viz/focus.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { peakIndex, hitStream, flattenedTop, morphTop, morphIsolatedPath } from './focus';
import { computeStreamGeometry, curve } from './stream';

describe('peakIndex', () => {
  it('返回最大值下标（并列取首个）', () => {
    expect(peakIndex([1, 5, 3])).toBe(1);
    expect(peakIndex([4, 4, 2])).toBe(0);
  });
});

describe('hitStream', () => {
  const geom = computeStreamGeometry(
    [{ term: 'A', color: '#f00', values: [1] }, { term: 'B', color: '#0f0', values: [1] }],
    { width: 100, height: 100, padX: 10 },
  );
  it('y 落在某流的 top..bot 之间 → 该流下标', () => {
    const midA = (geom.tops[0][0].y + geom.bots[0][0].y) / 2;
    expect(hitStream(geom, 0, midA)).toBe(0);
    const midB = (geom.tops[1][0].y + geom.bots[1][0].y) / 2;
    expect(hitStream(geom, 0, midB)).toBe(1);
  });
  it('y 在所有流之外 → -1', () => {
    expect(hitStream(geom, 0, geom.tops[0][0].y - 50)).toBe(-1);
    expect(hitStream(geom, -1, 50)).toBe(-1);
  });
});

describe('flattenedTop', () => {
  it('y = floorY - v/max*usableH（峰值贴顶、0 贴底）', () => {
    const xs = [0, 1, 2];
    const ft = flattenedTop([0, 5, 10], xs, 100, 80);
    expect(ft[0].y).toBeCloseTo(100);        // 0 → floor
    expect(ft[2].y).toBeCloseTo(20);         // max → floor-usableH
    expect(ft[1].y).toBeCloseTo(60);         // 5/10 → floor-40
    expect(ft[1].x).toBe(1);
  });
});

describe('morphTop / morphIsolatedPath', () => {
  const stackedTop = [{ x: 0, y: 10 }, { x: 1, y: 12 }];
  const stackedBot = [{ x: 0, y: 30 }, { x: 1, y: 28 }];
  const flat = [{ x: 0, y: 90 }, { x: 1, y: 70 }];
  it('morphTop：progress=0 取 stacked、=1 取 flat、=0.5 取中点', () => {
    expect(morphTop(stackedTop, flat, 0)).toEqual(stackedTop);
    expect(morphTop(stackedTop, flat, 1)).toEqual(flat);
    expect(morphTop(stackedTop, flat, 0.5)[0].y).toBeCloseTo(50);
  });
  it('morphIsolatedPath：progress=0 == 原堆叠路径', () => {
    const got = morphIsolatedPath(stackedTop, stackedBot, flat, 100, 0);
    const want = `${curve(stackedTop, true)} ${curve([...stackedBot].reverse(), false)} Z`;
    expect(got).toBe(want);
  });
  it('morphIsolatedPath：progress=1 == 顶为 flat、底为 floor 的面积', () => {
    const got = morphIsolatedPath(stackedTop, stackedBot, flat, 100, 1);
    const floorBot = stackedBot.map((p) => ({ x: p.x, y: 100 }));
    const want = `${curve(flat, true)} ${curve([...floorBot].reverse(), false)} Z`;
    expect(got).toBe(want);
  });
});
```

- [ ] **Step 2: 跑确认失败**：`npx vitest run src/viz/focus.test.ts` → FAIL

- [ ] **Step 3: 实现 `src/viz/focus.ts`**

```ts
import { curve, type Pt, type StreamGeometry } from './stream';

export function peakIndex(values: number[]): number {
  let pi = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[pi]) pi = i;
  return pi;
}

// 命中：第 idx 列里 y 落在 top..bot 的流下标；-1 表示空隙/无效
export function hitStream(geom: StreamGeometry, idx: number, y: number): number {
  if (idx < 0) return -1;
  for (let s = 0; s < geom.tops.length; s++) {
    const top = geom.tops[s][idx]?.y, bot = geom.bots[s][idx]?.y;
    if (top == null || bot == null) continue;
    if (y >= top && y <= bot) return s;
  }
  return -1;
}

// 摊平顶边：从 floorY 起、按 v/max 占 usableH
export function flattenedTop(values: number[], xs: number[], floorY: number, usableH: number): Pt[] {
  const mx = Math.max(1, ...values);
  return values.map((v, i) => ({ x: xs[i], y: floorY - (v / mx) * usableH }));
}

// 顶边插值：stacked → flat（progress 0..1）
export function morphTop(stackedTop: Pt[], flatTop: Pt[], progress: number): Pt[] {
  return stackedTop.map((p, i) => ({ x: p.x, y: p.y + (flatTop[i].y - p.y) * progress }));
}

// 形变面积：顶 = morphTop，底 = stackedBot → floorY 插值；用平滑 curve 拼 d
export function morphIsolatedPath(stackedTop: Pt[], stackedBot: Pt[], flatTop: Pt[], floorY: number, progress: number): string {
  const top = morphTop(stackedTop, flatTop, progress);
  const bot = stackedBot.map((p) => ({ x: p.x, y: p.y + (floorY - p.y) * progress }));
  return `${curve(top, true)} ${curve([...bot].reverse(), false)} Z`;
}
```

- [ ] **Step 4: 跑测试**：`npx vitest run src/viz/focus.test.ts` → PASS
- [ ] **Step 5: 提交**：`git add src/viz/focus.ts src/viz/focus.test.ts && git commit -m "feat(viz): focus.ts pure geometry (hitStream/flatten/morph/peak)"`

---

### Task 3: `StreamFocus` 覆盖组件（摊平面积 + 标注）

**Files:** Create `src/components/StreamFocus.tsx`

说明：纯展示组件（props 驱动）。SVG `preserveAspectRatio="none"` 会拉伸 → 圆点/文本用 HTML 覆盖（按 % 定位、不失真）、线用 `vector-effect="non-scaling-stroke"`。坐标系沿用主图 viewBox `1000×600`。

- [ ] **Step 1: 创建组件**

```tsx
'use client';
import { curve, type Pt } from '@/viz/stream';
import { flattenedTop, morphTop, morphIsolatedPath, peakIndex } from '@/viz/focus';

const SVG_W = 1000, SVG_H = 600, PAD_X = 16, PAD_Y = 30;
const FLOOR = SVG_H - PAD_Y, USABLE = SVG_H - 2 * PAD_Y;

interface Props {
  term: string; color: string; values: number[];
  stackedTop: Pt[]; stackedBot: Pt[]; xs: number[];
  periods: string[]; progress: number; hoverIdx: number;
}

export default function StreamFocus({ term, color, values, stackedTop, stackedBot, xs, periods, progress, hoverIdx }: Props) {
  const flat = flattenedTop(values, xs, FLOOR, USABLE);
  const area = morphIsolatedPath(stackedTop, stackedBot, flat, FLOOR, progress);
  const topLine = curve(morphTop(stackedTop, flat, progress), true);
  const pk = peakIndex(values);
  const hi = Math.max(0, Math.min(values.length - 1, hoverIdx));
  const maxV = Math.max(1, ...values);
  const lerpY = (a: number, b: number) => a + (b - a) * progress;
  const px = (x: number) => `${(x / SVG_W) * 100}%`;
  const py = (y: number) => `${(y / SVG_H) * 100}%`;
  const peakY = lerpY(stackedTop[pk].y, flat[pk].y);
  const todayY = lerpY(stackedTop[hi].y, flat[hi].y);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: Math.min(1, progress * 1.25) }}>
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="sf-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.85" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#sf-grad)" stroke="none" />
        <path d={topLine} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <line x1={PAD_X} y1={FLOOR} x2={SVG_W - PAD_X} y2={FLOOR} stroke="rgba(255,255,255,0.18)" strokeDasharray="2 5" vectorEffect="non-scaling-stroke" />
        <line x1={PAD_X} y1={FLOOR - USABLE} x2={SVG_W - PAD_X} y2={FLOOR - USABLE} stroke="rgba(255,255,255,0.10)" strokeDasharray="2 5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="serif" style={{ position: 'absolute', left: 16, top: 10, fontWeight: 800, fontSize: 15, color: '#ECEAE3' }}>{term}</div>
      <div style={{ position: 'absolute', left: px(xs[pk]), top: py(peakY), width: 9, height: 9, margin: '-5px 0 0 -5px', borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 2px rgba(0,0,0,.35)' }} />
      <div style={{ position: 'absolute', left: px(xs[hi]), top: py(todayY), width: 9, height: 9, margin: '-5px 0 0 -5px', borderRadius: '50%', background: color, border: '2px solid #fff' }} />
      <div style={{ position: 'absolute', left: px(xs[hi]), top: py(todayY), transform: 'translate(-50%,-150%)', fontSize: 10, color: '#cbd5e1', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{periods[hi] ?? ''}</div>
      <div style={{ position: 'absolute', right: 10, top: py(FLOOR - USABLE), marginTop: -7, fontSize: 10, color: '#9fb0c0', fontVariantNumeric: 'tabular-nums' }}>{Math.round(maxV)}</div>
      <div style={{ position: 'absolute', right: 10, top: py(FLOOR), marginTop: -15, fontSize: 10, color: '#9fb0c0' }}>0</div>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查**：`npx tsc --noEmit` → clean
- [ ] **Step 3: 提交**：`git add src/components/StreamFocus.tsx && git commit -m "feat(river): StreamFocus overlay (gradient area + stroke + peak/today + scale)"`

---

### Task 4: `useStreamFocus` hook + `RiverChart` 接入

**Files:** Create `src/components/useStreamFocus.ts`; Modify `src/components/RiverChart.tsx`

- [ ] **Step 1: 创建 hook `src/components/useStreamFocus.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

const DWELL_MS = 400;
const EASE = 0.09;

export function useStreamFocus(enabled: boolean) {
  const [isolatedIdx, setIsolatedIdx] = useState(-1);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const targetRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const dwellRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveredRef = useRef(-1);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); if (dwellRef.current) clearTimeout(dwellRef.current); };
  }, []);

  const tick = useCallback(() => {
    const t = targetRef.current;
    let p = progressRef.current;
    p = reducedRef.current ? t : p + (t - p) * EASE;
    if (Math.abs(t - p) < 0.0015) p = t;
    progressRef.current = p;
    setProgress(p);
    if (p !== t) { rafRef.current = requestAnimationFrame(tick); }
    else { rafRef.current = null; if (t === 0) setIsolatedIdx(-1); }
  }, []);

  const drive = useCallback((t: number) => {
    targetRef.current = t;
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  // 在 mousemove 时传入命中的流下标（-1=空隙）
  const onHover = useCallback((streamIdx: number) => {
    if (!enabled) return;
    if (isolatedIdx >= 0 || progressRef.current > 0) return; // 已隔离则不再 dwell（移动只更新 hoverIdx）
    if (streamIdx === hoveredRef.current) return;            // 同一条流 → 维持计时
    hoveredRef.current = streamIdx;
    if (dwellRef.current) clearTimeout(dwellRef.current);
    if (streamIdx < 0) return;                               // 移到空隙 → 取消
    dwellRef.current = setTimeout(() => { setIsolatedIdx(streamIdx); drive(1); }, DWELL_MS);
  }, [enabled, isolatedIdx, drive]);

  const onLeave = useCallback(() => {
    if (dwellRef.current) clearTimeout(dwellRef.current);
    hoveredRef.current = -1;
    drive(0);
  }, [drive]);

  return { isolatedIdx, progress, onHover, onLeave };
}
```

- [ ] **Step 2: 接入 `RiverChart.tsx`** —— 读文件后做以下改动：

(a) 顶部加 import：
```tsx
import { useMemo } from 'react';
import { computeStreamGeometry } from '@/viz/stream';
import { hitStream } from '@/viz/focus';
import { useStreamFocus } from '@/components/useStreamFocus';
import StreamFocus from '@/components/StreamFocus';
```
（`useMemo` 也可并入第 3 行现有 `from 'react'` 的解构。）

(b) `Props` 增加 `enableIsolate?: boolean`；签名解构默认 `true`：
```tsx
interface Props {
  series: StreamSeries;
  showReadout?: boolean;
  currentDate?: string;
  enableIsolate?: boolean;
}
export default function RiverChart({ series, showReadout = true, currentDate, enableIsolate = true }: Props) {
```

(c) 组件体内（`const router = useTransitionRouter();` 之后）加：
```tsx
  const geom = useMemo(() => computeStreamGeometry(series.streams, { width: SVG_W, height: SVG_H, padX: PAD_X }), [series.streams]);
  const focus = useStreamFocus(enableIsolate);
```

(d) 改 `handleMouseMove`：算出 SVG 内 y 并命中测试、上报 hover：
```tsx
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      if (!svgRef.current || n === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const idx = Math.round(Math.max(0, Math.min(1, (relX * SVG_W - PAD_X) / (plotW || 1))) * (n - 1));
      setHoverIdx(idx);
      const svgY = ((e.clientY - rect.top) / rect.height) * SVG_H;
      focus.onHover(hitStream(geom, idx, svgY));
    },
    [n, plotW, geom, focus],
  );
```

(e) overlay rect 的 `onMouseLeave` 同时通知 focus：
```tsx
          onMouseLeave={() => { setHoverIdx(anchorIdx); focus.onLeave(); }}
```

(f) 堆叠带子渲染加隔离态的淡出/隐藏（把现有 `{paths.map((p) => (<path .../>))}` 替换为带下标的版本）：
```tsx
        {paths.map((p, i) => (
          <path
            key={p.term}
            d={p.d}
            fill={p.color}
            fillOpacity={0.88}
            stroke="none"
            style={{
              opacity: focus.isolatedIdx === i ? 1 - focus.progress : 1 - 0.92 * focus.progress,
              filter: focus.progress > 0 && focus.isolatedIdx !== i ? 'saturate(0.5)' : undefined,
              transition: 'opacity .12s linear',
            }}
          />
        ))}
```

(g) 在主 `<svg>` 结束标签 `</svg>` 之后、读数面板之前，插入隔离覆盖层：
```tsx
      {enableIsolate && focus.isolatedIdx >= 0 && (
        <StreamFocus
          term={series.streams[focus.isolatedIdx].term}
          color={series.streams[focus.isolatedIdx].color}
          values={series.streams[focus.isolatedIdx].values}
          stackedTop={geom.tops[focus.isolatedIdx]}
          stackedBot={geom.bots[focus.isolatedIdx]}
          xs={geom.xs}
          periods={series.periods}
          progress={focus.progress}
          hoverIdx={hoverIdx}
        />
      )}
```

(h) 读数面板在隔离时隐藏——把 `{showReadout && (` 改为：
```tsx
      {showReadout && focus.progress < 0.02 && (
```

- [ ] **Step 3: 类型 + 构建**：`npx tsc --noEmit && npm run build` → clean + `✓ Compiled successfully`
- [ ] **Step 4: 提交**：`git add src/components/useStreamFocus.ts src/components/RiverChart.tsx && git commit -m "feat(river): dwell-to-isolate a stream (useStreamFocus + StreamFocus wiring)"`

---

### Task 5: 当日页顶部条关闭隔离

**Files:** Modify `src/components/DailyRead.tsx`

- [ ] **Step 1: 给顶部条的 RiverChart 传 `enableIsolate={false}`**

把 DailyRead 里顶部条的 `<RiverChart series={riverSeries} showReadout={false} currentDate={date} />` 改为：
```tsx
        <RiverChart series={riverSeries} showReadout={false} currentDate={date} enableIsolate={false} />
```

- [ ] **Step 2: 类型 + 构建**：`npx tsc --noEmit && npm run build` → clean + ✓
- [ ] **Step 3: 提交**：`git add src/components/DailyRead.tsx && git commit -m "feat(daily): disable stream-isolate on the short top strip"`

---

### Task 6: 全量门禁 + 推送 + 线上回归

**Files:** 无（验证）

- [ ] **Step 1: 门禁**：`npx tsc --noEmit && npm test && npm run build` 全过
- [ ] **Step 2: 推送**：`git push origin main`
- [ ] **Step 3: 线上回归（Playwright，部署后）**
  - 首页 hover 某条流 ~0.4s → 该流摊平成"从 0 起的面积"（渐变 + 顶描边）、其余淡出去饱和、出现峰值○/今日点/0·峰值刻度/主线名、多主线读数面板隐藏；
  - 移出图表 → 平滑沉回、读数面板恢复；
  - 当日页顶部条 hover 不触发隔离（`enableIsolate={false}`），仍可切日；
  - 截图记录摊平态。
  - 注：dwell/形变是时间态，用 `browser_evaluate` 派发 `mousemove` 到目标流区域并 `await` 数百 ms 后读取 DOM（隔离层是否出现）；reduced-motion 下 progress 直接到位。

---

## 备注
- `enableIsolate` 默认 true（首页）；当日页条 false。其余 RiverChart 行为（hover scrubber、点击进当日、view-transition 形变）不变。
- 标注用 HTML 覆盖 + 线条 `vector-effect="non-scaling-stroke"`，规避 `preserveAspectRatio="none"` 的拉伸失真（设计质感）。
- 不动数据/平滑/流水线。
