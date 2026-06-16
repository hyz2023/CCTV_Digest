# CCTV_Digest — P9 清理 Defer 项 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.

**Goal:** 补齐三个此前标注 deferred 的功能：(1) Radar **order_jump**（议题在播出序中显著前移）；(2) Radar **flip**（口径翻转，用 sector 极性方向翻转确定性实现）；(3) **thread_evidence** 落库（主线↔支撑条目）。全部用确定性逻辑（不新增 LLM 调用），核心为纯函数、TDD。

**Architecture:** 扩展 `src/radar/detect.ts`：保留现有 `detectRadar`（不破坏现有测试），新增纯函数 `detectOrderJumps`、`detectSectorFlips`、聚合 `detectAllRadar`。`analyzeDay` 的 `loadInputs` 额外取 items（含 ord/title/summary）+ sector signals，并改用 `detectAllRadar`。线程：`buildThreadRows` 增产 evidence 行（item 文本含 memberTerm 即为证据），persist 写 `thread_evidence`，`synthesizeAllThreads` 加载 items。

**Tech Stack:** TypeScript, Drizzle, Vitest。建立在 P2(`item`/`sector_signal`)、P4(radar/analyzeDay)、P5(threads)。

**口径说明（诚实标注）：** `order_jump` 用"提法字面出现在某条 item 的 title/summary 中、取最小 ord"作为该提法当日的播出位置——启发式，提法未字面出现则跳过。`flip` 用 sector 主导极性 bull↔bear 方向翻转近似"口径翻转"（捕获利空↔利好的投资口径转向）；更细的"逐字措辞级 flip"留作未来 LLM 增强（已不再是阻塞项）。

---

## File Structure
| File | Responsibility |
|---|---|
| `src/radar/detect.ts` / `.test.ts` | +`detectOrderJumps`、+`detectSectorFlips`、+`detectAllRadar`（RadarType 加 `order_jump`/`flip`） |
| `src/interpret/run.ts` / `.test.ts` | `loadInputs` 加 items+sectorSignals；`detect` 改用 `detectAllRadar` |
| `src/threads/rows.ts` / `.test.ts` | `buildThreadRows` 增产 `evidence` 行 |
| `src/threads/persist.ts` / `.test.ts` | 写 `thread_evidence`（解析 threadName→id + itemId） |
| `src/threads/run.ts` / `.test.ts` | `loadItems` 加载 items 传入 buildThreadRows |

---

## Task 1: Radar order_jump + flip + detectAllRadar（纯，TDD）

**Files:** Edit `src/radar/detect.ts`、`src/radar/detect.test.ts`。

