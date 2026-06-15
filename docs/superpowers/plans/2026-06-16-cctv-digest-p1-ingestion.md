# CCTV_Digest — P1 Ingestion + Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fetch a day's 新闻联播 transcript from a fallback chain of sources (govopendata → Tushare → GitHub), store the raw text in Vercel Blob and a `broadcast_day` row in Neon, and provide an idempotent backfill script over a date range.

**Architecture:** A small `src/ingest/` module: a retry/backoff HTTP helper with realistic browser headers (defeats govopendata's bot 403), per-source parsers normalizing to a common `ParsedTranscript`, a `fetchTranscript(date)` that walks the source fallback chain, a storage layer (Blob put + `broadcast_day` upsert), and an idempotent `ingestDay`. A `scripts/backfill.ts` runs it over a range with polite rate-limiting. Pure logic is unit-tested (golden fixtures + injected deps); live runs (Blob/DB/network) are deferred to the user with credentials.

**Tech Stack:** TypeScript, `@vercel/blob`, Drizzle (from P0), Vitest. Sources: govopendata (`cn.govopendata.com/xinwenlianbo/YYYYMMDD/`, HTML, ~1985→now, 403-protected), Tushare `cctv_news` (JSON, 2017→now, needs token), GitHub `DuckBurnIncense/xin-wen-lian-bo` (`master:news/YYYYMMDD.md`, 2023→now, free).

**Builds on P0:** `@/db/client` (lazy `db`, `getDb`), `@/db/schema` (`broadcastDay`, `pipelineRun`), `@/` alias works in tests. Package is CommonJS; Vitest config `vitest.config.mts`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/ingest/http.ts` / `.test.ts` | `fetchWithRetry` — browser headers, retry/backoff, non-retryable 4xx |
| `src/ingest/types.ts` | `TranscriptSource`, `ParsedTranscript` |
| `src/ingest/parsers.ts` / `.test.ts` | `parseGithubMd` / `parseGovopendata` / `parseTushare` → `ParsedTranscript` |
| `src/ingest/__fixtures__/*` | Captured/representative source samples for golden tests |
| `src/ingest/sources.ts` / `.test.ts` | per-source URL+fetch+parse; `fetchTranscript(date, deps)` fallback chain |
| `src/ingest/store.ts` / `.test.ts` | `buildBroadcastDayRow` (pure); `storeTranscript` (Blob put + upsert) |
| `src/ingest/ingest.ts` / `.test.ts` | `dateRange`, `shouldSkip`, `ingestDay(date, deps)` |
| `scripts/backfill.ts` | one-time backfill runner (tsx), polite rate-limit, idempotent |
| `scripts/ingest-day.ts` | manual single-day ingest (tsx) |

---

## Task 1: HTTP fetch helper (retry/backoff + browser headers)

**Files:** Create `src/ingest/http.ts`; Test `src/ingest/http.test.ts`.

- [ ] **Step 1: Write the failing test** — `src/ingest/http.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { fetchWithRetry, BROWSER_HEADERS } from './http';

function res(status: number, body = 'ok'): Response {
  return new Response(body, { status });
}
const noSleep = async () => {};

describe('fetchWithRetry', () => {
  it('returns body text and sends browser headers on success', async () => {
    const fetchImpl = vi.fn(async () => res(200, 'hello'));
    const out = await fetchWithRetry('https://x/', { fetchImpl, sleep: noSleep });
    expect(out).toBe('hello');
    const sentHeaders = (fetchImpl.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(sentHeaders['User-Agent']).toBe(BROWSER_HEADERS['User-Agent']);
    expect(sentHeaders['Accept-Language']).toContain('zh');
  });

  it('retries on 503 then succeeds', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(200, 'recovered'));
    const out = await fetchWithRetry('https://x/', { fetchImpl, sleep: noSleep, maxRetries: 3 });
    expect(out).toBe('recovered');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry a 403 (bot block) — throws immediately', async () => {
    const fetchImpl = vi.fn(async () => res(403));
    await expect(fetchWithRetry('https://x/', { fetchImpl, sleep: noSleep })).rejects.toThrow(/403/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting retries on persistent 500', async () => {
    const fetchImpl = vi.fn(async () => res(500));
    await expect(fetchWithRetry('https://x/', { fetchImpl, sleep: noSleep, maxRetries: 2 }))
      .rejects.toThrow(/500/);
    expect(fetchImpl).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('backs off with increasing delays', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(res(500))
      .mockResolvedValueOnce(res(500))
      .mockResolvedValueOnce(res(200, 'ok'));
    const sleeps: number[] = [];
    const sleep = async (ms: number) => { sleeps.push(ms); };
    await fetchWithRetry('https://x/', { fetchImpl, sleep, maxRetries: 3, baseDelayMs: 100 });
    expect(sleeps).toEqual([100, 200]);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`cannot resolve ./http`). Run: `npm test src/ingest/http.test.ts`

- [ ] **Step 3: Implement** — `src/ingest/http.ts`:

```typescript
export const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

export interface FetchOptions {
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
  maxRetries?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Fetch text with browser headers. Retries 429/5xx with exponential backoff;
 *  4xx (incl. 403 bot-block) is non-retryable — retrying won't help, headers are the fix. */
export async function fetchWithRetry(url: string, opts: FetchOptions = {}): Promise<string> {
  const {
    fetchImpl = fetch,
    headers = {},
    maxRetries = 3,
    baseDelayMs = 500,
    sleep = defaultSleep,
  } = opts;
  const merged = { ...BROWSER_HEADERS, ...headers };

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const r = await fetchImpl(url, { headers: merged });
      if (r.ok) return await r.text();
      if (r.status === 429 || r.status >= 500) {
        lastErr = new Error(`HTTP ${r.status} for ${url}`);
      } else {
        throw new Error(`HTTP ${r.status} for ${url}`); // non-retryable (403/404/...)
      }
    } catch (e) {
      lastErr = e;
      // a thrown non-retryable HTTP error should not be retried
      if (e instanceof Error && /^HTTP (4\d\d)/.test(e.message) && !/HTTP 429/.test(e.message)) {
        throw e;
      }
    }
    if (attempt < maxRetries) await sleep(baseDelayMs * 2 ** attempt);
  }
  throw lastErr instanceof Error ? lastErr : new Error(`fetch failed: ${url}`);
}
```

- [ ] **Step 4: Run it — expect PASS** (5 tests). Run: `npm test src/ingest/http.test.ts`

- [ ] **Step 5: Confirm suite + typecheck.** Run `npm test` (all pass) and `npx tsc --noEmit` (clean).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ingest): retry/backoff HTTP helper with browser headers"
```

