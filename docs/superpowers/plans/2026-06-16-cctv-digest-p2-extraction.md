# CCTV_Digest — P2 Structured Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Run cheap-model (DeepSeek Flash) structured extraction over an ingested transcript to produce items (三段式 segment, order, summary), 提法/keywords, and sector signals; persist them to `item`/`tifa`/`tifa_mention`/`sector_signal` + segment stats on `broadcast_day`; and a backfill runner over all ingested days. This is the time-series fuel for the River/脉络.

**Architecture:** `src/extract/` — a Zod `Extraction` schema, a pure Chinese extraction prompt, an `extractTranscript(text, deps)` that calls the LLM via the P0 model layer (AI SDK `generateObject`, dependency-injected for tests), pure `buildExtractionRows` mappers, a `persistExtraction` (injected DB deps), and an idempotent `extractDay` runner + backfill script. Pure logic + mappers are unit-tested; LLM and DB are injected/mocked; live runs deferred.

**Tech Stack:** TypeScript, `ai` v6 `generateObject`, `zod`, Drizzle, Vitest. Builds on P0 (`@/llm/loadStageConfig`, `@/llm/model`, `@/db`) and P1 (`broadcast_day` rows + Blob transcripts).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/extract/schema.ts` | Zod `ExtractionSchema` + `Extraction` type (LLM structured output) |
| `src/extract/prompt.ts` / `.test.ts` | `buildExtractionPrompt(text)` — the extraction instructions (the IP) |
| `src/extract/extract.ts` / `.test.ts` | `extractTranscript(text, deps)` — LLM call via injected `generate` |
| `src/extract/rows.ts` / `.test.ts` | pure mappers: `Extraction` → DB row sets + segment stats |
| `src/extract/persist.ts` / `.test.ts` | `persistExtraction(date, extraction, deps)` — write rows (injected DB) |
| `src/extract/run.ts` / `.test.ts` | `extractDay(date, deps)` idempotent; `loadTranscriptText` |
| `scripts/extract-backfill.ts` | run extraction over all ingested-but-not-extracted days (tsx) |

---

## Task 1: Extraction schema, prompt, and LLM call

**Files:** Create `src/extract/schema.ts`, `src/extract/prompt.ts`, `src/extract/extract.ts`; Test `src/extract/prompt.test.ts`, `src/extract/extract.test.ts`. Install `zod`.

- [ ] **Step 1: Install zod.** Run: `npm install zod`.

- [ ] **Step 2: Write `src/extract/schema.ts`:**
```typescript
import { z } from 'zod';

export const SEGMENTS = ['leader', 'dev', 'intl'] as const; // 领导动态 / 发展·民生 / 国际
export const POLARITIES = ['bull', 'bear', 'neutral'] as const; // 利好 / 利空 / 中性

