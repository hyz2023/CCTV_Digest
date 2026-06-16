# CCTV_Digest — P6 Daily Cron Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.

**Goal:** Run the pipeline automatically on Vercel Cron: a daily job that chains ingest → extract → analyze for the target day (idempotent, per-stage `pipeline_run` logging, stop-on-failure since stages depend), and a weekly job that re-synthesizes threads. Cron endpoints are auth-gated by a shared secret.

**Architecture:** `src/lib/cron-auth.ts` — pure `isAuthorizedCron(headers, env)` (Bearer CRON_SECRET). `src/pipeline/daily.ts` — `runDailyPipeline(date, deps)` orchestrator chaining the existing `ingestDay`/`extractDay`/`analyzeDay`, logging each stage to `pipeline_run`, stopping on first failure (TDD with injected stage fns). Two App Router cron routes call these. `vercel.json` declares the schedules (Hobby-compatible: ≤ daily frequency, 2 jobs). Live runs deferred (need creds + CRON_SECRET).

**Tech Stack:** Next.js 16 route handlers, Drizzle (`pipeline_run`), Vitest. Builds on P1 `ingestDay`, P2 `extractDay`, P4 `analyzeDay`, P5 `synthesizeAllThreads`.

**Scope note:** `pipeline_run` logs `{day, stage, status, error}` per stage (run/audit tracking for the P7 admin view). Token/cost columns are left null — capturing them needs the LLM DI wrappers to surface AI-SDK `usage`, a cross-cutting follow-up (noted), not faked here.

---

## File Structure
| File | Responsibility |
|---|---|
| `src/lib/cron-auth.ts` / `.test.ts` | pure `isAuthorizedCron(headers, env)` |
| `src/pipeline/daily.ts` / `.test.ts` | `runDailyPipeline(date, deps)` chain + per-stage logging |
| `src/app/api/cron/daily/route.ts` | daily cron endpoint (auth → run pipeline for target day) |
| `src/app/api/cron/threads/route.ts` | weekly cron endpoint (auth → synthesize threads) |
| `vercel.json` | cron schedules |

---

## Task 1: Cron auth + daily pipeline orchestration

**Files:** Create `src/lib/cron-auth.ts`(+test), `src/pipeline/daily.ts`(+test).

- [ ] **Step 1: failing test `src/lib/cron-auth.test.ts`:**
```typescript
import { describe, it, expect } from 'vitest';
import { isAuthorizedCron } from './cron-auth';

describe('isAuthorizedCron', () => {
  it('authorizes a matching Bearer secret', () => {
    expect(isAuthorizedCron({ authorization: 'Bearer s3cret' }, { CRON_SECRET: 's3cret' })).toBe(true);
  });
  it('rejects a wrong secret', () => {
    expect(isAuthorizedCron({ authorization: 'Bearer nope' }, { CRON_SECRET: 's3cret' })).toBe(false);
  });
  it('rejects when no authorization header', () => {
    expect(isAuthorizedCron({}, { CRON_SECRET: 's3cret' })).toBe(false);
  });
  it('rejects (fails closed) when CRON_SECRET is not configured', () => {
    expect(isAuthorizedCron({ authorization: 'Bearer anything' }, {})).toBe(false);
  });
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement `src/lib/cron-auth.ts`:**
```typescript
// Fails closed: only authorizes when CRON_SECRET is configured AND the
// Authorization header matches `Bearer <secret>` (the header Vercel Cron sends
// when CRON_SECRET is set in the project env).
export function isAuthorizedCron(
  headers: { authorization?: string | null },
  env: Record<string, string | undefined> = process.env,
): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  return headers.authorization === `Bearer ${secret}`;
}
```

- [ ] **Step 4: run → PASS.**

- [ ] **Step 5: failing test `src/pipeline/daily.test.ts`:**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { runDailyPipeline } from './daily';

function deps(overrides = {}) {
  return {
    ingest: vi.fn(async () => {}),
    extract: vi.fn(async () => {}),
    analyze: vi.fn(async () => {}),
    log: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('runDailyPipeline', () => {
  it('runs ingest → extract → analyze in order and logs each ok', async () => {
    const d = deps();
    const r = await runDailyPipeline('2026-06-13', d);
    expect(d.ingest).toHaveBeenCalledWith('2026-06-13');
    expect(d.extract).toHaveBeenCalledWith('2026-06-13');
    expect(d.analyze).toHaveBeenCalledWith('2026-06-13');
    expect(r.results.map((x) => x.stage)).toEqual(['ingest', 'extract', 'analyze']);
    expect(r.results.every((x) => x.status === 'ok')).toBe(true);
    expect(d.log).toHaveBeenCalledTimes(3);
  });

  it('stops after a failing stage and logs the error (does not run later stages)', async () => {
    const d = deps({ extract: vi.fn(async () => { throw new Error('boom'); }) });
    const r = await runDailyPipeline('2026-06-13', d);
    expect(d.analyze).not.toHaveBeenCalled();
    expect(r.results.map((x) => `${x.stage}:${x.status}`)).toEqual(['ingest:ok', 'extract:error']);
    expect(r.results[1].error).toMatch(/boom/);
    expect(d.log).toHaveBeenCalledWith(expect.objectContaining({ day: '2026-06-13', stage: 'extract', status: 'error' }));
  });
});
```

- [ ] **Step 6: run → FAIL.**