---

## Task 2: Source parsers + golden fixtures

**Files:** Create `src/ingest/types.ts`, `src/ingest/parsers.ts`, `src/ingest/__fixtures__/` (sample files); Test `src/ingest/parsers.test.ts`.

- [ ] **Step 1: Capture fixtures (real data where reachable).**

GitHub (public, works): save a real sample —
```bash
mkdir -p src/ingest/__fixtures__
curl -sSL "https://raw.githubusercontent.com/DuckBurnIncense/xin-wen-lian-bo/master/news/20260613.md" -o src/ingest/__fixtures__/github-20260613.md
head -c 300 src/ingest/__fixtures__/github-20260613.md   # sanity-check it's a transcript, not a 404 page
```
govopendata (403-protected — verify the crawler defeats it): try a real browser-headed curl and save if it works —
```bash
curl -sSL -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" \
  -H "Accept-Language: zh-CN,zh;q=0.9" \
  "https://cn.govopendata.com/xinwenlianbo/20260613/" -o src/ingest/__fixtures__/govopendata-20260613.html
head -c 400 src/ingest/__fixtures__/govopendata-20260613.html
```
- If the govopendata curl returns real transcript HTML: keep it as the fixture (and note in your report that browser headers DO defeat the 403).
- If it still returns a 403/empty/challenge page: report that fact, delete the bad file, and instead create a **small representative** `src/ingest/__fixtures__/govopendata-20260613.html` based on this documented structure (item titles in heading tags, body in `<p>`), e.g.:
```html
<html><body>
<div class="content">
<h2>2026年6月13日新闻联播</h2>
<h3>【新思想引领新征程】守护文化瑰宝 赓续中华文脉</h3>
<p>央视网消息（新闻联播）：正文段落一。</p>
<p>正文段落二。</p>
<h3>第十八届海峡论坛大会在厦门举行</h3>
<p>央视网消息（新闻联播）：正文。</p>
</div>
</body></html>
```
Tushare (token-gated): create a representative fixture `src/ingest/__fixtures__/tushare-20260613.json` matching the documented `cctv_news` shape (fields `date`, `title`, `content` — `content` is the full transcript text, often `\n`-separated):
```json
{ "date": "20260613", "title": "新闻联播 20260613", "content": "守护文化瑰宝 赓续中华文脉。\n第十八届海峡论坛大会在厦门举行。\n我国海洋生态保护修复取得新成效。" }
```

