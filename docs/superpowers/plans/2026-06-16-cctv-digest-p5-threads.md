# CCTV_Digest — P5 Thread Synthesis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.

**Goal:** Synthesize the 提法 time-series into a small set of **objectively-emergent named 主线 (threads)** — count decided by the data, not a target — each with member terms, a current read, a trajectory (`thread_point` over months), and supporting evidence (`thread_evidence`). Then feed these threads into the River homepage (replacing the interim top-提法 streams) and add a thread-detail page.

**Architecture:** `src/threads/` — a pure input-aggregator (top 提法 monthly trajectories), a Zod `ThreadSet` schema + a Chinese clustering prompt (anti-overfitting: a thread must clear sustained-emphasis + cross-time-persistence bars), a dependency-injected `synthesizeThreads` LLM call (DeepSeek Pro / 'thread' stage), pure row builders (`thread_point` from member terms × mentions; evidence), idempotent persist + runner. UI: a `getThreadStreamSeries()` that builds the River `StreamSeries` from `thread_point` (fallback to top-提法 when no threads yet) + `/thread/[id]` detail page. Pure logic TDD'd; LLM/DB injected.

**Tech Stack:** TypeScript, `ai` v6 `generateObject`, `zod`, Drizzle, Vitest, Next.js. Builds on P2 (`tifa_mention`), P4 (`daily_interpretation.thread`), P3 (`@/viz`, RiverChart), schema `thread`/`thread_point`/`thread_evidence`.

**Anti-overfitting (spec §4.4):** the prompt requires each thread to be backed by recurring 提法 across multiple months; threads carry `status` (active/merged/split/faded). Count is emergent — "宁可少一条，不可凑数".

---

## File Structure
| File | Responsibility |
|---|---|
| `src/threads/aggregate.ts` / `.test.ts` | pure: build the LLM input (top-提法 monthly trajectories + recent 主线 labels) |
| `src/threads/schema.ts` | Zod `ThreadSetSchema` + types |
| `src/threads/prompt.ts` / `.test.ts` | `buildThreadPrompt(input)` (emergent clustering, anti-overfit) |
| `src/threads/synthesize.ts` / `.test.ts` | `synthesizeThreads(input, deps)` LLM call (injectable) |
| `src/threads/rows.ts` / `.test.ts` | pure: ThreadSet + mentions → thread / thread_point / thread_evidence rows |
| `src/threads/persist.ts` / `.test.ts` | replace-all persist of threads + points + evidence (injected DB) |
| `src/threads/run.ts` / `.test.ts` | `synthesizeAllThreads(deps)` (load mentions+labels → synthesize → rows → persist) |
| `src/data/threads.ts` / `.test.ts` | `getThreadStreamSeries()` (thread_point → StreamSeries; fallback to tifa) |
| `src/app/thread/[id]/page.tsx` | thread-detail page |
| `scripts/synthesize-threads.ts` | run synthesis (tsx) |

---

## Task 1: Input aggregation + thread schema/prompt/LLM

**Files:** Create `src/threads/aggregate.ts`(+test), `src/threads/schema.ts`, `src/threads/prompt.ts`(+test), `src/threads/synthesize.ts`(+test).

