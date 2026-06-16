# River→当日页 压缩动效 + 顶部可交互河流条 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 点击河流图某天进入当日页时，河流压缩为顶部 context 条 + 当日内容上浮淡入；当日页常驻这条可交互河流条，页内可切换日期。

**Architecture:** `RiverChart` 增 `showReadout`/`currentDate` props 并带 `view-transition-name: river-stream`（首页全屏与当日条共用同名 → Chromium 真形变；其他浏览器降级交叉淡入 + CSS 入场兜底）。当日页 `DailyRead` 在 nav 后挂一条 sticky 矮版 `RiverChart`（无读数面板、scrubber 锚定当前日、点击切日），`.rise-in` 移到内容区。锚点用纯函数 `anchorIndex`。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Vitest、View Transitions API、CSS。`@/`→`./src`，单测 `npx vitest run <path>`，全套 `npm test`，类型 `npx tsc --noEmit`，构建 `npm run build`。

---

### Task 1: `src/viz/anchor.ts` — `anchorIndex` 纯函数（TDD）

**Files:** Create `src/viz/anchor.ts`; Test `src/viz/anchor.test.ts`

- [ ] **Step 1: 写失败测试** `src/viz/anchor.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { anchorIndex } from './anchor';

describe('anchorIndex', () => {
  const periods = ['2025-06-01', '2025-06-02', '2025-06-03'];
  it('无 currentDate → lastIdx', () => { expect(anchorIndex(periods, undefined, 2)).toBe(2); });
  it('命中 currentDate → 其下标', () => { expect(anchorIndex(periods, '2025-06-02', 2)).toBe(1); });
  it('未命中 → 回退 lastIdx', () => { expect(anchorIndex(periods, '2025-12-31', 2)).toBe(2); });
  it('空 periods → lastIdx', () => { expect(anchorIndex([], '2025-06-02', 0)).toBe(0); });
});
```

- [ ] **Step 2: 跑确认失败**：`npx vitest run src/viz/anchor.test.ts` → FAIL（模块不存在）
- [ ] **Step 3: 实现** `src/viz/anchor.ts`

```ts
// River scrubber 锚点：当日页定位到当前所看日期；首页无 currentDate 时用 lastIdx。
export function anchorIndex(periods: string[], currentDate: string | undefined, lastIdx: number): number {
  if (!currentDate) return lastIdx;
  const i = periods.indexOf(currentDate);
  return i >= 0 ? i : lastIdx;
}
```

- [ ] **Step 4: 跑确认通过**：`npx vitest run src/viz/anchor.test.ts` → PASS
- [ ] **Step 5: 提交**：`git add src/viz/anchor.ts src/viz/anchor.test.ts && git commit -m "feat(viz): anchorIndex for river scrubber anchor"`

---

### Task 2: `RiverChart` — `showReadout`/`currentDate` props + 锚点 + `view-transition-name`

**Files:** Modify `src/components/RiverChart.tsx`

读现有文件。当前签名 `export default function RiverChart({ series }: Props)`，`interface Props { series: StreamSeries }`，组件内 `const lastIdx = Math.max(0, series.periods.length - 1); const [hoverIdx, setHoverIdx] = useState<number>(lastIdx);`，`onMouseLeave={() => setHoverIdx(lastIdx)}`，最外层 `<div style={{ position: 'relative', width: '100%', height: '100%', background: '...' }}>`，读数面板是最外层 div 内第二个子 `<div style={{ position:'absolute', top:'1rem', right:'1rem', ... minWidth:'13rem' ... }}>...</div>`。

- [ ] **Step 1: 加 import**（在顶部 import 区）

```tsx
import { anchorIndex } from '@/viz/anchor';
```

- [ ] **Step 2: 改 Props 与签名/锚点**

把 `interface Props { series: StreamSeries }` 改为：
```tsx
interface Props {
  series: StreamSeries;
  showReadout?: boolean;
  currentDate?: string;
}
```
把签名与前几行改为：
```tsx
export default function RiverChart({ series, showReadout = true, currentDate }: Props) {
  const lastIdx = Math.max(0, series.periods.length - 1);
  const anchorIdx = anchorIndex(series.periods, currentDate, lastIdx);
  const [hoverIdx, setHoverIdx] = useState<number>(anchorIdx);
```
把 overlay rect 的 `onMouseLeave={() => setHoverIdx(lastIdx)}` 改为 `onMouseLeave={() => setHoverIdx(anchorIdx)}`。