**Commit the fixtures** with the code in Step 7.

- [ ] **Step 2: Write `src/ingest/types.ts`:**

```typescript
export type TranscriptSource = 'govopendata' | 'tushare' | 'github';

export interface ParsedTranscript {
  date: string;            // 'YYYY-MM-DD'
  source: TranscriptSource;
  text: string;            // cleaned full transcript body
  items: string[];         // headline list (best-effort; may be empty)
}
```

- [ ] **Step 3: Write the failing parser tests** — `src/ingest/parsers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseGithubMd, parseTushare, parseGovopendata } from './parsers';

const fx = (name: string) => readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

describe('parseGithubMd', () => {
  const t = parseGithubMd(fx('github-20260613.md'), '2026-06-13');
  it('sets date and source', () => {
    expect(t.date).toBe('2026-06-13');
    expect(t.source).toBe('github');
  });
  it('extracts non-trivial body text', () => {
    expect(t.text.length).toBeGreaterThan(50);
    expect(t.text).toContain('新闻联播');
  });
  it('extracts a non-empty list of headline items', () => {
    expect(t.items.length).toBeGreaterThan(0);
  });
});

describe('parseTushare', () => {
  const t = parseTushare(JSON.parse(fx('tushare-20260613.json')), '2026-06-13');
  it('uses content as text and tags source', () => {
    expect(t.source).toBe('tushare');
    expect(t.text).toContain('海峡论坛');
    expect(t.date).toBe('2026-06-13');
  });
});

describe('parseGovopendata', () => {
  const t = parseGovopendata(fx('govopendata-20260613.html'), '2026-06-13');
  it('strips HTML to text and tags source', () => {
    expect(t.source).toBe('govopendata');
    expect(t.text).not.toContain('<p>');
    expect(t.text.length).toBeGreaterThan(20);
  });
});
```

- [ ] **Step 4: Run — expect FAIL** (`cannot resolve ./parsers`). Run: `npm test src/ingest/parsers.test.ts`

- [ ] **Step 5: Implement `src/ingest/parsers.ts`.** Use a tiny dependency-free HTML-to-text (regex strip) — do NOT add a heavy HTML library for P1; transcript pages are simple.

```typescript
import type { ParsedTranscript } from './types';

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(p|div|h[1-6]|li|br)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// GitHub MD: '# 《新闻联播》(date)', '## 新闻摘要' numbered list, then '### headline' + <p> body.
export function parseGithubMd(md: string, date: string): ParsedTranscript {
  const items: string[] = [];
  for (const line of md.split('\n')) {
    const h = line.match(/^###\s+(.+?)\s*$/);
    if (h) items.push(h[1].trim());
  }
  // Body = the markdown with heading markers and embedded HTML tags removed.
  const text = stripHtml(md.replace(/^#{1,6}\s+/gm, ''))
    .replace(/\[查看原文\]\([^)]*\)/g, '')
    .trim();
  return { date, source: 'github', text, items };
}

// Tushare cctv_news row: { date, title, content }
export function parseTushare(row: { date?: string; title?: string; content?: string }, date: string): ParsedTranscript {
  const content = (row.content ?? '').trim();
  const items = content.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  return { date, source: 'tushare', text: content, items };
}

// govopendata HTML page.
export function parseGovopendata(html: string, date: string): ParsedTranscript {
  const items: string[] = [];
  const headingRe = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(html))) {
    const t = stripHtml(m[1]).trim();
    if (t && !/新闻联播\s*$/.test(t)) items.push(t);
  }
  const text = stripHtml(html);
  return { date, source: 'govopendata', text, items };
}
```
If a golden assertion can't pass against your captured real fixture (the real HTML structure differs from the representative one), adjust the parser to handle the REAL structure (that's the point of the golden test) and keep the assertions meaningful. Do not weaken a test just to make it green.