- [ ] **Step 1: failing test `src/threads/aggregate.test.ts`:**
```typescript
import { describe, it, expect } from 'vitest';
import { buildThreadInput } from './aggregate';

const mentions = [
  { day: '2026-01-05', term: '新质生产力', count: 3 },
  { day: '2026-02-05', term: '新质生产力', count: 4 },
  { day: '2026-01-05', term: '科技自立', count: 2 },
  { day: '2026-01-05', term: '小词', count: 1 },
];

describe('buildThreadInput', () => {
  const input = buildThreadInput(mentions, ['科技', '科技'], { topTerms: 2 });
  it('keeps the top-N terms with their monthly trajectories', () => {
    expect(input.terms.map((t) => t.term).sort()).toEqual(['新质生产力', '科技自立']);
    const t = input.terms.find((x) => x.term === '新质生产力')!;
    expect(t.trajectory).toEqual([{ period: '2026-01', value: 3 }, { period: '2026-02', value: 4 }]);
  });
  it('passes through recent thread labels (deduped with counts)', () => {
    expect(input.recentThreadLabels).toContainEqual({ label: '科技', count: 2 });
  });
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement `src/threads/aggregate.ts`** (pure). Reuse the monthly bucketing idea from `@/viz/series`. `buildThreadInput(mentions, threadLabels, opts)`:
```typescript
export interface Mention { day: string; term: string; count: number }
export interface TermTrajectory { term: string; total: number; trajectory: { period: string; value: number }[] }
export interface ThreadInput { terms: TermTrajectory[]; recentThreadLabels: { label: string; count: number }[] }

const month = (d: string) => d.slice(0, 7);

export function buildThreadInput(mentions: Mention[], threadLabels: string[], opts: { topTerms?: number } = {}): ThreadInput {
  const topTerms = opts.topTerms ?? 40;
  const totals = new Map<string, number>();
  for (const m of mentions) totals.set(m.term, (totals.get(m.term) ?? 0) + m.count);
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, topTerms).map(([t]) => t);
  const terms: TermTrajectory[] = top.map((term) => {
    const byMonth = new Map<string, number>();
    for (const m of mentions) if (m.term === term) byMonth.set(month(m.day), (byMonth.get(month(m.day)) ?? 0) + m.count);
    const trajectory = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([period, value]) => ({ period, value }));
    return { term, total: totals.get(term)!, trajectory };
  });
  const labelCounts = new Map<string, number>();
  for (const l of threadLabels) if (l) labelCounts.set(l, (labelCounts.get(l) ?? 0) + 1);
  const recentThreadLabels = [...labelCounts.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
  return { terms, recentThreadLabels };
}
```

- [ ] **Step 4: run → PASS.** Then `npm test`.

- [ ] **Step 5: `src/threads/schema.ts`:**
```typescript
import { z } from 'zod';
export const THREAD_STATUS = ['active', 'merged', 'split', 'faded'] as const;
export const ThreadSetSchema = z.object({
  threads: z.array(z.object({
    name: z.string().min(1).describe('主线名，如 新质生产力·科技自立'),
    status: z.enum(THREAD_STATUS),
    memberTerms: z.array(z.string().min(1)).min(1).describe('归属该主线的提法（来自输入的词）'),
    read: z.string().min(1).describe('当下解读：这条主线眼下在表达什么'),
  })).describe('客观存在的主线集合；数量由数据决定，宁缺毋滥'),
});
export type ThreadSet = z.infer<typeof ThreadSetSchema>;
```

- [ ] **Step 6: failing prompt test `src/threads/prompt.test.ts`:**
```typescript
import { describe, it, expect } from 'vitest';
import { buildThreadPrompt } from './prompt';

const input = {
  terms: [{ term: '新质生产力', total: 30, trajectory: [{ period: '2025-01', value: 5 }] }],
  recentThreadLabels: [{ label: '科技', count: 4 }],
};

describe('buildThreadPrompt', () => {
  const p = buildThreadPrompt(input);
  it('includes the term trajectories and labels', () => {
    expect(p).toContain('新质生产力');
    expect(p).toContain('科技');
  });
  it('instructs emergent, anti-overfit clustering', () => {
    expect(p).toMatch(/主线/);
    expect(p).toMatch(/数量.*数据|不预设|宁缺毋滥|不要凑/);
    expect(p).toMatch(/持续|跨.*月|多月/);
  });
});
```

- [ ] **Step 7: run → FAIL.**

- [ ] **Step 8: `src/threads/prompt.ts`:**
```typescript
export interface PromptTerm { term: string; total: number; trajectory: { period: string; value: number }[] }
export interface ThreadPromptInput { terms: PromptTerm[]; recentThreadLabels: { label: string; count: number }[] }

