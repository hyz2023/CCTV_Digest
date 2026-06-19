# Radar Section Style Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat, single-color radar event list with a structured icon-column layout (E-2) where each event type has a distinct color, tinted icon column, and a proportional magnitude bar.

**Architecture:** Add a `radarStyle()` lookup to `src/data/labels.ts` (one config object per event type: foreground color, column background, track color, short label). Then rewrite the radar `<section>` in `DailyRead.tsx` to use the new two-column row structure. No new files, no new components, no data-layer changes.

**Tech Stack:** React (inline styles, no CSS modules), TypeScript, Vitest for the labels config test.

---

### Task 1: Add `radarStyle()` config to `src/data/labels.ts`

**Files:**
- Modify: `src/data/labels.ts`
- Test: `src/data/labels.test.ts`

- [ ] **Step 1: Write the failing tests** — add to the existing `describe('display labels')` block in `src/data/labels.test.ts`:

```typescript
// add this import at the top of the existing import line:
// import { radarLabel, radarIcon, radarStyle, confidenceLabel, polarityLabel, polarityColor } from './labels';

it('returns style config for known radar types', () => {
  const up = radarStyle('drumbeat_up');
  expect(up.fg).toBe('#4ade80');
  expect(up.short).toBe('升温');

  const down = radarStyle('drumbeat_down');
  expect(down.fg).toBe('#f87171');
  expect(down.short).toBe('降温');

  const tifa = radarStyle('new_tifa');
  expect(tifa.fg).toBe('#f5c842');
  expect(tifa.short).toBe('首现');
});

it('returns fallback style for unknown radar types', () => {
  const unknown = radarStyle('mystery');
  expect(unknown.fg).toBe('#8a8a98');
  expect(unknown.short).toBe('变化');
});
```

Also update the import line at the top of `src/data/labels.test.ts` to include `radarStyle`:

```typescript
import { radarLabel, radarIcon, radarStyle, confidenceLabel, polarityLabel, polarityColor } from './labels';
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/data/labels.test.ts
```

Expected: FAIL — `radarStyle is not a function` (or similar import error).

- [ ] **Step 3: Add `radarStyle` to `src/data/labels.ts`**

Append the following after the existing `RADAR_LABELS` block (after the `radarIcon` function, before `CONFIDENCE_LABELS`):

```typescript
interface RadarTypeStyle {
  fg: string;
  colBg: string;
  colBorder: string;
  trackBg: string;
  short: string;
}

const RADAR_STYLE: Record<string, RadarTypeStyle> = {
  new_tifa:      { fg: '#f5c842', colBg: '#141108', colBorder: '#1e1a08', trackBg: '#1e1a08', short: '首现' },
  drumbeat_up:   { fg: '#4ade80', colBg: '#0b1a10', colBorder: '#0e2018', trackBg: '#1a2e1a', short: '升温' },
  drumbeat_down: { fg: '#f87171', colBg: '#180b0b', colBorder: '#200e0e', trackBg: '#2e1a1a', short: '降温' },
  order_jump:    { fg: '#38bdf8', colBg: '#081520', colBorder: '#0a1e2e', trackBg: '#0a1e2e', short: '前移' },
  flip:          { fg: '#c084fc', colBg: '#130a1c', colBorder: '#180e22', trackBg: '#180e22', short: '翻转' },
};

const RADAR_STYLE_DEFAULT: RadarTypeStyle = {
  fg: '#8a8a98', colBg: '#0d0d16', colBorder: '#1b1b26', trackBg: '#1b1b26', short: '变化',
};

export function radarStyle(type: string): RadarTypeStyle {
  return RADAR_STYLE[type] ?? RADAR_STYLE_DEFAULT;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/data/labels.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/labels.ts src/data/labels.test.ts
git commit -m "feat(labels): add radarStyle() config for E-2 icon-column design"
```

---

### Task 2: Rewrite radar section in `DailyRead.tsx`

**Files:**
- Modify: `src/components/DailyRead.tsx` (lines 1–4 import block; lines 105–123 radar section; add one derived variable before `return`)

No unit tests for this task — it is pure JSX layout. Manual verification via dev server (see Step 4).

- [ ] **Step 1: Add `radarStyle` to the import at the top of `DailyRead.tsx`**