- [ ] **Step 1: 追加失败测试到 `src/radar/detect.test.ts`**（保留现有 5 个测试不动，新增）：
```typescript
import { detectOrderJumps, detectSectorFlips, detectAllRadar } from './detect';

describe('detectOrderJumps', () => {
  type I = { day: string; ord: number; title: string; summary: string };
  it('flags a topic that jumped markedly earlier in the rundown', () => {
    const items: I[] = [
      // 基线：'新词A' 一直排在 ord 8 左右
      { day: '2026-05-10', ord: 8, title: '其他', summary: '正文提到 新词A 的内容' },
      { day: '2026-05-20', ord: 9, title: '其他', summary: '又见 新词A' },
      // 目标日：'新词A' 跃升到 ord 1（头条）
      { day: '2026-06-01', ord: 1, title: '新词A 成头条', summary: '头条强调 新词A' },
      { day: '2026-06-01', ord: 5, title: '别的', summary: '无关' },
    ];
    const mentions = [
      { day: '2026-05-10', term: '新词A', count: 1 }, { day: '2026-05-20', term: '新词A', count: 1 }, { day: '2026-06-01', term: '新词A', count: 1 },
    ];
    const ev = detectOrderJumps('2026-06-01', items, mentions);
    expect(ev.some((e) => e.type === 'order_jump' && e.target === '新词A')).toBe(true);
  });
  it('does not flag a topic at a stable position', () => {
    const items: I[] = [
      { day: '2026-05-10', ord: 3, title: '稳定 稳词', summary: '稳词' },
      { day: '2026-05-20', ord: 3, title: '稳定 稳词', summary: '稳词' },
      { day: '2026-06-01', ord: 3, title: '稳定 稳词', summary: '稳词' },
    ];
    const mentions = [
      { day: '2026-05-10', term: '稳词', count: 1 }, { day: '2026-05-20', term: '稳词', count: 1 }, { day: '2026-06-01', term: '稳词', count: 1 },
    ];
    expect(detectOrderJumps('2026-06-01', items, mentions).some((e) => e.target === '稳词')).toBe(false);
  });
});

describe('detectSectorFlips', () => {
  it('flags a sector whose dominant polarity flips bear → bull', () => {
    const sigs = [
      { day: '2026-04-01', sector: '地产', polarity: 'bear' },
      { day: '2026-04-20', sector: '地产', polarity: 'bear' },
      { day: '2026-06-01', sector: '地产', polarity: 'bull' },
    ];
    const ev = detectSectorFlips('2026-06-01', sigs);
    expect(ev.find((e) => e.type === 'flip' && e.target === '地产')).toBeTruthy();
  });
  it('does not flag a sector with stable polarity', () => {
    const sigs = [
      { day: '2026-04-01', sector: '科技', polarity: 'bull' },
      { day: '2026-06-01', sector: '科技', polarity: 'bull' },
    ];
    expect(detectSectorFlips('2026-06-01', sigs).some((e) => e.target === '科技')).toBe(false);
  });
});

describe('detectAllRadar', () => {
  it('merges new_tifa/drumbeat + order_jump + flip, all stamped with the day', () => {
    const ev = detectAllRadar({
      target: '2026-06-01',
      mentions: [{ day: '2026-06-01', term: '全新词', count: 4 }],
      items: [{ day: '2026-06-01', ord: 1, title: '全新词', summary: '全新词' }],
      sectorSignals: [],
    });
    expect(ev.every((e) => e.day === '2026-06-01')).toBe(true);
    expect(ev.some((e) => e.type === 'new_tifa')).toBe(true);
  });
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: 扩展 `src/radar/detect.ts`**（保留现有导出；`RadarType` 加 `'order_jump' | 'flip'`）：
```typescript
export type RadarType = 'new_tifa' | 'drumbeat_up' | 'drumbeat_down' | 'order_jump' | 'flip';

export interface ItemPos { day: string; ord: number; title: string; summary: string }
export interface SectorSig { day: string; sector: string; polarity: string }

// 某提法在某天的播出位置 = 含该提法（title/summary 字面包含）的最小 ord；无则 undefined。
function positionOf(term: string, items: ItemPos[], day: string): number | undefined {
  const ords = items.filter((i) => i.day === day && (i.title + i.summary).includes(term)).map((i) => i.ord);
  return ords.length ? Math.min(...ords) : undefined;
}

export interface OrderJumpOpts { baselineDays?: number; minJump?: number; minSamples?: number }
export function detectOrderJumps(target: string, items: ItemPos[], mentions: Mention[], opts: OrderJumpOpts = {}): RadarEvent[] {
  const baselineDays = opts.baselineDays ?? 90;
  const minJump = opts.minJump ?? 3;
  const minSamples = opts.minSamples ?? 2;
  const terms = [...new Set(mentions.filter((m) => m.day === target).map((m) => m.term))];
  const events: RadarEvent[] = [];
  for (const term of terms) {
    const posToday = positionOf(term, items, target);
    if (posToday === undefined) continue;
    const past: number[] = [];
    for (const day of [...new Set(items.map((i) => i.day))]) {
      if (day === target) continue;
      const diff = dayDiff(target, day);
      if (diff <= 0 || diff > baselineDays) continue;
      const p = positionOf(term, items, day);
      if (p !== undefined) past.push(p);
    }
    if (past.length < minSamples) continue;
    const avg = past.reduce((a, b) => a + b, 0) / past.length;
    if (avg - posToday >= minJump) {
      events.push({ day: target, type: 'order_jump', target: term, magnitude: +(avg - posToday).toFixed(2), detail: { posToday, avgPast: +avg.toFixed(2) } });
    }
  }
  return events;
}

