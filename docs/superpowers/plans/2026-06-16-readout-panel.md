# River 读数面板信号化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 River hover 读数面板每条主线后面的原始长小数，换成「档位（强/中/弱）+ 趋势箭头（↑/→/↓）」并用固定列网格对齐。

**Architecture:** 新增纯函数 `src/viz/readout.ts`（`levelOf`/`trendOf` + 阈值常量），`RiverChart` 读数面板用它们计算每行的档位/趋势、改为 `grid 1fr 16px 30px` 布局、删除原始数字、保留相对条。无新数据依赖（用现有 `series.streams[].values` + `hoverIdx`）。

**Tech Stack:** React 19 client component、TypeScript、Vitest。`@/`→`./src`，单测 `npx vitest run <path>`，全套 `npm test`，类型 `npx tsc --noEmit`，构建 `npm run build`。

---

### Task 1: `src/viz/readout.ts` 纯函数（levelOf / trendOf / 常量）

**Files:**
- Create: `src/viz/readout.ts`
- Test: `src/viz/readout.test.ts`

- [ ] **Step 1: 写失败测试** `src/viz/readout.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { levelOf, trendOf, TREND_LOOKBACK } from './readout';

describe('levelOf (相对当天最强)', () => {
  it('强：>=66%', () => { expect(levelOf(7, 10)).toBe('强'); expect(levelOf(6.6, 10)).toBe('强'); });
  it('中：>=33% 且 <66%', () => { expect(levelOf(5, 10)).toBe('中'); expect(levelOf(3.3, 10)).toBe('中'); });
  it('弱：<33%', () => { expect(levelOf(3.2, 10)).toBe('弱'); expect(levelOf(0, 10)).toBe('弱'); });
  it('dayMax=0 视为弱（防除零）', () => { expect(levelOf(0, 0)).toBe('弱'); });
});

describe('trendOf (今天 vs ~14 天前，死区 15%×dayMax)', () => {
  const dayMax = 10; // 死区 = 1.5
  it('up：超出死区且为正', () => {
    const v = [2,2,2,2,2,2,2,2,2,2,2,2,2,2,9]; // idx14 vs idx0=2 → +7
    expect(trendOf(v, 14, { dayMax })).toBe('up');
  });
  it('down：超出死区且为负', () => {
    const v = [9,9,9,9,9,9,9,9,9,9,9,9,9,9,2];
    expect(trendOf(v, 14, { dayMax })).toBe('down');
  });
  it('flat：变化在死区内', () => {
    const v = [5,5,5,5,5,5,5,5,5,5,5,5,5,5,6]; // +1 < 1.5
    expect(trendOf(v, 14, { dayMax })).toBe('flat');
  });
  it('历史不足 lookback 时与最早值比较', () => {
    expect(trendOf([2, 8], 1, { dayMax })).toBe('up'); // past=v[0]=2, +6
  });
  it('越界 idx 取 0', () => {
    expect(trendOf([5, 5], 9, { dayMax })).toBe('down'); // now=0, past=v[0]=5 → -5
  });
  it('暴露默认 lookback 常量', () => { expect(TREND_LOOKBACK).toBe(14); });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/viz/readout.test.ts`
Expected: FAIL（模块/导出不存在）

- [ ] **Step 3: 实现** `src/viz/readout.ts`

```ts
export const TREND_LOOKBACK = 14;
export const TREND_DEADBAND = 0.15;
export const LEVEL_STRONG = 0.66;
export const LEVEL_MID = 0.33;

export type Level = '强' | '中' | '弱';
export type Trend = 'up' | 'flat' | 'down';

// 档位：相对当天最强主线。dayMax<=0 时一律弱（防除零）。
export function levelOf(value: number, dayMax: number): Level {
  const ratio = dayMax > 0 ? value / dayMax : 0;
  if (ratio >= LEVEL_STRONG) return '强';
  if (ratio >= LEVEL_MID) return '中';
  return '弱';
}

// 趋势：今天平滑值 vs ~lookback 天前；|Δ| < deadband×dayMax 记为持平。
// 历史不足则与最早值比较；越界取 0。
export function trendOf(
  values: number[], idx: number,
  opts: { lookback?: number; deadband?: number; dayMax: number },
): Trend {
  const lookback = opts.lookback ?? TREND_LOOKBACK;
  const deadband = opts.deadband ?? TREND_DEADBAND;
  const past = values[Math.max(0, idx - lookback)] ?? 0;
  const delta = (values[idx] ?? 0) - past;
  if (Math.abs(delta) < deadband * opts.dayMax) return 'flat';
  return delta > 0 ? 'up' : 'down';
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/viz/readout.test.ts`
Expected: PASS（全部）

- [ ] **Step 5: 提交**

```bash
git add src/viz/readout.ts src/viz/readout.test.ts
git commit -m "feat(viz): readout levelOf/trendOf (档位+趋势) pure helpers"
```