export function buildThreadPrompt(input: ThreadPromptInput): string {
  const termsText = input.terms
    .map((t) => `  - ${t.term}（共${t.total}）: ${t.trajectory.map((p) => `${p.period}:${p.value}`).join(' ')}`)
    .join('\n');
  const labelsText = input.recentThreadLabels.map((l) => `${l.label}(${l.count})`).join('、') || '（无）';
  return [
    '你在梳理中国《新闻联播》多年的「发展主线（脉络）」。下面给你各「提法/关键词」的逐月强度轨迹，',
    '以及近期解读里出现过的主线标签。请把它们聚合成【客观存在】的几条主线。',
    '',
    '原则（重要）：',
    '- 主线的【数量由数据决定，不预设】；宁缺毋滥、不要为凑数而造主线。',
    '- 一条主线必须：由一组相关提法构成、且这些提法在多个月份里持续出现（跨时间持续性），而非昙花一现。',
    '- 给每条主线：name（名）、status（active/merged/split/faded）、memberTerms（归属的提法，须来自下方输入词）、read（当下解读）。',
    '',
    '=== 提法逐月轨迹 ===',
    termsText,
    '=== 近期解读中的主线标签 ===',
    labelsText,
  ].join('\n');
}
```

- [ ] **Step 9: run → PASS.**

- [ ] **Step 10: failing synthesize test `src/threads/synthesize.test.ts`:**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { synthesizeThreads } from './synthesize';
import type { ThreadSet } from './schema';

const canned: ThreadSet = { threads: [{ name: '科技', status: 'active', memberTerms: ['新质生产力'], read: 'r' }] };

describe('synthesizeThreads', () => {
  it('returns the model ThreadSet via injected generate', async () => {
    const generate = vi.fn(async () => canned);
    const out = await synthesizeThreads({ terms: [{ term: '新质生产力', total: 1, trajectory: [] }], recentThreadLabels: [] }, { generate });
    expect(out).toEqual(canned);
  });
  it('throws when there are no terms', async () => {
    const generate = vi.fn(async () => canned);
    await expect(synthesizeThreads({ terms: [], recentThreadLabels: [] }, { generate })).rejects.toThrow(/no terms|empty/i);
    expect(generate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 11: run → FAIL.**

- [ ] **Step 12: `src/threads/synthesize.ts`:**
```typescript
import { generateObject } from 'ai';
import { loadStageConfig } from '@/llm/loadStageConfig';
import { getModel } from '@/llm/model';
import { buildThreadPrompt, type ThreadPromptInput } from './prompt';
import { ThreadSetSchema, type ThreadSet } from './schema';

export interface SynthesizeDeps { generate: (input: ThreadPromptInput) => Promise<ThreadSet> }

const DEFAULT_DEPS: SynthesizeDeps = {
  generate: async (input) => {
    const cfg = await loadStageConfig('thread');
    const { object } = await generateObject({ model: getModel(cfg), schema: ThreadSetSchema, prompt: buildThreadPrompt(input) });
    return object;
  },
};

export async function synthesizeThreads(input: ThreadPromptInput, deps: SynthesizeDeps = DEFAULT_DEPS): Promise<ThreadSet> {
  if (!input.terms.length) throw new Error('cannot synthesize threads with no terms');
  return deps.generate(input);
}
```

- [ ] **Step 13: run → PASS.** Then full `npm test` + `npx tsc --noEmit` + `npm run build`.

- [ ] **Step 14: commit** — `git add -A && git commit -m "feat(threads): input aggregation + thread schema/prompt/LLM synthesis"`

---

## Task 2: Pure thread→rows + River thread-series

**Files:** Create `src/threads/rows.ts`(+test), `src/data/threads.ts`(+test).

- [ ] **Step 1: failing test `src/threads/rows.test.ts`:**
```typescript
import { describe, it, expect } from 'vitest';
import { buildThreadRows } from './rows';
import type { ThreadSet } from './schema';

