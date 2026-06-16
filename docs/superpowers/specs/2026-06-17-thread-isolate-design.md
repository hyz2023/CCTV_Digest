# River 单主线隔离（"从河里捞起摊平看趋势"）— 设计

**Goal:** 在全屏 River 首页，悬停某条主线 dwell 后把它**原地柔和形变**成"从 0 基线起的面积"（其余淡出），让单条主线的时间趋势从难读的"厚度"变成易读的"高度"；移开沉回。交付需有设计质感。

**范围:** 仅首页全屏 River；当日页顶部条不启用。不动数据/流水线。

---

## 背景（当前）

`RiverChart`（client）：`computeStreamPaths(series.streams, dims)`（`src/viz/stream.ts`，平滑 Catmull-Rom 曲线，内部算各流 tops/bots 边点）渲染堆叠带子 + 覆盖 `<rect>` 捕获 `onMouseMove`（驱动 scrubber/读数）+ 点击经 `useTransitionRouter` 进当日页。首页 `<RiverChart series={series} />`（showReadout 默认 true）；当日页条 `<RiverChart series={riverSeries} showReadout={false} currentDate={date} />`。覆盖 rect 在最上层捕获事件——所以"光标在哪条流上"要从指针位置**命中测试**算（不能靠各 band 的 pointer 事件）。

## 行为

- **启用范围**：新增 `enableIsolate?: boolean`（默认 `true`）。首页用默认；当日页条传 `enableIsolate={false}`（14vh 太矮、只管切日）。
- **命中测试**：`onMouseMove` 已得 `idx`（x→日期）。再由事件算 SVG 内 `y`，用 `hitStream(geom, idx, y)` 求光标落在哪条流（按该 idx 处各流 top/bot 区间判断），返回流下标或 -1。
- **触发（dwell）**：同一条流连续悬停 **~400ms** → 进入隔离。dwell 期间该流轻微变亮（`brightness` 渐增，"捞起"预感）；中途换流或离开则重置计时。
- **隔离形变**：被选流的路径从"堆叠边点"**连续插值**到"摊平边点"（顶=从 0 基线起的值曲线、底=基线），`progress` 0→1。节奏沿用已确认的柔和感：rAF 指数逼近 `p += (target-p)*0.09`（约 0.6–0.7s 收敛），`prefers-reduced-motion` 下直接置 1（不插值）。其余流 `opacity = 1-0.92·progress` 并轻去饱和。
- **隔离态**：光标横移 → "今天/所指日"点 ◆ 沿摊平曲线移动，读出该日数值；**隐藏多主线读数面板**（聚焦单条时它无意义）。
- **解除**：光标移出图表 → `progress`→0 平滑沉回，回到 0 后清除 isolatedIdx，恢复读数面板。换一条＝移出再 dwell。
- 点击行为不变（仍进当日页）。

## 设计质感（硬要求）

- **摊平面积**：竖向**线性渐变**填充（主线色 @top → 透明 @基线，经 `<linearGradient>`）；顶部叠一条**清晰描边曲线**（主线色，~2px），而非平涂。
- **标记**：峰值 = 细圆环（描边、无填充）+ 极小右侧数值；今天/所指日 = 实心点 + 日期小标签；均小号、低饱和、留白充足。
- **轻刻度**：0 基线 + 峰值线为极淡虚线，右对齐小号数值（0 与峰值）。
- **其余流**：淡出 + 轻去饱和（`filter: saturate(.5)`，不突兀消失）。
- **主线名**：左上、衬线（`.serif`）、克制。
- 形变与标注**淡入同步**，缓动柔和；尊重 `prefers-reduced-motion`（跳过形变，直接淡入摊平态）。

## 架构（保持文件聚焦、纯函数优先）

**`src/viz/stream.ts`（重构，DRY）**
- 抽出 `export function computeStreamGeometry(streams, dims): StreamGeometry`，返回 `{ xs:number[]; tops:Pt[][]; bots:Pt[][]; cy:number; scaleY:number; maxTotal:number }`。
- `computeStreamPaths` 改为基于 `computeStreamGeometry` + `curve` 构建（行为不变，现有测试须仍绿）。
- `export` 现有 `curve(points: Pt[], move: boolean): string` 与 `Pt`/`Dims` 类型，供 focus 复用（形变路径同样平滑）。

**`src/viz/focus.ts`（新，纯函数 + TDD）**
- `hitStream(geom: StreamGeometry, idx: number, y: number): number` — 返回 `tops[s][idx].y <= y <= bots[s][idx].y` 的流下标，否则 -1。
- `flattenedTop(values: number[], xs: number[], floorY: number, usableH: number): Pt[]` — `y = floorY - value/maxValue * usableH`。
- `morphIsolatedPath(stackedTop: Pt[], stackedBot: Pt[], flatTop: Pt[], floorY: number, progress: number): string` — 逐点 `lerp` top（stacked→flat）与 bot（stacked→floorY），再用 `curve` 拼平滑 `d`（`progress=0` 即原堆叠路径、`=1` 即摊平面积）。
- `peakIndex(values: number[]): number`。

**`src/components/RiverChart.tsx`**
- hover 时算 `idx`+`y` → `hitStream`；dwell 计时 + rAF 推进 `progress`；`isolatedIdx` 状态。
- 渲染：堆叠带子（`progress>0` 时非隔离流淡出/去饱和）+ 隔离流的 `morphIsolatedPath` 面积（渐变填充 + 顶描边）+ 标注组（`opacity=progress`）；`progress>0` 时隐藏多主线读数面板。
- `enableIsolate=false` 时完全保持现状（当日页条不受影响）。
- 隔离的状态与渲染抽到 **`useStreamFocus` hook**（dwell/progress/isolatedIdx）+ **`StreamFocus` 子组件**（给定 geom/isolatedIdx/progress/hoverIdx 渲染摊平面积与标注），避免 RiverChart 过大。

**`src/components/DailyRead.tsx`**：顶部条 `<RiverChart ... enableIsolate={false} />`。

## 数据流

`series.streams` →（RiverChart）`computeStreamGeometry` → 堆叠渲染 + hover `hitStream` → dwell → `useStreamFocus`(progress) → `StreamFocus`(`morphIsolatedPath`/`flattenedTop`/`peakIndex`) 渲染摊平面积 + 标注。

## 边界

- 命中落在空隙/无流 → -1，不触发。
- 单一 period（`n<=1`）或空 series → 不隔离（无意义）。
- `prefers-reduced-motion` → progress 直接置目标值。
- 隔离中 series 不变（首页 force-dynamic 每次渲染新 series；隔离是纯前端交互态）。

## 测试

- 纯函数 TDD：`computeStreamGeometry`（边点/scaleY）、`computeStreamPaths` 重构后**现有测试仍绿**、`hitStream`（y 落在正确流 / 空隙 -1）、`flattenedTop`（端点/比例）、`morphIsolatedPath`（progress 0=堆叠、1=摊平、端点）、`peakIndex`。
- 交互 + 质感：Playwright 实测（dwell 隔离、摊平形态含渐变/描边/峰值/今日点、移出复位、当日页条不受影响）+ 截图。

## 不在范围

- 数据/平滑/流水线、当日页条的隔离（明确关闭）。
- 与 `/thread/[id]` 详情页的关系（隔离是轻量"就地看趋势"，不替代详情页）。