export interface FlipOpts { recentDays?: number; baselineDays?: number }
function dominantPolarity(sigs: SectorSig[]): 'bull' | 'bear' | null {
  let bull = 0, bear = 0;
  for (const s of sigs) { if (s.polarity === 'bull') bull++; else if (s.polarity === 'bear') bear++; }
  if (bull === 0 && bear === 0) return null;
  return bull >= bear ? 'bull' : 'bear';
}
export function detectSectorFlips(target: string, sectorSignals: SectorSig[], opts: FlipOpts = {}): RadarEvent[] {
  const recentDays = opts.recentDays ?? 21;
  const baselineDays = opts.baselineDays ?? 90;
  const sectors = [...new Set(sectorSignals.map((s) => s.sector))];
  const events: RadarEvent[] = [];
  for (const sector of sectors) {
    const recent: SectorSig[] = [], base: SectorSig[] = [];
    for (const s of sectorSignals) {
      if (s.sector !== sector) continue;
      const d = dayDiff(target, s.day);
      if (d < 0) continue;
      if (d < recentDays) recent.push(s);
      else if (d < recentDays + baselineDays) base.push(s);
    }
    const r = dominantPolarity(recent), b = dominantPolarity(base);
    if (r && b && r !== b) {
      events.push({ day: target, type: 'flip', target: sector, magnitude: 1, detail: { from: b, to: r } });
    }
  }
  return events;
}

