# CCTV_Digest — P4 Radar + Deep Interpretation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.

**Goal:** Produce the two highest-value analytic layers per day: (1) **Radar** — deterministic change-detection vs a trailing baseline (new 提法 首现, drumbeat up/down) → `radar_event` rows; (2) **Deep interpretation** — strong-model (DeepSeek Pro) Top-3 signals with the 3-layer read (政策主题 → 行业 → 示例标的, each with confidence), linked to a thread and flagged when radar-driven → `daily_interpretation` rows. Plus an idempotent per-day runner + backfill.

**Architecture:** `src/radar/` — pure `detectRadar` over the 提法 mention history (TDD). `src/interpret/` — Zod `DeepInterpretation` schema, a Chinese 3-layer signal-reading prompt (the IP), a dependency-injected `interpretDay` LLM call (mock-tested), pure persist-row builders, and an idempotent `analyzeDay` runner (radar + deep) with injected DB. Live LLM/DB deferred.

**Tech Stack:** TypeScript, `ai` v6 `generateObject`, `zod`, Drizzle, Vitest. Builds on P0-P2 (`tifa_mention`, `item`, `radar_event`, `daily_interpretation`, `broadcast_day`, `@/llm`).

**Scope note:** Radar implements `new_tifa` + `drumbeat_up` + `drumbeat_down` (cleanly deterministic). `order_jump` and 口径翻转`flip` (which need cross-day wording/LLM comparison) are deferred to a P4-followup/P5 and noted, not faked.

---

## File Structure
| File | Responsibility |
|---|---|
| `src/radar/detect.ts` / `.test.ts` | pure `detectRadar(targetDay, mentions, opts)` → `RadarEvent[]` |
| `src/interpret/schema.ts` | Zod `DeepInterpretationSchema` + types |
| `src/interpret/prompt.ts` / `.test.ts` | `buildInterpretationPrompt(input)` (3-layer signal read) |
| `src/interpret/interpret.ts` / `.test.ts` | `interpretDay(input, deps)` LLM call (injectable) |
| `src/interpret/persist.ts` / `.test.ts` | persist radar_event + daily_interpretation (injected DB) |
| `src/interpret/run.ts` / `.test.ts` | idempotent `analyzeDay(date, deps)` (radar + deep) |
| `scripts/analyze-backfill.ts` | run analysis over extracted-but-not-analyzed days |

---

## Task 1: Radar detection (pure)

**Files:** Create `src/radar/detect.ts`; Test `src/radar/detect.test.ts`.

- [ ] **Step 1: failing test** `src/radar/detect.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { detectRadar } from './detect';

type M = { day: string; term: string; count: number };

// helper: build daily mentions
function days(term: string, entries: [string, number][]): M[] {
  return entries.map(([day, count]) => ({ day, term, count }));
}

describe('detectRadar', () => {
  it('flags a brand-new 提法 (first ever appearance on the target day)', () => {
    const mentions: M[] = [
      ...days('老词', [['2026-03-01', 2], ['2026-05-30', 2]]),
      { day: '2026-06-01', term: '新词', count: 3 },
    ];
    const ev = detectRadar('2026-06-01', mentions);
    const nt = ev.find((e) => e.type === 'new_tifa' && e.target === '新词');
    expect(nt).toBeTruthy();
    expect(nt!.magnitude).toBe(3);
  });

  it('flags drumbeat_up when recent frequency far exceeds the baseline', () => {
    // baseline: rare; recent (last 14d incl target): a burst
    const mentions: M[] = [
      ...days('热词', [
        ['2026-01-10', 1], ['2026-02-10', 1], // sparse baseline
        ['2026-05-25', 3], ['2026-05-30', 4], ['2026-06-01', 5], // recent burst
      ]),
    ];
    const ev = detectRadar('2026-06-01', mentions);
    expect(ev.some((e) => e.type === 'drumbeat_up' && e.target === '热词')).toBe(true);
  });

  it('flags drumbeat_down when a previously-hot term goes quiet recently', () => {
    const mentions: M[] = [
      ...days('降温词', [
        ['2026-03-05', 6], ['2026-03-20', 6], ['2026-04-05', 6], // hot baseline
        // nothing in the recent window before/at target
      ]),
    ];
    const ev = detectRadar('2026-06-01', mentions);
    expect(ev.some((e) => e.type === 'drumbeat_down' && e.target === '降温词')).toBe(true);
  });

  it('does not flag a steady term', () => {
    const mentions: M[] = days('稳定词',
      Array.from({ length: 10 }, (_, i) => [`2026-0${1 + Math.floor(i / 3)}-${10 + (i % 3)}`, 2] as [string, number]));
    const ev = detectRadar('2026-06-01', mentions);
    expect(ev.some((e) => e.target === '稳定词')).toBe(false);
  });

  it('stamps every event with the target day', () => {
    const ev = detectRadar('2026-06-01', [{ day: '2026-06-01', term: 'x', count: 9 }]);
    expect(ev.every((e) => e.day === '2026-06-01')).toBe(true);
  });
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement `src/radar/detect.ts`.** Day-diff helper via UTC dates. Windows relative to target: recent = (target-recentDays, target]; baseline = (target-baselineDays-recentDays, target-recentDays].
```typescript
export type RadarType = 'new_tifa' | 'drumbeat_up' | 'drumbeat_down';
export interface RadarEvent { day: string; type: RadarType; target: string; magnitude: number; detail?: Record<string, unknown> }
export interface Mention { day: string; term: string; count: number }
export interface RadarOpts { recentDays?: number; baselineDays?: number; riseFactor?: number; minRecent?: number; baselineHot?: number }

