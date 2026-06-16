# River 页面优化：按日河流 + 一屏布局 — 设计

**Goal:** 把首页 River 从"按月"改为"按日 + 平滑"展示，并将整页压到一屏内、以河流图为主体。

**范围:** 仅首页 River 及其点击进入的 `/day` 横截面的相关改动。`validateTranscript` 加固是另一独立任务，不在本设计内。

---

## 背景（当前状态）

- 首页 `src/app/page.tsx` 用 `getThreadStreamSeries()` 读 `thread` + `thread_point`（`thread_point.period` = **月度** `YYYY-MM`），经 `threadPointsToStreamSeries` 得到 `StreamSeries`，交给 `RiverChart` 渲染。x 轴是月份。
- 点击 River：上一版已加 `buildPeriodDateMap`（月 → 该月最近一天）+ `RiverChart` onClick → `/day/[date]`。
- 布局：`header`（导航）+ 标题块（kicker + h1 + 一段说明）+ River 容器 `height:60vh`。整页超出一屏。
- `RiverChart` 的 SVG `viewBox 0 0 1000 600`、`preserveAspectRatio="none"`、`width:100% height:auto` → 高度被 viewBox 比例锁定，不随容器高度伸缩。
- `/day` 页"今日横截面"用 `buildCrossSection(mentions, date)`，内部按 **`month(date)`** 聚合——即显示的是整月，不是当天。

---

## 变更 1：按日 + 平滑（采用方案 1 — 首页实时聚合）

**不动 schema、不改流水线、不重跑 synthesize。** 在首页用日级 `tifa_mention` 按各主线成员词实时聚合，并做平滑。`thread_point`（月度）保留不动（不再喂 River，但无害）。

**新增纯函数**（`src/viz/dailyStream.ts`）：

```ts
export interface TermGroup { name: string; color: string; terms: string[] }
// 居中滚动平均，窗口 = SMOOTH_WINDOW（常量，默认 7）；边缘用可用范围（收缩窗口）
export function rollingMean(values: number[], window: number): number[]
// 由"带标签的词组"在日级 mentions 上聚合 → 平滑 → StreamSeries（periods = 升序日期 YYYY-MM-DD）
export function buildDailyStreamSeries(
  mentions: Mention[], groups: TermGroup[], opts?: { window?: number },
): StreamSeries
```

- `periods` = mentions 里出现过的全部日期（升序，`YYYY-MM-DD`）。
- 每个 group 的当日强度 = 该日 `term ∈ group.terms` 的 `count` 之和；再对整条序列做 `rollingMean(·, 7)`。
- 复用现有 `StreamSeries`（`{ periods, streams:[{term,color,values}] }`），`term` 存主线名（与现状一致）。

**常量**：`export const SMOOTH_WINDOW = 7;`（集中、好调）。

**首页数据流**（`src/app/page.tsx`）：
- 新增数据查询 `getThreads()`（`src/data/threads.ts`）：`select name,color,meta from thread` → `TermGroup[]`（`terms = meta.memberTerms`）。
- 取 `getThreads()` 与 `getMentions()`：
  - 有主线 → `buildDailyStreamSeries(mentions, threadGroups, {window:7})`。
  - 无主线（空库/sample）→ 用 top-N（6）提法各自作为单词组的 `TermGroup[]` 兜底，仍走 `buildDailyStreamSeries`（日级 + 平滑）。
- **移除 `buildPeriodDateMap` / `periodDate` 链路**：x 轴已是真实日期，`RiverChart` 点击直接用 `series.periods[idx]`（即 `YYYY-MM-DD`）跳 `/day/[date]`，无需月→日映射。
- 保留 hover 扫描 + 右上读数面板（读数=各主线当日平滑强度）+ 左下系统管理。

**`RiverChart` 改动**（`src/components/RiverChart.tsx`）：
- `periodDate` 入参删除；点击直接 `router.push('/day/' + series.periods[idx])`（带 View Transition，逻辑不变）。
- `hoverPeriod` 现在是日期字符串，读数面板标题显示该日期。

## 变更 2：一屏布局（方案 A — 紧凑分区）

`src/app/page.tsx`：
- 外层 `main`：`display:flex; flex-direction:column; height:100dvh; overflow:hidden`。
- 三段：① 细顶栏（导航，沿用现样式）；② **精简标题块**（kicker + 缩小的 h1 `clamp(22px,3vw,40px)`，去掉原多行说明，至多保留一行短副标题）；③ River 容器 `flex:1; min-height:0`。
- 三者合计 = `100dvh`（用 `dvh` 兼容移动端地址栏），整页**不滚动**。

`src/components/RiverChart.tsx`：
- 外层容器与 SVG 改为**填满父高度**：容器 `height:100%`，SVG `width:100%; height:100%`（保留 `preserveAspectRatio="none"`，让河流纵向铺满 `flex:1` 区域）。

## 变更 3：`/day` "今日横截面"改为真·当天

`src/viz/series.ts` `buildCrossSection`：聚合条件由 `month(m.day) !== period` 改为 `m.day !== date`（精确当天），返回的 `CrossSection.period` 字段一并改为 `date`（即 `YYYY-MM-DD`）。其单测同步更新。这样 `/day` 页"今日横截面"名副其实显示当天提法。

---

## 涉及文件

- 新增：`src/viz/dailyStream.ts`（+ `dailyStream.test.ts`）
- 改：`src/app/page.tsx`、`src/components/RiverChart.tsx`、`src/data/threads.ts`（加 `getThreads`）、`src/viz/series.ts`（`buildCrossSection` 改日级）
- 删：`src/viz/period.ts` + `period.test.ts`（`buildPeriodDateMap` 不再需要）；`src/data/queries.ts` 的 `getBroadcastDates`（仅服务于已删的 `periodDate`，连同其在首页的调用一并移除）

## 数据流

`getThreads()` + `getMentions()` →（首页）`buildDailyStreamSeries` → `StreamSeries`(日级,平滑) → `RiverChart`（hover 读当日 / click → `/day/[当日]`）→ `/day` 页 `buildCrossSection`(当天) + 既有信号/雷达/三段式。

## 边界与兜底

- 空库/无主线：top-提法日级兜底，仍渲染（sample mentions 偏稀疏，平滑后形态一般，仅 demo）。
- 单日/极少数据：`rollingMean` 退化为原值，安全。
- 全年 366 日 × 8 主线聚合：毫秒级；如需再加缓存（YAGNI，暂不做）。

## 测试

- 纯函数 TDD：`rollingMean`（窗口、边缘收缩、奇偶）、`buildDailyStreamSeries`（按日聚合、成员词归组、periods 升序、平滑生效）、`buildCrossSection`（当天过滤）。
- 布局：`100dvh` 不滚动、River 填满——Playwright 截图实测（含点击 River → 当日页）。

## 不在范围

- `validateTranscript` 拒绝导航占位页/过短稿的加固（已获批，独立任务，单独实现）。
- `thread_point` 月度表的去留/迁移（保留不动）。