---

### Task 2: `RiverChart` 读数面板改信号化 + 列对齐

**Files:**
- Modify: `src/components/RiverChart.tsx`

当前读数相关代码（供定位）：
```tsx
import { computeStreamPaths } from '@/viz/stream';
...
  const crossSection = series.streams
    .map((st) => ({ term: st.term, color: st.color, value: st.values[hoverIdx] ?? 0 }))
    .sort((a, b) => b.value - a.value);

  const maxValue = Math.max(1, ...crossSection.map((c) => c.value));
  const hoverPeriod = series.periods[hoverIdx] ?? '';
```
读数面板里现有的行渲染：
```tsx
        {crossSection.map(({ term, color, value }) => (
          <div key={term} style={{ marginBottom: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
              <span style={{ color }}>{term}</span>
              <span style={{ color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
            </div>
            <div style={{ height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${(value / maxValue) * 100}%`,
                  background: color,
                  borderRadius: '2px',
                  transition: 'width 0.15s ease',
                }}
              />
            </div>
          </div>
        ))}
```

- [ ] **Step 1: 加导入 + 呈现映射常量**

在文件顶部 import 区追加：
```tsx
import { levelOf, trendOf } from '@/viz/readout';
import type { Level, Trend } from '@/viz/readout';
```
在组件函数体外（顶部常量区，紧邻 `const SVG_W = 1000` 附近）加呈现映射：
```tsx
const ARROW: Record<Trend, string> = { up: '↑', flat: '→', down: '↓' };
const ARROW_COLOR: Record<Trend, string> = { up: '#4ade80', flat: '#7a8699', down: '#f87171' };
const LEVEL_COLOR: Record<Level, string> = { '强': '#e0436b', '中': '#fbbf24', '弱': '#64748b' };
```

- [ ] **Step 2: 替换 crossSection / maxValue 计算块**

把上面定位到的 `crossSection`/`maxValue` 计算替换为（先算 `dayMax`，再带上 level/trend；删除 `maxValue`）：
```tsx
  const dayMax = Math.max(1, ...series.streams.map((st) => st.values[hoverIdx] ?? 0));
  const crossSection = series.streams
    .map((st) => {
      const value = st.values[hoverIdx] ?? 0;
      return {
        term: st.term,
        color: st.color,
        value,
        level: levelOf(value, dayMax),
        trend: trendOf(st.values, hoverIdx, { dayMax }),
      };
    })
    .sort((a, b) => b.value - a.value);

  const hoverPeriod = series.periods[hoverIdx] ?? '';
```

- [ ] **Step 3: 替换行渲染为网格布局（删除原始数字）**

把上面定位到的 `{crossSection.map(...)}` 整块替换为：
```tsx
        {crossSection.map(({ term, color, value, level, trend }) => (
          <div key={term} style={{ marginBottom: '0.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 16px 30px', alignItems: 'center', columnGap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{term}</span>
              <span style={{ textAlign: 'center', fontWeight: 700, color: ARROW_COLOR[trend] }}>{ARROW[trend]}</span>
              <span style={{ textAlign: 'center', fontSize: '0.62rem', borderRadius: '4px', padding: '1px 0', color: LEVEL_COLOR[level], border: `1px solid ${LEVEL_COLOR[level]}55` }}>{level}</span>
            </div>
            <div style={{ height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${(value / dayMax) * 100}%`,
                  background: color,
                  borderRadius: '2px',
                  transition: 'width 0.15s ease',
                }}
              />
            </div>
          </div>
        ))}
```

- [ ] **Step 4: 面板宽度微调（容纳网格）**

读数面板外层 div 现有 `minWidth: '11rem'`，改为 `minWidth: '13rem'`（给名字列 + 两列留空间）。其余面板样式不变。

- [ ] **Step 5: 类型 + 构建**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc 无输出；build `✓ Compiled successfully`

- [ ] **Step 6: 提交**

```bash
git add src/components/RiverChart.tsx
git commit -m "feat(river): readout shows level + trend (列对齐), drops raw decimals"
```

---

### Task 3: 全量门禁 + 推送 + 线上回归

**Files:** 无（验证）

- [ ] **Step 1: 全套门禁**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc 无输出；vitest 全绿；build 成功

- [ ] **Step 2: 推送**

```bash
git push origin main
```

- [ ] **Step 3: 线上回归（Playwright，部署完成后）**

首页 `https://cctv-digest.vercel.app/`，hover River：读数面板每行显示 `主线名 … 箭头 档位`、箭头与档位**成列对齐**、**无长小数**、相对条仍在；不同位置 hover 趋势箭头会变。

---

## 备注
- 不动底层数据/平滑（`SMOOTH_WINDOW`）与 `/day` 页。
- 档位"相对当天最强"为本期取舍；"相对主线自身历史"留作后续可选。