const MS = 86_400_000;
function dayDiff(a: string, b: string): number { // a - b in days (UTC)
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / MS);
}

export function detectRadar(target: string, mentions: Mention[], opts: RadarOpts = {}): RadarEvent[] {
  const recentDays = opts.recentDays ?? 14;
  const baselineDays = opts.baselineDays ?? 90;
  const riseFactor = opts.riseFactor ?? 2;
  const minRecent = opts.minRecent ?? 3;
  const baselineHot = opts.baselineHot ?? 6;

  const terms = [...new Set(mentions.map((m) => m.term))];
  const events: RadarEvent[] = [];

  for (const term of terms) {
    const ms = mentions.filter((m) => m.term === term);
    let recent = 0, baseline = 0, before = 0;
    for (const m of ms) {
      const d = dayDiff(target, m.day); // >=0 means on/before target
      if (d < 0) continue; // strictly after target — ignore
      if (d < recentDays) recent += m.count;
      else if (d < recentDays + baselineDays) baseline += m.count;
      if (d >= recentDays) before += m.count; // anything before the recent window
    }
    // new 提法: appears in recent window and never before it
    if (recent > 0 && before === 0) {
      events.push({ day: target, type: 'new_tifa', target: term, magnitude: recent });
      continue;
    }
    const expectedRecent = (baseline / baselineDays) * recentDays; // baseline rate scaled to recent window
    if (recent >= minRecent && recent >= riseFactor * Math.max(expectedRecent, 1)) {
      events.push({ day: target, type: 'drumbeat_up', target: term, magnitude: +(recent / Math.max(expectedRecent, 1)).toFixed(2), detail: { recent, baseline } });
    } else if (baseline >= baselineHot && recent === 0) {
      events.push({ day: target, type: 'drumbeat_down', target: term, magnitude: baseline, detail: { recent, baseline } });
    }
  }
  return events;
}
```

- [ ] **Step 4: run → PASS (5 tests).** Then `npm test` + `npx tsc --noEmit`.

- [ ] **Step 5: commit** — `git add -A && git commit -m "feat(radar): deterministic change detection (new tifa, drumbeat up/down)"`

---

## Task 2: Deep-interpretation schema, prompt, LLM call

**Files:** Create `src/interpret/schema.ts`, `src/interpret/prompt.ts`, `src/interpret/interpret.ts`; Test `src/interpret/prompt.test.ts`, `src/interpret/interpret.test.ts`.

- [ ] **Step 1: `src/interpret/schema.ts`:**
```typescript
import { z } from 'zod';

export const CONFIDENCE = ['high', 'mid', 'low'] as const;

export const DeepInterpretationSchema = z.object({
  signals: z.array(z.object({
    title: z.string().min(1).describe('one-line signal headline (Chinese)'),
    theme: z.string().min(1).describe('政策主题层：它意味着什么政策方向'),
    confidence: z.enum(CONFIDENCE),
    sectors: z.array(z.object({
      sector: z.string().min(1),
      polarity: z.enum(['bull', 'bear', 'neutral']),
    })).describe('受影响行业/板块'),
    tickers: z.array(z.string()).describe('示例标的（线索，非建议；可空，宁缺毋滥）'),
    thread: z.string().describe('所属主线名（自由文本，P5 会归一）'),
    fromRadar: z.boolean().describe('该信号是否由今日雷达变化驱动'),
  })).min(1).max(3).describe('今日最重要的最多 3 个信号'),
});
export type DeepInterpretation = z.infer<typeof DeepInterpretationSchema>;
```

- [ ] **Step 2: failing prompt test** `src/interpret/prompt.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { buildInterpretationPrompt } from './prompt';

