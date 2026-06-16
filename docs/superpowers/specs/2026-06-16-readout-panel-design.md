# River 读数面板：信号化 + 对齐 — 设计

**Goal:** 把 River hover 读数面板里每条主线后面那串无意义长小数（7 天平滑原始计数，如 `3.7142857142857144`），替换为可读的「档位（强/中/弱）+ 趋势箭头（↑/→/↓）」，并用固定列网格对齐。

**范围:** 仅 `RiverChart` 的读数面板呈现。不动底层数据/平滑（`SMOOTH_WINDOW` 不变），不动 `/day` 页。

---

## 背景（当前）

`src/components/RiverChart.tsx` 的读数面板：对 hover 当天，`crossSection = series.streams.map(st => ({term, color, value: st.values[hoverIdx] ?? 0})).sort(desc)`，每行渲染主线名 + 原始 `{value}`（16 位浮点）+ 相对条（宽度 `value/maxValue`）。`maxValue = Math.max(1, ...当天各值)`。长小数无单位、难懂；右侧用 `space-between`，箭头/标签跟着名字长短参差。

## 设计

**每行布局**（去掉原始数字）：固定列网格
`grid-template-columns: 1fr 16px 30px`（列间距 ~10px）：
- 列1 主线名（弹性，`overflow:hidden;text-overflow:ellipsis;white-space:nowrap`，用主线色）
- 列2 趋势箭头（居中，成列对齐）
- 列3 档位标签（居中，小号、描边）
行下方保留**相对条**（宽度 = `value/dayMax`，主线色），跨整行宽。按当前值降序排列不变。

**① 档位 `levelOf(value, dayMax)` → '强' | '中' | '弱'**（相对当天最强）：
- `ratio = dayMax > 0 ? value/dayMax : 0`
- `ratio >= LEVEL_STRONG(0.66)` → 强；`>= LEVEL_MID(0.33)` → 中；否则 弱。
- 颜色：强 `#e0436b`、中 `#fbbf24`、弱 `#64748b`。

**② 趋势 `trendOf(values, idx, {lookback, deadband, dayMax})` → 'up' | 'flat' | 'down'**（今天 vs ~14 天前）：
- `past = values[Math.max(0, idx - lookback)]`（历史不足时取最早值）
- `delta = (values[idx] ?? 0) - past`
- `|delta| < deadband * dayMax` → 'flat'；否则 `delta > 0` → 'up'，`< 0` → 'down'。
- 箭头/颜色：up `↑ #4ade80`、flat `→ #7a8699`、down `↓ #f87171`。

**常量**（集中在 `src/viz/readout.ts`，便于调）：
`TREND_LOOKBACK = 14`、`TREND_DEADBAND = 0.15`、`LEVEL_STRONG = 0.66`、`LEVEL_MID = 0.33`。

## 涉及文件

- 新增：`src/viz/readout.ts`（+ `readout.test.ts`）——导出 `levelOf`、`trendOf`、上述常量、类型 `Level='强'|'中'|'弱'`、`Trend='up'|'flat'|'down'`。纯函数。
- 改：`src/components/RiverChart.tsx`——
  - 读数行改为从 `series.streams`（含完整 `values[]`）+ `hoverIdx` 构造：`{term, color, value: values[hoverIdx]??0, level: levelOf(value, dayMax), trend: trendOf(values, hoverIdx, {lookback:TREND_LOOKBACK, deadband:TREND_DEADBAND, dayMax})}`，按 value 降序。
  - `dayMax` 复用现有 `maxValue`（`Math.max(1, ...当天各值)`，已防 /0）。
  - 渲染改为上述网格布局；**删除原始 `{value}` 文本**；保留条形 + 顶部日期 + "点击进入当日解读"。

## 数据流

`series.streams[].values`（已是日级平滑）+ `hoverIdx` →（RiverChart 内）`levelOf`/`trendOf` → 网格渲染。无新数据依赖。

## 边界

- 历史不足 14 天：与最早值比较（`Math.max(0, idx-lookback)`）。
- 全 0 当天：`dayMax` 被 `Math.max(1,…)` 兜底为 1 → 全部"弱"、趋势按 delta（多为 flat）。
- `values[idx]` 越界：`?? 0`。

## 测试

- `levelOf`：边界 0.66 / 0.33、dayMax=0、ratio=1。
- `trendOf`：up/down/flat（死区内）、idx<lookback 取最早值、越界 `??0`。
- 面板渲染（网格对齐、无长小数、箭头/档位成列）：Playwright 截图实测。

## 不在范围

- 底层数据与平滑窗口（`SMOOTH_WINDOW`）不变。
- `/day` 页"今日横截面"（已是日级，另案）。
- 档位若将来想改为"相对该主线自身历史"而非"相对当天最强"——本期采用相对当天最强（更直观、实现简单），留作后续可选。