export const ExtractionSchema = z.object({
  items: z.array(z.object({
    ord: z.number().int().describe('1-based order in the broadcast rundown'),
    segment: z.enum(SEGMENTS),
    title: z.string(),
    summary: z.string().describe('1-2 sentence Chinese summary'),
  })),
  tifa: z.array(z.object({
    term: z.string().describe('normalized 提法/keyword, e.g. 新质生产力'),
    count: z.number().int().min(1),
  })),
  sectors: z.array(z.object({
    sector: z.string().describe('affected industry, e.g. 半导体'),
    polarity: z.enum(POLARITIES),
    strength: z.number().min(0).max(1),
  })),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
export type Segment = (typeof SEGMENTS)[number];
```

- [ ] **Step 3: Write the failing prompt test** — `src/extract/prompt.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { buildExtractionPrompt } from './prompt';

describe('buildExtractionPrompt', () => {
  const p = buildExtractionPrompt('（示例联播正文）今日头条……');
  it('embeds the transcript', () => {
    expect(p).toContain('（示例联播正文）');
  });
  it('instructs the 三段式 segmentation and 提法/sector extraction', () => {
    expect(p).toContain('领导动态');
    expect(p).toContain('提法');
    expect(p).toMatch(/行业|板块/);
  });
  it('asks to read it as signal, not restate facts', () => {
    expect(p).toMatch(/信号|编辑选择|不要复述|不臆造|忠实/);
  });
});
```

- [ ] **Step 4: Run — expect FAIL.** Run: `npm test src/extract/prompt.test.ts`

- [ ] **Step 5: Implement `src/extract/prompt.ts`:**
```typescript
export function buildExtractionPrompt(transcript: string): string {
  return [
    '你是中国《新闻联播》的结构化标注助手。把下面这期联播文字稿做客观的结构化提取，',
    '用于后续的时间序列分析。请忠实于原文，不要臆造、不要复述无关内容，只抽取确有的信息。',
    '',
    '按以下结构输出：',
    '1) items：逐条新闻。segment 取值：leader=领导动态、dev=发展成就·民生、intl=国际；',
    '   ord 为其在节目中的播出顺序（从 1 开始）；title 为标题；summary 为 1-2 句中文摘要。',
    '2) tifa：值得记录的「提法/关键词」（政治语言、政策口径，如「新质生产力」），及其在本期出现次数 count。',
    '   归一化提法本身，不要带标点。',
    '3) sectors：受影响的行业/板块，polarity 取 bull(利好)/bear(利空)/neutral(中性)，strength 0-1。',
    '   这是"信号→行业"的客观映射，宁缺毋滥。',
    '',
    '注意：联播是编排过的信号源，编辑选择本身即信息；做客观抽取，判断留给后续环节。',
    '',
    '=== 联播文字稿开始 ===',
    transcript,
    '=== 联播文字稿结束 ===',
  ].join('\n');
}
```

- [ ] **Step 6: Run — expect PASS.** Run: `npm test src/extract/prompt.test.ts`

- [ ] **Step 7: Write the failing extract test** — `src/extract/extract.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { extractTranscript } from './extract';
import type { Extraction } from './schema';

const canned: Extraction = {
  items: [{ ord: 1, segment: 'leader', title: 't', summary: 's' }],
  tifa: [{ term: '新质生产力', count: 2 }],
  sectors: [{ sector: '半导体', polarity: 'bull', strength: 0.7 }],
};

describe('extractTranscript', () => {
  it('returns the model-produced Extraction via injected generate', async () => {
    const generate = vi.fn(async () => canned);
    const out = await extractTranscript('正文', { generate });
    expect(out).toEqual(canned);
    expect(generate).toHaveBeenCalledWith('正文');
  });
});
```

- [ ] **Step 8: Run — expect FAIL.** Run: `npm test src/extract/extract.test.ts`

- [ ] **Step 9: Implement `src/extract/extract.ts`:**
```typescript
import { generateObject } from 'ai';
import { loadStageConfig } from '@/llm/loadStageConfig';
import { getModel } from '@/llm/model';
import { buildExtractionPrompt } from './prompt';
import { ExtractionSchema, type Extraction } from './schema';

export interface ExtractDeps {
  generate: (text: string) => Promise<Extraction>;
}

const DEFAULT_DEPS: ExtractDeps = {
  generate: async (text) => {
    const cfg = await loadStageConfig('extraction');
    const { object } = await generateObject({
      model: getModel(cfg),
      schema: ExtractionSchema,
      prompt: buildExtractionPrompt(text),
    });
    return object;
  },
};

export async function extractTranscript(text: string, deps: ExtractDeps = DEFAULT_DEPS): Promise<Extraction> {
  return deps.generate(text);
}
```
If AI SDK v6's `generateObject` signature differs (e.g. requires `output` or the schema wrapper), adjust the DEFAULT_DEPS call to the installed API so it typechecks; keep `extractTranscript`'s injected-`generate` seam unchanged (that's what the test targets).

- [ ] **Step 10: Run — expect PASS.** Then full `npm test` + `npx tsc --noEmit` + `npm run build`.

- [ ] **Step 11: Commit**
```bash
git add -A
git commit -m "feat(extract): extraction schema, prompt, and LLM call (injectable)"
```

---

## Task 2: Pure extraction → DB-row mappers

**Files:** Create `src/extract/rows.ts`; Test `src/extract/rows.test.ts`.

- [ ] **Step 1: Write the failing test** — `src/extract/rows.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { buildExtractionRows } from './rows';
import type { Extraction } from './schema';

const ex: Extraction = {
  items: [
    { ord: 1, segment: 'leader', title: 'a', summary: 'sa' },
    { ord: 2, segment: 'leader', title: 'b', summary: 'sb' },
    { ord: 3, segment: 'intl', title: 'c', summary: 'sc' },
  ],
  tifa: [{ term: '新质生产力', count: 3 }, { term: '扩内需', count: 1 }],
  sectors: [{ sector: '半导体', polarity: 'bull', strength: 0.8 }],
};

describe('buildExtractionRows', () => {
  const r = buildExtractionRows('2026-06-13', ex);

  it('maps items with the day', () => {
    expect(r.items).toHaveLength(3);
    expect(r.items[0]).toMatchObject({ day: '2026-06-13', ord: 1, segment: 'leader', title: 'a', summary: 'sa' });
  });
  it('maps tifa terms and per-day mentions', () => {
    expect(r.tifaTerms).toEqual(['新质生产力', '扩内需']);
    expect(r.tifaMentions).toContainEqual({ day: '2026-06-13', term: '新质生产力', count: 3 });
  });
  it('maps sector signals', () => {
    expect(r.sectorSignals).toContainEqual({ day: '2026-06-13', sector: '半导体', polarity: 'bull', strength: 0.8 });
  });
  it('computes segment stats (count + share) per segment', () => {
    expect(r.segmentStats.leader.count).toBe(2);
    expect(r.segmentStats.intl.count).toBe(1);
    expect(r.segmentStats.dev.count).toBe(0);
    expect(r.segmentStats.leader.share).toBeCloseTo(2 / 3, 5);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** Run: `npm test src/extract/rows.test.ts`

- [ ] **Step 3: Implement `src/extract/rows.ts`:**
```typescript
import { SEGMENTS, type Extraction, type Segment } from './schema';

export interface ItemRow { day: string; ord: number; segment: string; title: string; summary: string; lengthProxy: number }
export interface TifaMentionRow { day: string; term: string; count: number }
export interface SectorSignalRow { day: string; sector: string; polarity: string; strength: number }
export type SegmentStats = Record<Segment, { count: number; share: number }>;

export interface ExtractionRows {
  items: ItemRow[];
  tifaTerms: string[];
  tifaMentions: TifaMentionRow[];
  sectorSignals: SectorSignalRow[];
  segmentStats: SegmentStats;
}

export function buildExtractionRows(day: string, ex: Extraction): ExtractionRows {
  const total = ex.items.length || 1;
  const counts = Object.fromEntries(SEGMENTS.map((s) => [s, 0])) as Record<Segment, number>;
  for (const it of ex.items) counts[it.segment]++;
  const segmentStats = Object.fromEntries(
    SEGMENTS.map((s) => [s, { count: counts[s], share: counts[s] / total }]),
  ) as SegmentStats;

  return {
    items: ex.items.map((it) => ({
      day, ord: it.ord, segment: it.segment, title: it.title, summary: it.summary,
      lengthProxy: it.summary.length,
    })),
    tifaTerms: ex.tifa.map((t) => t.term),
    tifaMentions: ex.tifa.map((t) => ({ day, term: t.term, count: t.count })),
    sectorSignals: ex.sectors.map((s) => ({ day, sector: s.sector, polarity: s.polarity, strength: s.strength })),
    segmentStats,
  };
}
```

- [ ] **Step 4: Run — expect PASS.** Then `npm test` + `npx tsc --noEmit`.

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat(extract): pure Extraction -> DB-row mappers + segment stats"
```

---

## Task 3: Persist + idempotent extractDay + backfill

**Files:** Create `src/extract/persist.ts`, `src/extract/run.ts`, `scripts/extract-backfill.ts`; Test `src/extract/persist.test.ts`, `src/extract/run.test.ts`.

- [ ] **Step 1: Write the failing persist test** — `src/extract/persist.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { persistExtraction } from './persist';
import type { Extraction } from './schema';

const ex: Extraction = {
  items: [{ ord: 1, segment: 'leader', title: 'a', summary: 'sa' }],
  tifa: [{ term: '新质生产力', count: 2 }],
  sectors: [{ sector: '半导体', polarity: 'bull', strength: 0.5 }],
};

describe('persistExtraction', () => {
  it('writes items/tifa/mentions/sector + segment stats via injected deps', async () => {
    const calls: string[] = [];
    const deps = {
      insertItems: vi.fn(async () => { calls.push('items'); }),
      upsertTifa: vi.fn(async () => { calls.push('tifa'); }),
      insertTifaMentions: vi.fn(async () => { calls.push('mentions'); }),
      insertSectorSignals: vi.fn(async () => { calls.push('sectors'); }),
      markExtracted: vi.fn(async () => { calls.push('mark'); }),
    };
    await persistExtraction('2026-06-13', ex, deps);
    expect(deps.insertItems).toHaveBeenCalledOnce();
    expect(deps.upsertTifa).toHaveBeenCalledWith('2026-06-13', ['新质生产力']);
    expect(deps.insertSectorSignals).toHaveBeenCalledOnce();
    expect(calls).toContain('mark'); // broadcast_day status -> 'extracted' + segment stats
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** Run: `npm test src/extract/persist.test.ts`

- [ ] **Step 3: Implement `src/extract/persist.ts`.** Pure orchestration over injected DB ops; DEFAULT_DEPS wraps Drizzle.
```typescript
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { item, tifa, tifaMention, sectorSignal, broadcastDay } from '@/db/schema';
import { buildExtractionRows, type SegmentStats } from './rows';
import type { Extraction } from './schema';

export interface PersistDeps {
  insertItems: (rows: ReturnType<typeof buildExtractionRows>['items']) => Promise<void>;
  upsertTifa: (day: string, terms: string[]) => Promise<void>;
  insertTifaMentions: (rows: ReturnType<typeof buildExtractionRows>['tifaMentions']) => Promise<void>;
  insertSectorSignals: (rows: ReturnType<typeof buildExtractionRows>['sectorSignals']) => Promise<void>;
  markExtracted: (day: string, stats: SegmentStats) => Promise<void>;
}

const DEFAULT_DEPS: PersistDeps = {
  insertItems: async (rows) => { if (rows.length) await getDb().insert(item).values(rows); },
  upsertTifa: async (day, terms) => {
    if (!terms.length) return;
    await getDb().insert(tifa)
      .values(terms.map((term) => ({ term, firstSeen: day })))
      .onConflictDoNothing({ target: tifa.term }); // first_seen kept from earliest insert
  },
  insertTifaMentions: async (rows) => { if (rows.length) await getDb().insert(tifaMention).values(rows); },
  insertSectorSignals: async (rows) => { if (rows.length) await getDb().insert(sectorSignal).values(rows); },
  markExtracted: async (day, stats) => {
    await getDb().update(broadcastDay).set({ status: 'extracted', segmentStats: stats }).where(eq(broadcastDay.date, day));
  },
};

export async function persistExtraction(day: string, ex: Extraction, deps: PersistDeps = DEFAULT_DEPS): Promise<void> {
  const rows = buildExtractionRows(day, ex);
  await deps.upsertTifa(day, rows.tifaTerms);
  await deps.insertItems(rows.items);
  await deps.insertTifaMentions(rows.tifaMentions);
  await deps.insertSectorSignals(rows.sectorSignals);
  await deps.markExtracted(day, rows.segmentStats);
}
```
(`inArray` import is available if you need it; remove the import if unused to keep tsc/lint clean.)

- [ ] **Step 4: Run — expect PASS.** Run: `npm test src/extract/persist.test.ts`

- [ ] **Step 5: Write the failing run test** — `src/extract/run.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { extractDay, shouldSkipExtraction } from './run';
import type { Extraction } from './schema';

const ex: Extraction = { items: [], tifa: [], sectors: [] };

describe('shouldSkipExtraction', () => {
  it('skips when already extracted', () => {
    expect(shouldSkipExtraction({ status: 'extracted', blobUrl: 'x' })).toBe(true);
  });
  it('does not skip ingested-only', () => {
    expect(shouldSkipExtraction({ status: 'ingested', blobUrl: 'x' })).toBe(false);
  });
});

describe('extractDay', () => {
  it('skips when already extracted', async () => {
    const deps = {
      getDay: vi.fn(async () => ({ status: 'extracted', blobUrl: 'x' })),
      loadText: vi.fn(), extract: vi.fn(), persist: vi.fn(),
    };
    const r = await extractDay('2026-06-13', deps);
    expect(r.skipped).toBe(true);
    expect(deps.extract).not.toHaveBeenCalled();
  });
  it('loads text, extracts, persists when ingested', async () => {
    const deps = {
      getDay: vi.fn(async () => ({ status: 'ingested', blobUrl: 'https://blob/x.txt' })),
      loadText: vi.fn(async () => '正文'),
      extract: vi.fn(async () => ex),
      persist: vi.fn(async () => {}),
    };
    const r = await extractDay('2026-06-13', deps);
    expect(r.skipped).toBe(false);
    expect(deps.loadText).toHaveBeenCalledWith('https://blob/x.txt');
    expect(deps.extract).toHaveBeenCalledWith('正文');
    expect(deps.persist).toHaveBeenCalledWith('2026-06-13', ex);
  });
  it('throws if the day was never ingested', async () => {
    const deps = { getDay: vi.fn(async () => undefined), loadText: vi.fn(), extract: vi.fn(), persist: vi.fn() };
    await expect(extractDay('2026-06-13', deps)).rejects.toThrow(/not ingested/i);
  });
});
```

- [ ] **Step 6: Run — expect FAIL.** Run: `npm test src/extract/run.test.ts`

- [ ] **Step 7: Implement `src/extract/run.ts`:**
```typescript
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { broadcastDay } from '@/db/schema';
import { extractTranscript } from './extract';
import { persistExtraction } from './persist';
import type { Extraction } from './schema';

export function shouldSkipExtraction(day: { status?: string } | undefined): boolean {
  return day?.status === 'extracted';
}

export interface ExtractRunDeps {
  getDay: (date: string) => Promise<{ status?: string; blobUrl?: string | null } | undefined>;
  loadText: (blobUrl: string) => Promise<string>;
  extract: (text: string) => Promise<Extraction>;
  persist: (date: string, ex: Extraction) => Promise<void>;
}

const DEFAULT_DEPS: ExtractRunDeps = {
  getDay: async (date) => {
    const rows = await getDb().select().from(broadcastDay).where(eq(broadcastDay.date, date)).limit(1);
    return rows[0];
  },
  loadText: async (blobUrl) => {
    const res = await fetch(blobUrl);
    if (!res.ok) throw new Error(`failed to load transcript blob: HTTP ${res.status}`);
    return res.text();
  },
  extract: (text) => extractTranscript(text),
  persist: (date, ex) => persistExtraction(date, ex),
};

export async function extractDay(
  date: string,
  deps: ExtractRunDeps = DEFAULT_DEPS,
): Promise<{ date: string; skipped: boolean }> {
  const day = await deps.getDay(date);
  if (!day || !day.blobUrl) throw new Error(`day ${date} is not ingested (no transcript)`);
  if (shouldSkipExtraction(day)) return { date, skipped: true };
  const text = await deps.loadText(day.blobUrl);
  const ex = await deps.extract(text);
  await deps.persist(date, ex);
  return { date, skipped: false };
}
```

- [ ] **Step 8: Run — expect PASS** (run.test 5 tests). Then full `npm test` + `npx tsc --noEmit` + `npm run build`.

- [ ] **Step 9: Write `scripts/extract-backfill.ts`** (typecheck only; not run here):
```typescript
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { broadcastDay } from '@/db/schema';
import { extractDay } from '@/extract/run';

async function main() {
  const rows = await getDb().select({ date: broadcastDay.date })
    .from(broadcastDay).where(eq(broadcastDay.status, 'ingested'));
  let ok = 0, fail = 0;
  for (const { date } of rows) {
    try { await extractDay(date); ok++; console.log(`✓ ${date}`); }
    catch (e) { fail++; console.error(`✗ ${date}: ${e instanceof Error ? e.message : e}`); }
  }
  console.log(`extraction done. ok=${ok} failed=${fail} of ${rows.length}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```
Add package.json script: `"extract:backfill": "tsx scripts/extract-backfill.ts"`.

- [ ] **Step 10: Verify.** `npm test` (all pass), `npx tsc --noEmit` (clean), `npm run build` (green). Smoke-check the script wiring: `npx tsx scripts/extract-backfill.ts` should fail on `DATABASE_URL is not set` (proves alias + wiring), NOT a module error.

- [ ] **Step 11: Commit**
```bash
git add -A
git commit -m "feat(extract): persist + idempotent extractDay + backfill script"
```

---

## Self-Review

**Spec coverage (P2 / §4.1, §3②):** items with 三段式 segment + order + summary ✓; 提法 with per-day mentions + first_seen ✓; sector signals (polarity+strength) ✓; segment stats on broadcast_day ✓; runs over all ingested history via backfill ✓; idempotent (status 'extracted') ✓; uses the configurable cheap-model stage ('extraction' → DeepSeek Flash by default) ✓. Out of scope: radar/deep interpretation (P4), thread synthesis (P5), UI (P3).

**Placeholder scan:** none. The "adjust generateObject to installed API" note is a real verification, not a blank.

**Type consistency:** `Extraction`/`Segment`/`SEGMENTS` from schema.ts used in prompt/extract/rows/persist/run. `ExtractionRows` shape consumed by persist's deps. Row shapes match P0 columns (`item`, `tifa`, `tifa_mention`, `sector_signal`, `broadcast_day.segment_stats/status`). `extractDay`/`persistExtraction`/`extractTranscript` signatures consistent across run/persist/extract and tests.

---

## Live run (user step, after merge — needs DeepSeek key + ingested data)
1. Ensure `DATABASE_URL`, `DEEPSEEK_API_KEY` set and P1 backfill has populated `broadcast_day` + Blob.
2. Verify the real DeepSeek V4 model-id strings in `src/llm/defaults.ts` (or set via admin/`stage_config`).
3. `npm run extract:backfill` (idempotent; processes ingested-but-not-extracted days).