const input = {
  date: '2026-06-13',
  items: [{ ord: 1, segment: 'leader', title: '头条X', summary: '摘要X' }],
  radar: [{ type: 'new_tifa', target: '人工智能+', magnitude: 3 }],
};

describe('buildInterpretationPrompt', () => {
  const p = buildInterpretationPrompt(input);
  it('includes the date, items, and radar context', () => {
    expect(p).toContain('2026-06-13');
    expect(p).toContain('头条X');
    expect(p).toContain('人工智能+');
  });
  it('instructs the three-layer read with confidence and from-radar linkage', () => {
    expect(p).toMatch(/政策主题/);
    expect(p).toMatch(/行业|板块/);
    expect(p).toMatch(/标的/);
    expect(p).toMatch(/置信|confidence/i);
    expect(p).toMatch(/最多.?3|三个|Top-?3/);
  });
  it('frames it as signal-reading (propaganda), with epistemic humility', () => {
    expect(p).toMatch(/信号|编排|宣传/);
    expect(p).toMatch(/不等于|谨慎|置信|不臆造/);
  });
});
```

- [ ] **Step 3: run → FAIL.**

- [ ] **Step 4: implement `src/interpret/prompt.ts`:**
```typescript
export interface InterpItem { ord: number; segment: string; title: string; summary: string }
export interface InterpRadar { type: string; target: string; magnitude: number }
export interface InterpInput { date: string; items: InterpItem[]; radar: InterpRadar[] }

export function buildInterpretationPrompt(input: InterpInput): string {
  const itemsText = input.items
    .map((it) => `  [${it.ord}] (${it.segment}) ${it.title} — ${it.summary}`)
    .join('\n');
  const radarText = input.radar.length
    ? input.radar.map((r) => `  - ${r.type}: ${r.target} (强度 ${r.magnitude})`).join('\n')
    : '  （今日无显著雷达变化）';
  return [
    `你是中国《新闻联播》的投研解读助手。把 ${input.date} 这期联播读作「信号」，而非复述事实。`,
    '联播是被精心编排的宣传：编辑选择（上场顺序、时长、措辞、连续敲鼓）本身就是信息。',
    '',
    '请给出当日【最多 3 个】最重要的信号。每个信号按三层展开：',
    '1) 政策主题层 theme：它指向什么政策方向、为什么是现在；',
    '2) 行业层 sectors：可能受影响的行业/板块及方向（bull/bear/neutral）；',
    '3) 标的层 tickers：示例标的——仅为线索、非投资建议，宁缺毋滥，可留空。',
    '并给出 confidence（high/mid/low），标注该信号是否由今日雷达变化驱动（fromRadar），',
    '以及它所属的主线 thread（自由命名，后续会归一）。',
    '',
    '认知谦逊：联播反映的是「意图/姿态」，不等于现实，也不一定等于已落地的政策；',
    '单日口径变化≠政策落地。请谨慎、不臆造，把握不准就降低 confidence。',
    '',
    `=== 今日条目（共 ${input.items.length} 条）===`,
    itemsText,
    '=== 今日雷达（相对基线的变化）===',
    radarText,
  ].join('\n');
}
```

- [ ] **Step 5: run → PASS.**

- [ ] **Step 6: failing interpret test** `src/interpret/interpret.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { interpretDay } from './interpret';
import type { DeepInterpretation } from './schema';

const canned: DeepInterpretation = {
  signals: [{ title: 't', theme: 'th', confidence: 'high', sectors: [{ sector: '半导体', polarity: 'bull' }], tickers: [], thread: '科技', fromRadar: true }],
};