- [ ] **Step 6: Run — expect PASS.** Run: `npm test src/ingest/parsers.test.ts`. Then `npm test` (full suite) + `npx tsc --noEmit`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(ingest): source parsers (github/tushare/govopendata) with golden fixtures"
```

---

## Task 3: Source fallback chain + storage

**Files:** Create `src/ingest/sources.ts`, `src/ingest/store.ts`; Test `src/ingest/sources.test.ts`, `src/ingest/store.test.ts`. Install `@vercel/blob`.

- [ ] **Step 1: Install Blob client.** Run: `npm install @vercel/blob`.

- [ ] **Step 2: Write the failing sources test** — `src/ingest/sources.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { fetchTranscript } from './sources';
import type { ParsedTranscript } from './types';

const ok = (source: ParsedTranscript['source']): ParsedTranscript =>
  ({ date: '2026-06-13', source, text: 'body', items: ['a'] });

describe('fetchTranscript fallback chain', () => {
  it('returns govopendata when it succeeds (no fallback)', async () => {
    const deps = {
      govopendata: vi.fn(async () => ok('govopendata')),
      tushare: vi.fn(async () => ok('tushare')),
      github: vi.fn(async () => ok('github')),
    };
    const t = await fetchTranscript('2026-06-13', deps);
    expect(t.source).toBe('govopendata');
    expect(deps.tushare).not.toHaveBeenCalled();
    expect(deps.github).not.toHaveBeenCalled();
  });

  it('falls back to tushare, then github, on failure', async () => {
    const deps = {
      govopendata: vi.fn(async () => { throw new Error('403'); }),
      tushare: vi.fn(async () => { throw new Error('no token'); }),
      github: vi.fn(async () => ok('github')),
    };
    const t = await fetchTranscript('2026-06-13', deps);
    expect(t.source).toBe('github');
    expect(deps.govopendata).toHaveBeenCalledOnce();
    expect(deps.tushare).toHaveBeenCalledOnce();
  });

  it('throws if all sources fail', async () => {
    const fail = vi.fn(async () => { throw new Error('x'); });
    await expect(fetchTranscript('2026-06-13', { govopendata: fail, tushare: fail, github: fail }))
      .rejects.toThrow(/all sources failed/i);
  });
});
```

- [ ] **Step 3: Run — expect FAIL.** Run: `npm test src/ingest/sources.test.ts`

- [ ] **Step 4: Implement `src/ingest/sources.ts`.** Real per-source fetchers build the URL, call `fetchWithRetry`, and parse; `fetchTranscript` walks the chain. The per-source fns are injectable for tests.

```typescript
import { fetchWithRetry } from './http';
import { parseGithubMd, parseGovopendata, parseTushare } from './parsers';
import type { ParsedTranscript } from './types';

const ymd = (date: string) => date.replace(/-/g, ''); // 'YYYY-MM-DD' -> 'YYYYMMDD'

export async function fromGovopendata(date: string): Promise<ParsedTranscript> {
  const html = await fetchWithRetry(`https://cn.govopendata.com/xinwenlianbo/${ymd(date)}/`);
  return parseGovopendata(html, date);
}

export async function fromGithub(date: string): Promise<ParsedTranscript> {
  const md = await fetchWithRetry(
    `https://raw.githubusercontent.com/DuckBurnIncense/xin-wen-lian-bo/master/news/${ymd(date)}.md`,
  );
  return parseGithubMd(md, date);
}

export async function fromTushare(date: string): Promise<ParsedTranscript> {
  const token = process.env.TUSHARE_TOKEN;
  if (!token) throw new Error('TUSHARE_TOKEN not set');
  const body = JSON.stringify({
    api_name: 'cctv_news',
    token,
    params: { date: ymd(date) },
    fields: 'date,title,content',
  });
  const raw = await fetchWithRetry('https://api.tushare.pro', {
    headers: { 'Content-Type': 'application/json' },
  } as never);
  // NOTE: Tushare uses POST; if fetchWithRetry only does GET, see the override below.
  const json = JSON.parse(raw) as { data?: { items?: unknown[][]; fields?: string[] } };
  const rows = json.data?.items ?? [];
  const fields = json.data?.fields ?? [];
  const ci = fields.indexOf('content');
  const content = ci >= 0 && rows[0] ? String(rows[0][ci] ?? '') : '';
  return parseTushare({ date: ymd(date), content }, date);
}