- [ ] **Step 3: 最外层 div 加 `viewTransitionName`**

把最外层 `<div style={{ position: 'relative', width: '100%', height: '100%', background: 'radial-gradient(ellipse at 50% 40%, #0e1520 0%, #060a10 100%)' }}>` 的 style 增加 `viewTransitionName: 'river-stream'`：
```tsx
    <div style={{ position: 'relative', width: '100%', height: '100%', viewTransitionName: 'river-stream', background: 'radial-gradient(ellipse at 50% 40%, #0e1520 0%, #060a10 100%)' }}>
```
（首页与当日条都用本组件，自动共用同名，无需改 page.tsx。）

- [ ] **Step 4: 读数面板按 `showReadout` 开关**

把读数面板整块（那个 `position:'absolute', top:'1rem', right:'1rem'` 的 `<div>...</div>`）用条件包起来：
```tsx
        {showReadout && (
          <div style={{ position: 'absolute', top: '1rem', right: '1rem', /* …原有样式不变… */ }}>
            {/* …原有读数面板内容不变… */}
          </div>
        )}
```
（仅在外层包 `{showReadout && (...)}`，内部样式与内容保持原样。）

- [ ] **Step 5: 类型 + 构建**：`npx tsc --noEmit && npm run build` → clean + `✓ Compiled successfully`
- [ ] **Step 6: 提交**：`git add src/components/RiverChart.tsx && git commit -m "feat(river): RiverChart showReadout/currentDate props + view-transition-name"`

---

### Task 3: `globals.css` — VT 缓动 + 条淡入

**Files:** Modify `src/app/globals.css`

- [ ] **Step 1: 追加样式**（在现有 `.rise-in` / `@keyframes riseIn` 之后）

```css
/* 河流条 opacity 入场（不加位移，避免与 view-transition 形变冲突） */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.fade-in { animation: fadeIn 0.5s ease both; }
@media (prefers-reduced-motion: reduce) { .fade-in { animation: none; } }

/* 河流命名形变（首页全屏 ↔ 当日页顶部条），仅支持的浏览器生效 */
::view-transition-group(river-stream) {
  animation-duration: 0.6s;
  animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}
```

- [ ] **Step 2: 构建**：`npm run build` → `✓ Compiled successfully`
- [ ] **Step 3: 提交**：`git add src/app/globals.css && git commit -m "feat(css): view-transition easing for river-stream + fade-in"`

---

### Task 4: `DailyRead` — `riverSeries` prop + sticky 顶部河流条 + rise-in 移到内容区

**Files:** Modify `src/components/DailyRead.tsx`

当前 `DailyRead` 是 server 组件：`interface Props { date; crossSection; items; signals; radar; }`；返回 `<main className="rise-in" style={{ minHeight:'100vh', background:'#08080e', color:'#ECE7DD' }}>` 内含 `<header style={NAV_STYLE}>…nav…</header>` 与紧随其后的内容容器 `<div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 28px' }}>…</div>`。

- [ ] **Step 1: 加 import**

```tsx
import RiverChart from '@/components/RiverChart';
import type { StreamSeries } from '@/viz/series';
```

- [ ] **Step 2: 加 prop**

把 `interface Props` 增加一行 `riverSeries: StreamSeries;`，并在解构里加 `riverSeries`：
```tsx
export default function DailyRead({ date, crossSection, items, signals, radar, riverSeries }: Props) {
```

- [ ] **Step 3: `<main>` 去掉 rise-in；nav 后插入 sticky 河流条；内容容器加 rise-in**

把 `<main className="rise-in" style={{ minHeight: '100vh', ... }}>` 改为 `<main style={{ minHeight: '100vh', ... }}>`（去掉 `className="rise-in"`）。
在 `</header>` 之后、内容容器 `<div style={{ maxWidth: 860, ... }}>` 之前，插入：
```tsx
      <div
        className="fade-in"
        style={{ position: 'sticky', top: 0, zIndex: 5, height: '14vh', minHeight: 96, borderBottom: '1px solid #1b1b26' }}
      >
        <RiverChart series={riverSeries} showReadout={false} currentDate={date} />
        <div style={{ position: 'absolute', left: 14, bottom: 8, fontSize: 11, color: '#c99', pointerEvents: 'none' }}>
          当前 {date} · 扫描或点击切换日期
        </div>
      </div>
```
把内容容器加上 `className="rise-in"`：
```tsx
      <div className="rise-in" style={{ maxWidth: 860, margin: '0 auto', padding: '40px 28px' }}>
```