export interface AllRadarInput { target: string; mentions: Mention[]; items: ItemPos[]; sectorSignals: SectorSig[] }
export function detectAllRadar(input: AllRadarInput): RadarEvent[] {
  return [
    ...detectRadar(input.target, input.mentions),
    ...detectOrderJumps(input.target, input.items, input.mentions),
    ...detectSectorFlips(input.target, input.sectorSignals),
  ];
}
```
（`dayDiff`、`Mention`、`RadarEvent` 已存在于文件中；复用，勿重复定义。`detectSectorFlips` 的 recent 含目标日，base 为更早窗口。）

- [ ] **Step 4: run → PASS（现有 5 + 新增 ~5）。** 然后 `npm test` + `npx tsc --noEmit`。

- [ ] **Step 5: commit** — `git add -A && git commit -m "feat(radar): deterministic order_jump + sector-polarity flip + detectAllRadar"`

---

## Task 2: analyzeDay 接入 detectAllRadar（items + sector signals）

**Files:** Edit `src/interpret/run.ts`、`src/interpret/run.test.ts`。

- [ ] **Step 1: 更新 `src/interpret/run.test.ts`** —— `loadInputs` 现在返回 `{ items, mentions, sectorSignals }`，`detect` 现在是 `(input: AllRadarInput) => RadarEvent[]`。改其中的 mock 形态：
  - `loadInputs` mock 返回 `{ items:[{day,ord,segment,title,summary}], mentions:[...], sectorSignals:[...] }`（注意 items 现在还需 ord/title/summary——它们已是 InterpItem 字段，复用同结构，外加供 radar 用）。
  - `detect` mock：`vi.fn(() => [{ day:'2026-06-13', type:'new_tifa', target:'x', magnitude:1 }])`，断言被调用即可（不再断言入参是 mentions 数组，而是被调用）。
  - 保留 skip/throw 两个测试不变。
  调整"runs radar + interpret + persist"用例的 deps 到新形态，断言 detect/interpret/persist 被调用。

- [ ] **Step 2: run → 该测试 FAIL（因签名变化）。**

- [ ] **Step 3: 改 `src/interpret/run.ts`：**
  - import `detectAllRadar`（替代 `detectRadar`）和类型 `ItemPos`、`SectorSig`、`Mention`、`RadarEvent` from `@/radar/detect`；加 `sectorSignal` from `@/db/schema`。
  - `AnalyzeDeps`：`loadInputs` 返回 `{ items: InterpItem[]; mentions: Mention[]; sectorSignals: SectorSig[] }`；`detect: (input: { target: string; mentions: Mention[]; items: ItemPos[]; sectorSignals: SectorSig[] }) => RadarEvent[]`。
  - DEFAULT_DEPS.loadInputs：除 items（现在 select 需含 ord/title/summary——已有；这些 InterpItem 同时充当 radar 的 ItemPos，因为含 day? 注意 ItemPos 需要 day 字段。当前 InterpItem 没有 day。解决：loadInputs 查 items 时 select 包含 day，并构造既满足 InterpItem（ord/segment/title/summary）又能供 radar（需 day/ord/title/summary）。最简：loadInputs 返回 items 为 `Array<{ ord; segment; title; summary; day }>`，传给 interpret 用（InterpItem 子集）和 radar（ItemPos 子集 day/ord/title/summary）。给 items 元素都带 day。）
    - 查 mentions（全量，同现状）、sectorSignals（`select {day,sector,polarity} from sectorSignal`）。
  - `detect` 默认：`(input) => detectAllRadar(input)`。
  - `analyzeDay`：`const { items, mentions, sectorSignals } = await deps.loadInputs(date);` `const radar = deps.detect({ target: date, mentions, items, sectorSignals });` 其余不变（interpret 用 items 映射成 InterpItem，persist 同）。
  示例 DEFAULT loadInputs：
```typescript
loadInputs: async (date) => {
  const db = getDb();
  const rawItems = await db.select({ day: item.day, ord: item.ord, segment: item.segment, title: item.title, summary: item.summary })
    .from(item).where(eq(item.day, date)).orderBy(item.ord);
  const items = rawItems.map((i) => ({ day: i.day, ord: i.ord, segment: i.segment, title: i.title ?? '', summary: i.summary ?? '' }));
  const mentions = await db.select({ day: tifaMention.day, term: tifaMention.term, count: tifaMention.count }).from(tifaMention) as Mention[];
  const sectorSignals = await db.select({ day: sectorSignal.day, sector: sectorSignal.sector, polarity: sectorSignal.polarity }).from(sectorSignal) as SectorSig[];
  return { items, mentions, sectorSignals };
},
```
  并在调用 interpret 时，把 items 映射为 InterpItem（去掉 day 或保留——InterpInput.items 是 InterpItem[]，多一个 day 字段不影响 prompt，但类型需匹配；安全起见映射成 `{ord,segment,title,summary}`）。

- [ ] **Step 4: run → PASS。** 然后 `npm test` + `npx tsc --noEmit` + `npm run build`。智能检查 `npx tsx scripts/analyze-backfill.ts` 仍只因 `DATABASE_URL` 失败。

- [ ] **Step 5: commit** — `git add -A && git commit -m "feat(interpret): analyzeDay feeds items+sector signals into detectAllRadar"`

---

## Task 3: thread_evidence 落库

**Files:** Edit `src/threads/rows.ts`(+test)、`src/threads/persist.ts`(+test)、`src/threads/run.ts`(+test)。

- [ ] **Step 1: 更新 `src/threads/rows.test.ts`** —— `buildThreadRows(set, mentions, colors, items)` 现在多一个 `items` 参数，并多产出 `evidence`。新增/调整测试：
```typescript
it('builds evidence rows linking a thread to items whose text contains a member term', () => {
  const items = [
    { id: 11, day: '2026-01-05', title: '关于 新质生产力 的报道', summary: '正文' },
    { id: 12, day: '2026-01-06', title: '无关', summary: '无关内容' },
  ];
  const r = buildThreadRows(set, mentions, ['#f00', '#0f0'], items);
  expect(r.evidence).toContainEqual({ threadName: '科技', day: '2026-01-05', itemId: 11 });
  expect(r.evidence.some((e) => e.itemId === 12)).toBe(false);
});
```
（现有 buildThreadRows 调用需补第 4 参 items；旧测试若调 `buildThreadRows(set, mentions, colors)` 则更新为传 `[]`。）

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: 改 `src/threads/rows.ts`：** 加 `EvidenceRow { threadName: string; day: string; itemId: number }`，`ThreadRows` 加 `evidence: EvidenceRow[]`。`buildThreadRows(set, mentions, colors, items: { id:number; day:string; title:string|null; summary:string|null }[] = [])`：对每个 thread，遍历 items，若 `(title+summary)` 含任一 memberTerm → 一条 evidence `{threadName, day, itemId:id}`。去重（同 thread+item 只一条）。

- [ ] **Step 4: run → PASS。**

- [ ] **Step 5: 更新 `src/threads/persist.test.ts`** —— deps 加 `insertEvidence`；断言调用顺序 `['clear','threads','points','evidence']`，且 evidence 解析了 threadName→id：
```typescript
const rows: ThreadRows = {
  threads: [{ name: '科技', status: 'active', color: '#f00', meta: { memberTerms: ['x'], read: 'r' } }],
  points: [{ threadName: '科技', period: '2026-01', intensity: 5 }],
  evidence: [{ threadName: '科技', day: '2026-01-05', itemId: 11 }],
};
// deps 增加 insertEvidence: vi.fn(async()=>{calls.push('evidence')})
// 断言 insertEvidence 收到 [{ threadId:1, day:'2026-01-05', itemId:11 }]
```

- [ ] **Step 6: run → FAIL.**

- [ ] **Step 7: 改 `src/threads/persist.ts`：** `ThreadPersistDeps` 加 `insertEvidence: (rows:{threadId:number;day:string;itemId:number}[]) => Promise<void>`。`clearAll` 已删 thread_evidence（保留）。DEFAULT_DEPS.insertEvidence 写 `threadEvidence`。`persistThreads` 在 insertPoints 之后：把 evidence 的 threadName→id 解析后 insertEvidence。

- [ ] **Step 8: run → PASS。**

- [ ] **Step 9: 更新 `src/threads/run.test.ts`** —— deps 加 `loadItems`（mock 返回 items）；`synthesizeAllThreads` 用例断言 buildThreadRows 收到 items（间接：persist 被调用即可，保持简单）。调整现有两个用例的 deps 形态。

- [ ] **Step 10: 改 `src/threads/run.ts`：** `ThreadRunDeps` 加 `loadItems: () => Promise<{id;day;title;summary}[]>`；DEFAULT 查 `item`（id,day,title,summary）。`synthesizeAllThreads`：`const items = await deps.loadItems();` `buildThreadRows(set, mentions, STREAM_COLORS, items)`。

- [ ] **Step 11: run → PASS。** 然后完整 `npm test` + `npx tsc --noEmit` + `npm run build`。`npx tsx scripts/synthesize-threads.ts` 仍只因 DATABASE_URL 失败。

- [ ] **Step 12: commit** — `git add -A && git commit -m "feat(threads): populate thread_evidence (member-term ↔ item matches)"`

---

## Self-Review
**覆盖：** order_jump（确定性，播出位置前移）✓；flip（sector 极性方向翻转）✓；thread_evidence 落库 ✓；全部确定性、TDD、无新增 LLM 调用。radar_event 的 unique(day,type,target) 仍适用（新类型不冲突）。
**口径诚实：** order_jump 依赖提法字面匹配 item 文本（启发式，未匹配则跳过）；flip 是极性级而非逐字措辞级（投资口径转向的实质已捕获）；evidence 是"提及级"。这些范围在计划顶部已注明。
**类型一致：** `RadarType`/`RadarEvent`/`Mention`/`ItemPos`/`SectorSig` 跨 detect 与 run 一致；`ThreadRows.evidence`/`EvidenceRow` 跨 rows/persist/run 一致；持久化行匹配 `radar_event`/`thread_evidence` 列。