const set: ThreadSet = {
  threads: [
    { name: '科技', status: 'active', memberTerms: ['新质生产力', '科技自立'], read: 'r1' },
    { name: '内需', status: 'active', memberTerms: ['扩内需'], read: 'r2' },
  ],
};
const mentions = [
  { day: '2026-01-05', term: '新质生产力', count: 3 },
  { day: '2026-01-20', term: '科技自立', count: 2 },
  { day: '2026-02-05', term: '新质生产力', count: 4 },
  { day: '2026-01-05', term: '扩内需', count: 1 },
];

describe('buildThreadRows', () => {
  const r = buildThreadRows(set, mentions, ['#f00', '#0f0']);
  it('emits one thread row per thread with color + status + read in meta', () => {
    expect(r.threads).toHaveLength(2);
    expect(r.threads[0]).toMatchObject({ name: '科技', status: 'active', color: '#f00' });
    expect(r.threads[0].meta).toMatchObject({ memberTerms: ['新质生产力', '科技自立'], read: 'r1' });
  });
  it('computes thread_point monthly trajectories summing member-term mentions', () => {
    const tech = r.points.filter((p) => p.threadName === '科技');
    expect(tech).toContainEqual({ threadName: '科技', period: '2026-01', intensity: 5 }); // 3 + 2
    expect(tech).toContainEqual({ threadName: '科技', period: '2026-02', intensity: 4 });
  });
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: `src/threads/rows.ts`** (pure; `threadName` is a join key the persist layer resolves to ids):
```typescript
import type { ThreadSet } from './schema';

export interface Mention { day: string; term: string; count: number }
export interface ThreadRow { name: string; status: string; color: string; meta: { memberTerms: string[]; read: string } }
export interface ThreadPointRow { threadName: string; period: string; intensity: number }
export interface ThreadRows { threads: ThreadRow[]; points: ThreadPointRow[] }

const month = (d: string) => d.slice(0, 7);

export function buildThreadRows(set: ThreadSet, mentions: Mention[], colors: string[]): ThreadRows {
  const threads: ThreadRow[] = set.threads.map((t, i) => ({
    name: t.name, status: t.status, color: colors[i % colors.length],
    meta: { memberTerms: t.memberTerms, read: t.read },
  }));
  const points: ThreadPointRow[] = [];
  for (const t of set.threads) {
    const member = new Set(t.memberTerms);
    const byMonth = new Map<string, number>();
    for (const m of mentions) if (member.has(m.term)) byMonth.set(month(m.day), (byMonth.get(month(m.day)) ?? 0) + m.count);
    for (const [period, intensity] of [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      points.push({ threadName: t.name, period, intensity });
    }
  }
  return { threads, points };
}
```

- [ ] **Step 4: run → PASS.**

- [ ] **Step 5: failing test `src/data/threads.test.ts`:**
```typescript
import { describe, it, expect } from 'vitest';
import { threadPointsToStreamSeries } from './threads';

describe('threadPointsToStreamSeries', () => {
  it('pivots thread points into an aligned StreamSeries', () => {
    const s = threadPointsToStreamSeries([
      { threadName: '科技', color: '#f00', period: '2026-01', intensity: 5 },
      { threadName: '科技', color: '#f00', period: '2026-02', intensity: 4 },
      { threadName: '内需', color: '#0f0', period: '2026-02', intensity: 3 },
    ]);
    expect(s.periods).toEqual(['2026-01', '2026-02']);
    const tech = s.streams.find((x) => x.term === '科技')!;
    expect(tech.values).toEqual([5, 4]);
    const need = s.streams.find((x) => x.term === '内需')!;
    expect(need.values).toEqual([0, 3]);
  });
  it('returns empty series for no points', () => {
    expect(threadPointsToStreamSeries([])).toEqual({ periods: [], streams: [] });
  });
});
```

- [ ] **Step 6: run → FAIL.**

- [ ] **Step 7: `src/data/threads.ts`** — pure pivot + a server query (fallback to tifa streams handled by the page). `StreamSeries` shape matches `@/viz/series`.
```typescript
import { getDb } from '@/db/client';
import { thread, threadPoint } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { StreamSeries } from '@/viz/series';

export interface ThreadPointFull { threadName: string; color: string; period: string; intensity: number }

export function threadPointsToStreamSeries(points: ThreadPointFull[]): StreamSeries {
  const periods = [...new Set(points.map((p) => p.period))].sort();
  const pIndex = new Map(periods.map((p, i) => [p, i]));
  const byThread = new Map<string, { color: string; values: number[] }>();
  for (const p of points) {
    if (!byThread.has(p.threadName)) byThread.set(p.threadName, { color: p.color, values: new Array(periods.length).fill(0) });
    byThread.get(p.threadName)!.values[pIndex.get(p.period)!] += p.intensity;
  }
  return { periods, streams: [...byThread.entries()].map(([term, v]) => ({ term, color: v.color, values: v.values })) };
}

// Returns a StreamSeries from synthesized threads, or null if none exist (caller falls back to tifa streams).
export async function getThreadStreamSeries(): Promise<StreamSeries | null> {
  try {
    const threads = await getDb().select().from(thread);
    if (!threads.length) return null;
    const colorByName = new Map(threads.map((t) => [t.name, t.color ?? '#888']));
    const pts = await getDb().select().from(threadPoint);
    if (!pts.length) return null;
    // thread_point has thread_id; resolve to name+color
    const nameById = new Map(threads.map((t) => [t.id, t.name]));
    const full: ThreadPointFull[] = pts
      .filter((p) => nameById.has(p.threadId))
      .map((p) => ({ threadName: nameById.get(p.threadId)!, color: colorByName.get(nameById.get(p.threadId)!) ?? '#888', period: p.period, intensity: p.intensity }));
    return threadPointsToStreamSeries(full);
  } catch {
    return null;
  }
}
```

- [ ] **Step 8: run → PASS.** Then `npm test` + `npx tsc --noEmit`.

- [ ] **Step 9: commit** — `git add -A && git commit -m "feat(threads): pure thread/point row builders + River thread-series pivot"`

---

## Task 3: Persist + run + UI wiring (homepage threads + detail page)

**Files:** Create `src/threads/persist.ts`(+test), `src/threads/run.ts`(+test), `scripts/synthesize-threads.ts`, `src/app/thread/[id]/page.tsx`; edit `src/app/page.tsx`.

- [ ] **Step 1: failing persist test `src/threads/persist.test.ts`:**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { persistThreads } from './persist';
import type { ThreadRows } from './rows';

const rows: ThreadRows = {
  threads: [{ name: '科技', status: 'active', color: '#f00', meta: { memberTerms: ['x'], read: 'r' } }],
  points: [{ threadName: '科技', period: '2026-01', intensity: 5 }],
};

describe('persistThreads', () => {
  it('clears prior threads then writes threads + resolves points to ids (in order)', async () => {
    const calls: string[] = [];
    const deps = {
      clearAll: vi.fn(async () => { calls.push('clear'); }),
      insertThreads: vi.fn(async () => { calls.push('threads'); return new Map([['科技', 1]]); }),
      insertPoints: vi.fn(async () => { calls.push('points'); }),
    };
    await persistThreads(rows, deps);
    expect(calls).toEqual(['clear', 'threads', 'points']);
    expect(deps.insertPoints).toHaveBeenCalledWith([{ threadId: 1, period: '2026-01', intensity: 5 }]);
  });
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: `src/threads/persist.ts`** — replace-all (threads are a full re-synthesis each run). DEFAULT clears thread+thread_point+thread_evidence, inserts threads (returns name→id map), maps points to ids.
```typescript
import { getDb } from '@/db/client';
import { thread, threadPoint, threadEvidence } from '@/db/schema';
import type { ThreadRows } from './rows';

export interface ThreadPersistDeps {
  clearAll: () => Promise<void>;
  insertThreads: (rows: ThreadRows['threads']) => Promise<Map<string, number>>;
  insertPoints: (rows: { threadId: number; period: string; intensity: number }[]) => Promise<void>;
}

const DEFAULT_DEPS: ThreadPersistDeps = {
  clearAll: async () => {
    const db = getDb();
    await db.delete(threadEvidence);
    await db.delete(threadPoint);
    await db.delete(thread);
  },
  insertThreads: async (rows) => {
    if (!rows.length) return new Map();
    const inserted = await getDb().insert(thread)
      .values(rows.map((r) => ({ name: r.name, status: r.status, color: r.color, meta: r.meta })))
      .returning({ id: thread.id, name: thread.name });
    return new Map(inserted.map((i) => [i.name, i.id]));
  },
  insertPoints: async (rows) => { if (rows.length) await getDb().insert(threadPoint).values(rows); },
};

export async function persistThreads(rows: ThreadRows, deps: ThreadPersistDeps = DEFAULT_DEPS): Promise<void> {
  await deps.clearAll();
  const idByName = await deps.insertThreads(rows.threads);
  const points = rows.points
    .filter((p) => idByName.has(p.threadName))
    .map((p) => ({ threadId: idByName.get(p.threadName)!, period: p.period, intensity: p.intensity }));
  await deps.insertPoints(points);
}
```

- [ ] **Step 4: run → PASS.**

- [ ] **Step 5: failing run test `src/threads/run.test.ts`:**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { synthesizeAllThreads } from './run';
import type { ThreadSet } from './schema';

const set: ThreadSet = { threads: [{ name: '科技', status: 'active', memberTerms: ['x'], read: 'r' }] };

describe('synthesizeAllThreads', () => {
  it('aggregates → synthesizes → builds rows → persists', async () => {
    const deps = {
      loadMentions: vi.fn(async () => [{ day: '2026-01-01', term: 'x', count: 2 }]),
      loadThreadLabels: vi.fn(async () => ['科技']),
      synthesize: vi.fn(async () => set),
      persist: vi.fn(async () => {}),
    };
    const r = await synthesizeAllThreads(deps);
    expect(deps.synthesize).toHaveBeenCalledOnce();
    expect(deps.persist).toHaveBeenCalledOnce();
    expect(r.threadCount).toBe(1);
  });
  it('throws when there are no mentions to cluster', async () => {
    const deps = { loadMentions: vi.fn(async () => []), loadThreadLabels: vi.fn(async () => []), synthesize: vi.fn(), persist: vi.fn() };
    await expect(synthesizeAllThreads(deps)).rejects.toThrow(/no mentions|empty/i);
  });
});
```

- [ ] **Step 6: run → FAIL.**

- [ ] **Step 7: `src/threads/run.ts`** (DEFAULT loads tifa_mention + daily_interpretation thread labels; uses STREAM_COLORS from `@/viz/palette`):
```typescript
import { getDb } from '@/db/client';
import { tifaMention, dailyInterpretation } from '@/db/schema';
import { STREAM_COLORS } from '@/viz/palette';
import { buildThreadInput, type Mention } from './aggregate';
import { synthesizeThreads } from './synthesize';
import { buildThreadRows } from './rows';
import { persistThreads } from './persist';
import type { ThreadSet } from './schema';

export interface ThreadRunDeps {
  loadMentions: () => Promise<Mention[]>;
  loadThreadLabels: () => Promise<string[]>;
  synthesize: (input: ReturnType<typeof buildThreadInput>) => Promise<ThreadSet>;
  persist: (rows: ReturnType<typeof buildThreadRows>) => Promise<void>;
}

const DEFAULT_DEPS: ThreadRunDeps = {
  loadMentions: async () => await getDb().select({ day: tifaMention.day, term: tifaMention.term, count: tifaMention.count }).from(tifaMention) as Mention[],
  loadThreadLabels: async () => {
    const rows = await getDb().select({ topSignals: dailyInterpretation.topSignals }).from(dailyInterpretation);
    const labels: string[] = [];
    for (const r of rows) for (const s of (r.topSignals as { thread?: string }[] ?? [])) if (s.thread) labels.push(s.thread);
    return labels;
  },
  synthesize: (input) => synthesizeThreads(input),
  persist: (rows) => persistThreads(rows),
};

export async function synthesizeAllThreads(deps: ThreadRunDeps = DEFAULT_DEPS): Promise<{ threadCount: number }> {
  const mentions = await deps.loadMentions();
  if (!mentions.length) throw new Error('no mentions to cluster into threads');
  const input = buildThreadInput(mentions, await deps.loadThreadLabels());
  const set = await deps.synthesize(input);
  const rows = buildThreadRows(set, mentions, STREAM_COLORS);
  await deps.persist(rows);
  return { threadCount: set.threads.length };
}
```

- [ ] **Step 8: run → PASS.** Then full `npm test` + tsc + build.

- [ ] **Step 9: UI wiring.**
  - Edit `src/app/page.tsx`: try threads first — `const threadSeries = await getThreadStreamSeries();` (from `@/data/threads`); `const series = threadSeries ?? buildStreamSeries(await getMentions(), { topN: 6 });`. (Threads replace interim tifa streams once synthesized; sample fallback still applies via getMentions.)
  - `src/app/thread/[id]/page.tsx` (force-dynamic): load the thread by id (`getDb().select().from(thread).where(eq(thread.id, Number(id)))`, try/catch → null), its points, render an editorial detail: name (serif), status, the `meta.read`, member terms, and a sparkline of the trajectory. If not found / no DB, show a graceful "暂无数据" with the nav. Keep it simple; reuse Explore's sparkline style.
  - Add a nav link to the homepage masthead is optional; the thread page is reached by clicking a stream later (out of scope — link via URL for now).
  - `scripts/synthesize-threads.ts`: `import { synthesizeAllThreads } from '@/threads/run'` → run, log threadCount. package.json `"threads:synthesize": "tsx scripts/synthesize-threads.ts"`.

- [ ] **Step 10: verify.** `npm test` (all pass), `npx tsc --noEmit` (clean), `npm run build` (green; `/thread/[id]` in routes). Render smoke-check (no DB): start dev on PORT=3100, confirm `/` still returns `<svg` (falls back to tifa sample since no threads) and `/thread/1` returns 200, then stop dev. Report numbers.

- [ ] **Step 11: commit** — `git add -A && git commit -m "feat(threads): persist + synthesize runner + River thread wiring + thread-detail page"`

---

## Self-Review
**Spec coverage (P5 / §4.4, §8):** emergent named threads (count by data, anti-overfit prompt) ✓; status lifecycle field ✓; trajectory (thread_point) ✓; member terms + read in meta ✓; River fed by threads with tifa fallback ✓; thread-detail page ✓; configurable 'thread' stage (DeepSeek Pro) ✓; replace-all idempotent re-synthesis ✓. Evidence (`thread_evidence`) table is cleared but population is deferred (note) — threads link to terms via `meta.memberTerms`; per-day evidence rows can be added when the daily-read links signals→threads (P6 polish). Out of scope: cron (P6), admin (P7).

**Placeholder scan:** none. thread_evidence deferral is explicit.

**Type consistency:** `Mention`/`ThreadSet`/`ThreadRows`/`ThreadPromptInput` consistent across aggregate/prompt/synthesize/rows/persist/run; `StreamSeries` from `@/viz/series` reused by `threadPointsToStreamSeries`; persist resolves `threadName`→id; `STREAM_COLORS` reused.

## Live note
After P4 analysis populates `daily_interpretation` + `tifa_mention` has history, run `npm run threads:synthesize` (needs DeepSeek key) to populate `thread`/`thread_point`. The homepage River then shows synthesized 主线 instead of raw 提法.