- [ ] **Step 7: implement `src/pipeline/daily.ts`:**
```typescript
import { getDb } from '@/db/client';
import { pipelineRun } from '@/db/schema';
import { ingestDay } from '@/ingest/ingest';
import { extractDay } from '@/extract/run';
import { analyzeDay } from '@/interpret/run';

export interface StageResult { stage: string; status: 'ok' | 'error'; error?: string }
export interface DailyResult { date: string; results: StageResult[] }

export interface RunLog { day: string; stage: string; status: 'ok' | 'error'; error?: string }
export interface DailyDeps {
  ingest: (date: string) => Promise<unknown>;
  extract: (date: string) => Promise<unknown>;
  analyze: (date: string) => Promise<unknown>;
  log: (entry: RunLog) => Promise<void>;
}

const DEFAULT_DEPS: DailyDeps = {
  ingest: (date) => ingestDay(date),
  extract: (date) => extractDay(date),
  analyze: (date) => analyzeDay(date),
  log: async (entry) => { await getDb().insert(pipelineRun).values({ day: entry.day, stage: entry.stage, status: entry.status, error: entry.error ?? null }); },
};

export async function runDailyPipeline(date: string, deps: DailyDeps = DEFAULT_DEPS): Promise<DailyResult> {
  const stages: [string, (d: string) => Promise<unknown>][] = [
    ['ingest', deps.ingest],
    ['extract', deps.extract],
    ['analyze', deps.analyze],
  ];
  const results: StageResult[] = [];
  for (const [stage, fn] of stages) {
    try {
      await fn(date);
      await deps.log({ day: date, stage, status: 'ok' });
      results.push({ stage, status: 'ok' });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await deps.log({ day: date, stage, status: 'error', error });
      results.push({ stage, status: 'error', error });
      break; // later stages depend on earlier ones
    }
  }
  return { date, results };
}
```

- [ ] **Step 8: run → PASS (6 tests across the two files).** Then `npm test` + `npx tsc --noEmit`.

- [ ] **Step 9: commit** — `git add -A && git commit -m "feat(cron): cron auth + daily pipeline orchestration with pipeline_run logging"`

---

## Task 2: Cron routes + Vercel schedule

**Files:** Create `src/app/api/cron/daily/route.ts`, `src/app/api/cron/threads/route.ts`, `vercel.json`.

- [ ] **Step 1: implement `src/app/api/cron/daily/route.ts`** (no unit test — thin handler; verified via build + a manual curl returning 401 without the secret). Determine the target day from `?date=` or default to today (UTC). Auth-gate; run the pipeline; return the summary JSON.
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { runDailyPipeline } from '@/pipeline/daily';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // allow the chain time (Fluid default ceiling)

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron({ authorization: req.headers.get('authorization') })) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const result = await runDailyPipeline(date);
  return NextResponse.json(result);
}
```

- [ ] **Step 2: implement `src/app/api/cron/threads/route.ts`:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { synthesizeAllThreads } from '@/threads/run';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron({ authorization: req.headers.get('authorization') })) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await synthesizeAllThreads();
  return NextResponse.json(result);
}
```

- [ ] **Step 3: create `vercel.json`** (Hobby-compatible: ≤ daily frequency, 2 jobs). Daily ~21:00 Beijing (13:00 UTC, a couple hours after the 19:00 broadcast); threads weekly Sunday.
```json
{
  "crons": [
    { "path": "/api/cron/daily", "schedule": "0 13 * * *" },
    { "path": "/api/cron/threads", "schedule": "0 14 * * 0" }
  ]
}
```

- [ ] **Step 4: verify.** `npm test` (all pass), `npx tsc --noEmit` (clean), `npm run build` (green; `/api/cron/daily` and `/api/cron/threads` in the route list). Render smoke-check (no DB/secret): start dev on PORT=3100, confirm both cron routes return **401** without an Authorization header (auth gate works before any DB call):
```bash
(PORT=3100 npm run dev > /tmp/d.log 2>&1 &) ; sleep 12
echo "daily: $(curl -s -o /dev/null -w '%{http_code}' localhost:3100/api/cron/daily)"
echo "threads: $(curl -s -o /dev/null -w '%{http_code}' localhost:3100/api/cron/threads)"
pkill -f "next dev" || true
```
Expect both **401**. Report the numbers.

- [ ] **Step 5: commit** — `git add -A && git commit -m "feat(cron): daily + weekly Vercel Cron routes (auth-gated) and vercel.json schedule"`

---

## Self-Review
**Spec coverage (P6 / §9):** daily auto-run chaining抓取→提取→深度解读 ✓; idempotent (each stage skips done days via P1/P2/P4 status gates) ✓; per-stage `pipeline_run` logging ✓; weekly thread re-synthesis ✓; Vercel Cron (Hobby-compatible) ✓; auth-gated endpoints (fail-closed) ✓; stop-on-failure (stages depend) ✓. Deferred (noted): token/cost capture in `pipeline_run` (needs LLM usage plumbing). Out of scope: admin UI (P7).

**Placeholder scan:** none. Token/cost deferral explicit; cron times documented.

**Type consistency:** `DailyDeps`/`RunLog`/`StageResult` consistent; routes use `isAuthorizedCron` + `runDailyPipeline`/`synthesizeAllThreads`; `pipeline_run` insert matches schema columns.

## Live note
Set `CRON_SECRET` in Vercel project env (and `DATABASE_URL`/`BLOB_READ_WRITE_TOKEN`/`DEEPSEEK_API_KEY`). Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically. The daily job ingests+extracts+analyzes the day; the weekly job re-synthesizes threads. Manually trigger: `curl -H "Authorization: Bearer $CRON_SECRET" https://<deploy>/api/cron/daily`.