export interface SourceDeps {
  govopendata: (date: string) => Promise<ParsedTranscript>;
  tushare: (date: string) => Promise<ParsedTranscript>;
  github: (date: string) => Promise<ParsedTranscript>;
}

const DEFAULT_DEPS: SourceDeps = {
  govopendata: fromGovopendata,
  tushare: fromTushare,
  github: fromGithub,
};

/** Try sources in priority order; return the first success, else throw. */
export async function fetchTranscript(date: string, deps: SourceDeps = DEFAULT_DEPS): Promise<ParsedTranscript> {
  const order: (keyof SourceDeps)[] = ['govopendata', 'tushare', 'github'];
  const errors: string[] = [];
  for (const key of order) {
    try {
      return await deps[key](date);
    } catch (e) {
      errors.push(`${key}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(`all sources failed for ${date} — ${errors.join('; ')}`);
}
```
NOTE on Tushare POST: `fetchWithRetry` as written does GET. Tushare needs POST with a JSON body. Extend `fetchWithRetry`'s `FetchOptions` with an optional `method?: string` and `body?: string` and pass them through to `fetchImpl(url, { method, headers, body })` (default method GET) — make this small change in `src/ingest/http.ts`, keep all existing http tests green (they don't set method, so GET remains default), and use `method:'POST', body` in `fromTushare`. Implement that cleanly rather than the `as never` placeholder shown above.

- [ ] **Step 5: Run — expect PASS** (3 tests). Run: `npm test src/ingest/sources.test.ts`

- [ ] **Step 6: Write the failing store test** — `src/ingest/store.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { buildBroadcastDayRow, storeTranscript } from './store';
import type { ParsedTranscript } from './types';

const t: ParsedTranscript = { date: '2026-06-13', source: 'github', text: 'full body', items: ['a', 'b'] };

describe('buildBroadcastDayRow', () => {
  it('maps a transcript + blob url to a broadcast_day row', () => {
    const row = buildBroadcastDayRow(t, 'https://blob/xwlb/2026-06-13.txt');
    expect(row).toMatchObject({
      date: '2026-06-13',
      source: 'github',
      blobUrl: 'https://blob/xwlb/2026-06-13.txt',
      status: 'ingested',
    });
    expect(row.segmentStats).toMatchObject({ itemCount: 2 });
  });
});

describe('storeTranscript', () => {
  it('puts text to blob then upserts the row, returning the row', async () => {
    const putBlob = vi.fn(async () => ({ url: 'https://blob/x.txt' }));
    const upsertDay = vi.fn(async () => {});
    const row = await storeTranscript(t, { putBlob, upsertDay });
    expect(putBlob).toHaveBeenCalledOnce();
    expect(upsertDay).toHaveBeenCalledWith(expect.objectContaining({ blobUrl: 'https://blob/x.txt', date: '2026-06-13' }));
    expect(row.blobUrl).toBe('https://blob/x.txt');
  });
});
```

- [ ] **Step 7: Run — expect FAIL.** Run: `npm test src/ingest/store.test.ts`

- [ ] **Step 8: Implement `src/ingest/store.ts`.** Pure row builder + IO via injected deps (default deps wrap `@vercel/blob` `put` and a Drizzle upsert). The default deps are NOT unit-tested (they need live Blob/DB) — they are thin wrappers.

```typescript
import { put } from '@vercel/blob';
import { getDb } from '@/db/client';
import { broadcastDay } from '@/db/schema';
import type { ParsedTranscript } from './types';

export interface BroadcastDayRow {
  date: string;
  blobUrl: string;
  source: string;
  segmentStats: { itemCount: number };
  status: string;
}

export function buildBroadcastDayRow(t: ParsedTranscript, blobUrl: string): BroadcastDayRow {
  return {
    date: t.date,
    blobUrl,
    source: t.source,
    segmentStats: { itemCount: t.items.length },
    status: 'ingested',
  };
}

export interface StoreDeps {
  putBlob: (key: string, body: string) => Promise<{ url: string }>;
  upsertDay: (row: BroadcastDayRow) => Promise<void>;
}

const DEFAULT_DEPS: StoreDeps = {
  putBlob: async (key, body) => {
    const r = await put(key, body, { access: 'public', contentType: 'text/plain; charset=utf-8' });
    return { url: r.url };
  },
  upsertDay: async (row) => {
    await getDb()
      .insert(broadcastDay)
      .values(row)
      .onConflictDoUpdate({
        target: broadcastDay.date,
        set: { blobUrl: row.blobUrl, source: row.source, segmentStats: row.segmentStats, status: row.status },
      });
  },
};

export async function storeTranscript(t: ParsedTranscript, deps: StoreDeps = DEFAULT_DEPS): Promise<BroadcastDayRow> {
  const { url } = await deps.putBlob(`xwlb/${t.date}.txt`, t.text);
  const row = buildBroadcastDayRow(t, url);
  await deps.upsertDay(row);
  return row;
}
```

- [ ] **Step 9: Run — expect PASS** (2 tests). Then `npm test` (full suite) + `npx tsc --noEmit` + `npm run build`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(ingest): source fallback chain + Blob/DB storage layer"
```

---

## Task 4: Ingest orchestration + backfill script

**Files:** Create `src/ingest/ingest.ts`, `scripts/backfill.ts`, `scripts/ingest-day.ts`; Test `src/ingest/ingest.test.ts`.

- [ ] **Step 1: Write the failing test** — `src/ingest/ingest.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { dateRange, shouldSkip, ingestDay } from './ingest';
import type { ParsedTranscript } from './types';

describe('dateRange', () => {
  it('produces inclusive YYYY-MM-DD days across month boundaries', () => {
    expect(dateRange('2026-01-30', '2026-02-02')).toEqual([
      '2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02',
    ]);
  });
  it('returns a single day when start === end', () => {
    expect(dateRange('2026-06-13', '2026-06-13')).toEqual(['2026-06-13']);
  });
});

describe('shouldSkip', () => {
  it('skips an already-ingested day', () => {
    expect(shouldSkip({ status: 'ingested' })).toBe(true);
  });
  it('does not skip when no row or failed status', () => {
    expect(shouldSkip(undefined)).toBe(false);
    expect(shouldSkip({ status: 'failed' })).toBe(false);
  });
});

describe('ingestDay', () => {
  const t: ParsedTranscript = { date: '2026-06-13', source: 'github', text: 'b', items: [] };
  it('skips when already ingested (no fetch/store)', async () => {
    const deps = {
      getExisting: vi.fn(async () => ({ status: 'ingested' })),
      fetch: vi.fn(async () => t),
      store: vi.fn(async () => ({})),
    };
    const r = await ingestDay('2026-06-13', deps);
    expect(r.skipped).toBe(true);
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(deps.store).not.toHaveBeenCalled();
  });
  it('fetches and stores when missing', async () => {
    const deps = {
      getExisting: vi.fn(async () => undefined),
      fetch: vi.fn(async () => t),
      store: vi.fn(async () => ({})),
    };
    const r = await ingestDay('2026-06-13', deps);
    expect(r.skipped).toBe(false);
    expect(deps.fetch).toHaveBeenCalledWith('2026-06-13');
    expect(deps.store).toHaveBeenCalledWith(t);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** Run: `npm test src/ingest/ingest.test.ts`

- [ ] **Step 3: Implement `src/ingest/ingest.ts`:**

```typescript
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { broadcastDay } from '@/db/schema';
import { fetchTranscript } from './sources';
import { storeTranscript } from './store';
import type { ParsedTranscript } from './types';

/** Inclusive list of 'YYYY-MM-DD' days. Uses UTC to avoid DST drift. */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (d.getTime() <= last.getTime()) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function shouldSkip(existing: { status?: string } | undefined): boolean {
  return existing?.status === 'ingested';
}

export interface IngestDeps {
  getExisting: (date: string) => Promise<{ status?: string } | undefined>;
  fetch: (date: string) => Promise<ParsedTranscript>;
  store: (t: ParsedTranscript) => Promise<unknown>;
}

const DEFAULT_DEPS: IngestDeps = {
  getExisting: async (date) => {
    const rows = await getDb().select().from(broadcastDay).where(eq(broadcastDay.date, date)).limit(1);
    return rows[0];
  },
  fetch: (date) => fetchTranscript(date),
  store: (t) => storeTranscript(t),
};

export async function ingestDay(
  date: string,
  deps: IngestDeps = DEFAULT_DEPS,
): Promise<{ date: string; skipped: boolean }> {
  const existing = await deps.getExisting(date);
  if (shouldSkip(existing)) return { date, skipped: true };
  const t = await deps.fetch(date);
  await deps.store(t);
  return { date, skipped: false };
}
```

- [ ] **Step 4: Run — expect PASS** (7 tests). Run: `npm test src/ingest/ingest.test.ts`

- [ ] **Step 5: Write the backfill + daily scripts** (not unit-tested — they need live creds; verify they TYPECHECK only).

`scripts/backfill.ts`:
```typescript
import { dateRange, ingestDay } from '@/ingest/ingest';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function main() {
  const start = process.argv[2];
  const end = process.argv[3] ?? new Date().toISOString().slice(0, 10);
  if (!start) {
    console.error('usage: tsx scripts/backfill.ts <start YYYY-MM-DD> [end YYYY-MM-DD]');
    process.exit(1);
  }
  const days = dateRange(start, end);
  const delayMs = Number(process.env.BACKFILL_DELAY_MS ?? 1500); // polite rate-limit
  let ok = 0, skip = 0, fail = 0;
  for (const day of days) {
    try {
      const r = await ingestDay(day);
      if (r.skipped) { skip++; } else { ok++; console.log(`✓ ${day}`); }
    } catch (e) {
      fail++;
      console.error(`✗ ${day}: ${e instanceof Error ? e.message : e}`);
    }
    await sleep(delayMs);
  }
  console.log(`done. ingested=${ok} skipped=${skip} failed=${fail} of ${days.length}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```
`scripts/ingest-day.ts`:
```typescript
import { ingestDay } from '@/ingest/ingest';

async function main() {
  const day = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  const r = await ingestDay(day);
  console.log(r.skipped ? `skipped ${day} (already ingested)` : `ingested ${day}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```
Add to `package.json` scripts: `"backfill": "tsx scripts/backfill.ts"`, `"ingest:day": "tsx scripts/ingest-day.ts"`. (tsx already installed in P0.) Note: `tsx` resolves the `@/` alias via tsconfig paths; if a script can't resolve `@/`, run it with `tsx --tsconfig tsconfig.json` or import via relative paths — adjust so the script typechecks and `tsx` would resolve it.

- [ ] **Step 6: Verify.** Run `npm test` (all pass), `npx tsc --noEmit` (clean), `npm run build` (green). Do NOT run the backfill/daily scripts (they need DATABASE_URL + BLOB_READ_WRITE_TOKEN we don't have).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(ingest): idempotent ingestDay + backfill/daily scripts"
```

---

## Self-Review

**Spec coverage (P1):** §3 step ① ingest (fetch + fallback chain + Blob + broadcast_day) — Tasks 1–4 ✓. §5 sources (govopendata primary w/ headers+backoff; Tushare 2017+; GitHub 2023+ fallback) — Tasks 1–3 ✓. §6/§9 backfill runs locally, idempotent — Task 4 ✓. §10 fallback chain + missing-day handling + length/validity (itemCount in segmentStats; empty-text would yield short text — note below) ✓ (partial: explicit transcript-length validation can be hardened in P2 extraction). Out of scope: structured extraction (P2), UI (P3), cron route (P6).

**Placeholder scan:** No TBD/TODO. The "representative fixture" fallback for govopendata/Tushare carries concrete sample content + a verify-against-real note — not a blank. The Tushare-POST note has concrete instructions.

**Type consistency:** `ParsedTranscript` ({date, source, text, items}) and `TranscriptSource` used identically in parsers, sources, store, ingest. `BroadcastDayRow` shape matches the P0 `broadcast_day` columns (date, blobUrl→blob_url, source, segmentStats→segment_stats, status). Stage/source strings consistent. Injected-deps interfaces (`SourceDeps`, `StoreDeps`, `IngestDeps`) are defined once and consumed consistently.

---

## Live run (user step, after merge — needs credentials)

1. Set env: `DATABASE_URL` (Neon), `BLOB_READ_WRITE_TOKEN` (Vercel Blob), optional `TUSHARE_TOKEN`.
2. `npm run db:migrate` (if not already), then backfill: `npm run backfill 2009-01-01` (runs to today; idempotent — safe to re-run; resumes by skipping ingested days).
3. Daily: `npm run ingest:day` (P6 will wire this to Vercel Cron).