- [ ] **Step 4: 类型 + 构建**：`npx tsc --noEmit && npm run build`（此时会因 day 路由还没传 `riverSeries` 而 tsc 报缺 prop —— 预期，下一任务补；可先只跑 `npx tsc --noEmit` 看到该报错，Task 5 完成后再一起绿）

> 注：Task 4 与 Task 5 是一对（新增必填 prop + 传参）。实现时可连续完成两者再统一验证；提交分开。

- [ ] **Step 5: 提交**：`git add src/components/DailyRead.tsx && git commit -m "feat(daily): sticky interactive top river strip; rise-in scoped to content"`

---

### Task 5: 当日页路由 — 构造 `riverSeries` 传入

**Files:** Modify `src/app/day/[date]/page.tsx`

当前文件并行加载 `getMentions()/getItemsForDay/getInterpretation/getRadar` 并 `buildCrossSection`，渲染 `<DailyRead date crossSection items signals radar />`。

- [ ] **Step 1: 加 import**

```tsx
import { getThreads } from '@/data/threads';
import { buildDailyStreamSeries, topTermGroups } from '@/viz/dailyStream';
```
（`getMentions` 已在从 `@/data/queries` 的导入中——确认 `getThreads` 来自 `@/data/threads`，其余按现状。）

- [ ] **Step 2: 构造 riverSeries 并传入**

在已有并行加载里把 `getThreads()` 一并取上（与现有 `Promise.all` 合并），构造 `riverSeries`，传给 `DailyRead`。例如：
```tsx
  const { date } = await params;
  const [mentions, items, signals, radar, threads] = await Promise.all([
    getMentions(),
    getItemsForDay(date),
    getInterpretation(date),
    getRadar(date),
    getThreads(),
  ]);
  const crossSection = buildCrossSection(mentions, date, { topN: 8 });
  const groups = threads.length ? threads : topTermGroups(mentions, 6);
  const riverSeries = buildDailyStreamSeries(mentions, groups);
  return <DailyRead date={date} crossSection={crossSection} items={items} signals={signals} radar={radar} riverSeries={riverSeries} />;
```
（若现有代码的加载写法不同，按等价方式合并即可——关键是新增 `getThreads()` 与 `riverSeries`，并把 `riverSeries` 传入 `DailyRead`。）

- [ ] **Step 3: 全量门禁**：`npx tsc --noEmit && npm test && npm run build` → tsc 干净、测试全绿、build 成功
- [ ] **Step 4: 提交**：`git add "src/app/day/[date]/page.tsx" && git commit -m "feat(daily): build riverSeries for the day-page top strip"`

---

### Task 6: 全量门禁 + 推送 + 线上回归

**Files:** 无（验证）

- [ ] **Step 1: 门禁**：`npx tsc --noEmit && npm test && npm run build` 全过
- [ ] **Step 2: 推送**：`git push origin main`
- [ ] **Step 3: 线上回归（Playwright，部署后）**
  - 首页点击河流某天 → 进入 `/day/[date]`：当日页**顶部有可交互河流条**、下方内容上浮入场；Chromium 下可见河流压缩形变（截图 + 录帧/连续截图）。
  - 在当日页**点击顶部条另一位置** → 切到另一天 `/day/[新date]`、scrubber 锚定新当前日、内容重新上浮。
  - 顶部条无读数面板、有"当前 {date} · 扫描或点击切换日期"提示。

---

## 备注
- `RiverChart` 同时被首页（全屏，`showReadout` 默认 true）与当日条（`showReadout=false`）使用，共用 `view-transition-name: river-stream` 构成形变对。
- 不动数据/平滑/流水线。
- VT 形变为渐进增强；不支持的浏览器走 `.rise-in` + `.fade-in` 兜底，功能不受影响。
