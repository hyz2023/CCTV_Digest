# 点击进入当日页：河流压缩动效 + 顶部可交互河流条 — 设计

**Goal:** 点击河流图某天进入当日页时，河流"压缩为顶部 context 条"+ 当日内容上浮淡入（~0.7s）；当日页常驻这条**可交互河流条**，用户在页内即可左右切换日期。

**范围:** 首页 River、当日页 `/day/[date]`、过渡动效。不动数据/流水线。

---

## 背景（当前）

- 首页 `page.tsx` 全屏 `RiverChart`（`series` 日级平滑）；点击 → `navigateToIdx` 内 `document.startViewTransition(() => router.push('/day/'+date))`，当日页 `DailyRead` 以 `.rise-in`（fade+translateY，globals.css `@keyframes riseIn`）入场。
- 当日页 `/day/[date]/page.tsx`：加载 mentions/items/signals/radar → `<DailyRead>`（nav + 横截面 + 雷达 + 晨报 + 三段式）。**没有河流条**。
- `RiverChart`：hover 扫描（`hoverIdx`，默认 `lastIdx`，`onMouseLeave` 回 `lastIdx`）+ 右上读数面板 + 点击 `navigateToIdx`。

## 设计

### 1. 当日页顶部「可交互河流条」

当日页结构改为：**nav → sticky 顶部河流条（height `14vh`，`minHeight:96px`）→ 当日内容（滚动）**。
- 河流条复用 `RiverChart`（同一份日级 `series`），靠容器高度变矮（SVG `preserveAspectRatio="none"` + `height:100%` 自适应）。
- **不显示读数面板**；条上只一行简提示：`当前 {date} · 扫描或点击切换日期`。
- 可交互：hover 移动 scrubber；点击另一天 → `router.push('/day/[新date]')`（复用 `navigateToIdx`）。
- scrubber 默认停在**当前所看日期**（不是 lastIdx）。

### 2. `RiverChart` 增强（支持"条"形态）

新增两个 props（默认保持首页现有行为）：
- `showReadout?: boolean`（默认 `true`）：`false` 时不渲染右上读数面板及其内部 hint。
- `currentDate?: string`：作为锚点——`anchorIdx = currentDate ? (periods.indexOf(currentDate) 取到则用之，否则 lastIdx) : lastIdx`；`useState` 初值与 `onMouseLeave` 复位都用 `anchorIdx`（首页不传 currentDate → 仍为 lastIdx，行为不变）。
- 锚点计算抽成纯函数 `anchorIndex(periods, currentDate, lastIdx)`（`src/viz/anchor.ts`，可单测）。
- 河流外层容器加 `viewTransitionName: 'river-stream'`（首页与当日条共用同名，供动效①形变）。

### 3. 进入动效（首页全屏 → 当日条）

- **① View Transitions 命名形变（渐进增强）**：首页河流与当日条河流共用 `view-transition-name: river-stream`；点击已在 `startViewTransition` 内 `router.push` → 支持的浏览器（Chromium）把河流从"全屏"形变压缩到"顶部条"。`globals.css` 加 `::view-transition-group(river-stream)` 缓动（~0.6s `cubic-bezier(.22,1,.36,1)`）。
- **② CSS 入场兜底（可靠基线）**：`.rise-in`（fade + translateY 上浮）**只作用于条下方的当日内容区**（不再挂在整个 `<main>`）；顶部条入场用**纯 opacity 淡入**（不加 translateY/scale，避免与动效① 的命名形变打架）。即使浏览器不支持 VT 形变，也得到"内容上浮淡入 + 河流条淡入"的干净入场。
- 采用 **①为主 + ②兜底**：功能在所有浏览器都成立，Chromium 上额外获得真形变。

### 4. 当日页内"切日"（点顶部条）

点条上另一天 → `startViewTransition(router.push('/day/[新date]'))`：河流条已是条（同名 → 几乎不动/平滑），**当日内容重新 `.rise-in` 上浮淡入**（~0.4-0.5s，复用同一动画）。连续切日顺滑。

## 涉及文件

- 改 `src/components/RiverChart.tsx`：加 `showReadout`/`currentDate` props、`anchorIndex`、`viewTransitionName`。
- 改 `src/components/DailyRead.tsx`：加 `riverSeries: StreamSeries` prop；nav 后渲染 sticky 顶部条（`<RiverChart series={riverSeries} showReadout={false} currentDate={date} />` + 简提示，条用纯 opacity 淡入）；把 `.rise-in` 从 `<main>` 移到条下方的内容区包裹元素。
- 改 `src/app/day/[date]/page.tsx`：并行加载 `getThreads()`+`getMentions()` → `buildDailyStreamSeries` 得 `riverSeries`，传给 `DailyRead`（与首页同一构造）。
- 改 `src/app/page.tsx`：首页河流容器加 `viewTransitionName:'river-stream'`。
- 改 `src/app/globals.css`：`::view-transition-group(river-stream)` 缓动；保留 `.rise-in`。
- 新增 `src/viz/anchor.ts`（+ `anchor.test.ts`）：`anchorIndex(periods, currentDate, lastIdx)`。

## 数据流

当日页：`getThreads()`+`getMentions()` → `buildDailyStreamSeries` → `riverSeries` → `DailyRead` 顶部条 `RiverChart`（`showReadout=false`, `currentDate=date`，scrubber 锚定当前日；点击切日）。

## 边界

- `currentDate` 不在 `periods` 中（该日无数据点）→ `anchorIndex` 回退 `lastIdx`。
- 浏览器不支持 `startViewTransition`/`view-transition-name` → 走 `.rise-in` 兜底（已有 `typeof d.startViewTransition === 'function'` 守卫）。
- `prefers-reduced-motion`：`.rise-in` 已在该媒体查询下禁用；VT 形变浏览器自身也会尊重该设置。

## 测试

- `anchorIndex`：命中/未命中/空 periods/越界 → 单测（TDD）。
- 动效与交互（条可 hover/点击切日、内容上浮、Chromium 形变）：Playwright 截图 + 交互实测（点首页河流→当日页有顶部条；点顶部条→切到另一天）。

## 不在范围

- 数据/平滑/流水线不变。
- 顶部条不带读数面板（完整读数留首页全屏河流）。