Current line 3:
```typescript
import { radarLabel, radarIcon } from '@/data/labels';
```

Replace with:
```typescript
import { radarLabel, radarIcon, radarStyle } from '@/data/labels';
```

- [ ] **Step 2: Add `maxMagnitude` derived variable before the `return` statement**

Inside the `DailyRead` function, after the existing `const maxVal = ...` line (line 43), add:

```typescript
const maxMagnitude = Math.max(
  1,
  ...radar.filter((r) => r.magnitude != null).map((r) => r.magnitude as number),
);
```

- [ ] **Step 3: Replace the radar `<section>` JSX** (lines 105–123)

Remove:
```tsx
        {/* §雷达 · 今日相对基线的变化 */}
        <section style={{ marginBottom: 40 }}>
          <div style={SECTION_LABEL}>§ 雷达 · 今日变化</div>
          {radar.length === 0 ? (
            <p style={{ color: '#6b6b78', fontSize: 13 }}>今日无显著雷达变化（相对 90 天基线）。</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {radar.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 14 }}>
                  <span style={{ color: '#c99', minWidth: 96, fontSize: 12 }}>{radarIcon(r.type)} {radarLabel(r.type)}</span>
                  <span style={{ color: '#ECE7DD' }}>{r.target}</span>
                  {r.magnitude != null ? (
                    <span style={{ color: '#6b6b78', fontSize: 12 }}>强度 {Number(r.magnitude).toFixed(r.magnitude % 1 ? 2 : 0)}</span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
```

Replace with:
```tsx
        {/* §雷达 · 今日相对基线的变化 */}
        <section style={{ marginBottom: 40 }}>
          <div style={SECTION_LABEL}>§ 雷达 · 今日变化</div>
          {radar.length === 0 ? (
            <p style={{ color: '#6b6b78', fontSize: 13 }}>今日无显著雷达变化（相对 90 天基线）。</p>
          ) : (
            <div style={{ border: '1px solid #1b1b26', borderRadius: 6, overflow: 'hidden' }}>
              {radar.map((r, i) => {
                const s = radarStyle(r.type);
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'stretch',
                      borderBottom: i < radar.length - 1 ? '1px solid #1b1b26' : 'none',
                    }}
                  >
                    <div
                      style={{
                        width: 56,
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: '14px 0',
                        background: s.colBg,
                        borderRight: `1px solid ${s.colBorder}`,
                      }}
                    >
                      <span style={{ fontSize: 20, lineHeight: 1, color: s.fg }}>{radarIcon(r.type)}</span>
                      <span style={{ fontSize: 8, color: s.fg, letterSpacing: 0.5, marginTop: 4 }}>{s.short}</span>
                    </div>
                    <div
                      style={{
                        padding: '11px 16px',
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                      }}
                    >
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#ECE7DD', lineHeight: 1.3 }}>
                        {r.target}
                      </span>
                      {r.magnitude != null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                          <div style={{ width: 72, height: 2, background: s.trackBg, borderRadius: 1 }}>
                            <div
                              style={{
                                width: `${(r.magnitude / maxMagnitude) * 100}%`,
                                height: '100%',
                                background: s.fg,
                                borderRadius: 1,
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 10, color: s.fg }}>
                            {Number(r.magnitude).toFixed(1)}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 10, color: '#4a4a5a', marginTop: 3 }}>
                          {radarLabel(r.type)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
```

- [ ] **Step 4: Run dev server and verify visually**

```bash
npm run dev
```

Open `http://localhost:3000/day/2026-06-17` (or any date with radar data) in a browser.

Check:
- 雷达区有圆角边框容器，行间有细分割线
- 图标列 56px，带色调底色，大图标 + 短类型标
- 词条 15px 粗体，是视觉主角
- 有 magnitude 的行：显示进度条 + 数字（颜色与图标一致）
- 无 magnitude 的行：词条下显示完整类型名（灰色）
- 雷达为空时：仍显示"今日无显著雷达变化"灰色文字

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: All tests PASS (TypeScript 编译通过，无逻辑回归).

- [ ] **Step 6: Commit**

```bash
git add src/components/DailyRead.tsx
git commit -m "feat(daily): redesign radar section with E-2 icon-column style"
```