describe('interpretDay', () => {
  it('returns the model interpretation via injected generate', async () => {
    const generate = vi.fn(async () => canned);
    const out = await interpretDay({ date: '2026-06-13', items: [{ ord: 1, segment: 'leader', title: 'x', summary: 'y' }], radar: [] }, { generate });
    expect(out).toEqual(canned);
    expect(generate).toHaveBeenCalledOnce();
  });
  it('throws when there are no items', async () => {
    const generate = vi.fn(async () => canned);
    await expect(interpretDay({ date: '2026-06-13', items: [], radar: [] }, { generate })).rejects.toThrow(/no items|empty/i);
    expect(generate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: run → FAIL.**

- [ ] **Step 8: implement `src/interpret/interpret.ts`:**
```typescript
import { generateObject } from 'ai';
import { loadStageConfig } from '@/llm/loadStageConfig';
import { getModel } from '@/llm/model';
import { buildInterpretationPrompt, type InterpInput } from './prompt';
import { DeepInterpretationSchema, type DeepInterpretation } from './schema';

export interface InterpretDeps { generate: (input: InterpInput) => Promise<DeepInterpretation> }

const DEFAULT_DEPS: InterpretDeps = {
  generate: async (input) => {
    const cfg = await loadStageConfig('deep');
    const { object } = await generateObject({
      model: getModel(cfg),
      schema: DeepInterpretationSchema,
      prompt: buildInterpretationPrompt(input),
    });
    return object;
  },
};

export async function interpretDay(input: InterpInput, deps: InterpretDeps = DEFAULT_DEPS): Promise<DeepInterpretation> {
  if (!input.items.length) throw new Error('cannot interpret a day with no items');
  return deps.generate(input);
}
```
Adjust `generateObject` call only if the installed AI SDK signature requires it (keep the injected `generate` seam).

- [ ] **Step 9: run → PASS.** Then `npm test` + `npx tsc --noEmit` + `npm run build`.

- [ ] **Step 10: commit** — `git add -A && git commit -m "feat(interpret): deep-interpretation schema, 3-layer prompt, LLM call"`

---

## Task 3: Persist + idempotent analyzeDay + backfill

**Files:** Create `src/interpret/persist.ts`, `src/interpret/run.ts`, `scripts/analyze-backfill.ts`; Test `src/interpret/persist.test.ts`, `src/interpret/run.test.ts`.

- [ ] **Step 1: failing persist test** `src/interpret/persist.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { persistAnalysis } from './persist';
import type { DeepInterpretation } from './schema';
import type { RadarEvent } from '@/radar/detect';

const interp: DeepInterpretation = { signals: [{ title: 't', theme: 'th', confidence: 'high', sectors: [], tickers: [], thread: '科技', fromRadar: false }] };
const radar: RadarEvent[] = [{ day: '2026-06-13', type: 'new_tifa', target: '人工智能+', magnitude: 3 }];

describe('persistAnalysis', () => {
  it('replaces radar events and upserts the interpretation, then marks analyzed', async () => {
    const calls: string[] = [];
    const deps = {
      replaceRadar: vi.fn(async () => { calls.push('radar'); }),
      upsertInterpretation: vi.fn(async () => { calls.push('interp'); }),
      markAnalyzed: vi.fn(async () => { calls.push('mark'); }),
    };
    await persistAnalysis('2026-06-13', radar, interp, 'deepseek-v4-pro', deps);
    expect(deps.replaceRadar).toHaveBeenCalledWith('2026-06-13', radar);
    expect(deps.upsertInterpretation).toHaveBeenCalledWith('2026-06-13', interp, 'deepseek-v4-pro');
    expect(calls).toEqual(['radar', 'interp', 'mark']);
  });
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement `src/interpret/persist.ts`** (injected DB; DEFAULT_DEPS wraps Drizzle: delete+insert radar_event for the day [idempotent replace]; insert daily_interpretation with topSignals jsonb + model; update broadcast_day.status='analyzed'):
```typescript
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { radarEvent, dailyInterpretation, broadcastDay } from '@/db/schema';
import type { DeepInterpretation } from './schema';
import type { RadarEvent } from '@/radar/detect';

export interface AnalysisPersistDeps {
  replaceRadar: (day: string, events: RadarEvent[]) => Promise<void>;
  upsertInterpretation: (day: string, interp: DeepInterpretation, model: string) => Promise<void>;
  markAnalyzed: (day: string) => Promise<void>;
}

const DEFAULT_DEPS: AnalysisPersistDeps = {
  replaceRadar: async (day, events) => {
    const db = getDb();
    await db.delete(radarEvent).where(eq(radarEvent.day, day));
    if (events.length) {
      await db.insert(radarEvent).values(events.map((e) => ({
        day: e.day, type: e.type, target: e.target, magnitude: e.magnitude, detail: e.detail ?? null,
      })));
    }
  },
  upsertInterpretation: async (day, interp, model) => {
    const db = getDb();
    await db.delete(dailyInterpretation).where(eq(dailyInterpretation.day, day));
    await db.insert(dailyInterpretation).values({ day, topSignals: interp.signals, model });
  },
  markAnalyzed: async (day) => {
    await getDb().update(broadcastDay).set({ status: 'analyzed' }).where(eq(broadcastDay.date, day));
  },
};

export async function persistAnalysis(
  day: string, radar: RadarEvent[], interp: DeepInterpretation, model: string,
  deps: AnalysisPersistDeps = DEFAULT_DEPS,
): Promise<void> {
  await deps.replaceRadar(day, radar);
  await deps.upsertInterpretation(day, interp, model);
  await deps.markAnalyzed(day);
}
```

- [ ] **Step 4: run → PASS.**

- [ ] **Step 5: failing run test** `src/interpret/run.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { analyzeDay, shouldSkipAnalysis } from './run';
import type { DeepInterpretation } from './schema';

const interp: DeepInterpretation = { signals: [{ title: 't', theme: 'th', confidence: 'low', sectors: [], tickers: [], thread: 'x', fromRadar: false }] };

describe('shouldSkipAnalysis', () => {
  it('skips already-analyzed days', () => {
    expect(shouldSkipAnalysis({ status: 'analyzed' })).toBe(true);
  });
  it('does not skip extracted days', () => {
    expect(shouldSkipAnalysis({ status: 'extracted' })).toBe(false);
  });
});

describe('analyzeDay', () => {
  it('skips when already analyzed', async () => {
    const deps = { getDay: vi.fn(async () => ({ status: 'analyzed' })), loadInputs: vi.fn(), detect: vi.fn(), interpret: vi.fn(), persist: vi.fn(), model: 'm' };
    const r = await analyzeDay('2026-06-13', deps);
    expect(r.skipped).toBe(true);
    expect(deps.interpret).not.toHaveBeenCalled();
  });
  it('throws when the day is not extracted yet', async () => {
    const deps = { getDay: vi.fn(async () => ({ status: 'ingested' })), loadInputs: vi.fn(), detect: vi.fn(), interpret: vi.fn(), persist: vi.fn(), model: 'm' };
    await expect(analyzeDay('2026-06-13', deps)).rejects.toThrow(/not extracted/i);
  });
  it('runs radar + interpret + persist for an extracted day', async () => {
    const deps = {
      getDay: vi.fn(async () => ({ status: 'extracted' })),
      loadInputs: vi.fn(async () => ({ items: [{ ord: 1, segment: 'leader', title: 'x', summary: 'y' }], mentions: [{ day: '2026-06-13', term: 'x', count: 1 }] })),
      detect: vi.fn(() => [{ day: '2026-06-13', type: 'new_tifa' as const, target: 'x', magnitude: 1 }]),
      interpret: vi.fn(async () => interp),
      persist: vi.fn(async () => {}),
      model: 'deepseek-v4-pro',
    };
    const r = await analyzeDay('2026-06-13', deps);
    expect(r.skipped).toBe(false);
    expect(deps.detect).toHaveBeenCalled();
    expect(deps.interpret).toHaveBeenCalled();
    expect(deps.persist).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 6: run → FAIL.**

- [ ] **Step 7: implement `src/interpret/run.ts`:**
```typescript
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { broadcastDay, item, tifaMention } from '@/db/schema';
import { loadStageConfig } from '@/llm/loadStageConfig';
import { detectRadar, type Mention, type RadarEvent } from '@/radar/detect';
import { interpretDay } from './interpret';
import { persistAnalysis } from './persist';
import type { InterpItem } from './prompt';
import type { DeepInterpretation } from './schema';

export function shouldSkipAnalysis(day: { status?: string } | undefined): boolean {
  return day?.status === 'analyzed';
}

export interface AnalyzeDeps {
  getDay: (date: string) => Promise<{ status?: string } | undefined>;
  loadInputs: (date: string) => Promise<{ items: InterpItem[]; mentions: Mention[] }>;
  detect: (date: string, mentions: Mention[]) => RadarEvent[];
  interpret: (input: { date: string; items: InterpItem[]; radar: { type: string; target: string; magnitude: number }[] }) => Promise<DeepInterpretation>;
  persist: (date: string, radar: RadarEvent[], interp: DeepInterpretation, model: string) => Promise<void>;
  model: string;
}

const DEFAULT_DEPS: AnalyzeDeps = {
  getDay: async (date) => (await getDb().select().from(broadcastDay).where(eq(broadcastDay.date, date)).limit(1))[0],
  loadInputs: async (date) => {
    const db = getDb();
    const items = await db.select({ ord: item.ord, segment: item.segment, title: item.title, summary: item.summary })
      .from(item).where(eq(item.day, date)).orderBy(item.ord) as { ord: number; segment: string; title: string | null; summary: string | null }[];
    const mentions = await db.select({ day: tifaMention.day, term: tifaMention.term, count: tifaMention.count }).from(tifaMention) as Mention[];
    return {
      items: items.map((i) => ({ ord: i.ord, segment: i.segment, title: i.title ?? '', summary: i.summary ?? '' })),
      mentions,
    };
  },
  detect: (date, mentions) => detectRadar(date, mentions),
  interpret: (input) => interpretDay(input),
  persist: (date, radar, interp, model) => persistAnalysis(date, radar, interp, model),
  model: 'deep', // resolved label; actual model recorded below
};

export async function analyzeDay(date: string, deps: AnalyzeDeps = DEFAULT_DEPS): Promise<{ date: string; skipped: boolean }> {
  const day = await deps.getDay(date);
  if (!day) throw new Error(`day ${date} not found`);
  if (shouldSkipAnalysis(day)) return { date, skipped: true };
  if (day.status !== 'extracted') throw new Error(`day ${date} is not extracted yet (status=${day.status})`);
  const { items, mentions } = await deps.loadInputs(date);
  const radar = deps.detect(date, mentions);
  const interp = await deps.interpret({ date, items, radar: radar.map((r) => ({ type: r.type, target: r.target, magnitude: r.magnitude })) });
  await deps.persist(date, radar, interp, deps.model);
  return { date, skipped: false };
}
```
For the recorded model string in DEFAULT_DEPS, resolve it at call time: replace the literal `'deep'` by reading `(await loadStageConfig('deep')).model` inside `analyzeDay`'s DEFAULT path — simplest: in DEFAULT_DEPS.persist, capture the model via `loadStageConfig('deep')`. Keep the test's injected `model: 'deepseek-v4-pro'` working. (Implementer: make the DEFAULT_DEPS record the real configured model; the test injects a literal — both must typecheck. A clean approach: keep `model` in deps but in DEFAULT compute it lazily, or pass the resolved model into persist from within analyzeDay. Choose the cleanest that satisfies the test.)

- [ ] **Step 8: run → PASS (5 tests).** Then full `npm test` + `npx tsc --noEmit` + `npm run build`.

- [ ] **Step 9: `scripts/analyze-backfill.ts`** (select `status='extracted'` days ordered by date asc → analyzeDay each; count ok/fail). package.json `"analyze:backfill": "tsx scripts/analyze-backfill.ts"`. Smoke-check: `npx tsx scripts/analyze-backfill.ts` fails on DATABASE_URL.

- [ ] **Step 10: commit** — `git add -A && git commit -m "feat(interpret): persist + idempotent analyzeDay + backfill"`

---

## Self-Review
**Spec coverage (P4 / §4.2-4.3):** radar new_tifa + drumbeat (deterministic, vs baseline) ✓; deep Top-3 3-layer signals with confidence + thread + fromRadar ✓; idempotent per-day (status 'analyzed', radar replace, interpretation replace) ✓; uses configurable 'deep' stage (DeepSeek Pro) ✓; backfill over extracted days ✓. Deferred (noted, not faked): order_jump + 口径翻转 flip (need cross-day wording/LLM). Out of scope: thread synthesis (P5), wiring radar/interpretation into the daily-read UI (P5/P6 polish), cron (P6).

**Placeholder scan:** none. Deferred radar types are explicitly noted, not stubbed.

**Type consistency:** `RadarEvent`/`Mention` from radar/detect used in interpret/run + persist; `DeepInterpretation` from schema used in prompt/interpret/persist/run; `InterpInput`/`InterpItem` consistent; persist row shapes match `radar_event`/`daily_interpretation`/`broadcast_day` columns.

## Live note
After P2 extraction populates `item`/`tifa_mention`, run `npm run analyze:backfill` (needs DeepSeek key) to populate `radar_event` + `daily_interpretation`. P5 wires these into the daily-read UI + synthesizes named threads.
