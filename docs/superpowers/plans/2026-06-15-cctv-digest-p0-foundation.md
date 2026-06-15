# CCTV_Digest — P0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the project skeleton — Next.js app, Neon Postgres schema, and the multi-provider LLM abstraction (default DeepSeek V4) — so every later phase has a tested foundation to build on.

**Architecture:** Next.js (App Router, TypeScript, `src/` dir) deployed on Vercel. Drizzle ORM over Neon Postgres for the data model. A small, pure, unit-tested LLM layer that resolves a per-stage `{provider, model, baseURL, apiKeyEnv}` config (defaults → admin overrides) and builds an AI SDK model through one OpenAI-compatible code path (DeepSeek / SiliconFlow / Vercel AI Gateway / any OpenAI-compatible endpoint). API keys live in env vars only.

**Tech Stack:** Next.js 15+, TypeScript, Drizzle ORM + drizzle-kit, `@neondatabase/serverless`, AI SDK (`ai`) v6 + `@ai-sdk/openai-compatible`, Vitest. Free-tier infra (Vercel Hobby + Neon free + Blob free).

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `next.config.ts` | Project config (from create-next-app) |
| `vitest.config.ts` | Test runner config |
| `.env.example` | Documents required env vars (no secrets) |
| `src/lib/sanity.ts` / `.test.ts` | Toolchain smoke test |
| `src/db/schema.ts` | Drizzle schema for all data-model entities |
| `src/db/client.ts` | Neon + Drizzle client singleton |
| `src/db/schema.test.ts` | Asserts schema shape (no live DB) |
| `drizzle.config.ts` | drizzle-kit migration config |
| `src/llm/types.ts` | `Stage`, `ProviderId`, `StageModelConfig` |
| `src/llm/defaults.ts` | Provider presets + default per-stage config |
| `src/llm/resolve.ts` | Pure config resolver + api-key reader |
| `src/llm/resolve.test.ts` | Unit tests for the resolver |
| `src/llm/model.ts` | Builds AI SDK `LanguageModel` from a config |
| `src/llm/loadStageConfig.ts` / `.test.ts` | Merge DB `stage_config` rows over defaults |
| `src/db/seed.ts` | Seed default stage configs into `stage_config` |
| `src/app/api/health/route.ts` | Health check endpoint |

---

## Task 1: Scaffold Next.js + Vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/*` (via scaffold)
- Create: `vitest.config.ts`
- Create: `src/lib/sanity.ts`
- Test: `src/lib/sanity.test.ts`

- [ ] **Step 1: Scaffold the Next.js app into the current directory**

Run:
```bash
npx create-next-app@latest . --ts --app --src-dir --tailwind --eslint --use-npm --import-alias "@/*" --yes
```
Expected: creates `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/`. It coexists with the existing `.git`, `.gitignore`, `README.md`, and `docs/`.
Fallback if it refuses due to a non-empty directory: scaffold into a temp dir and copy in —
```bash
npx create-next-app@latest /tmp/cctv-init --ts --app --src-dir --tailwind --eslint --use-npm --import-alias "@/*" --yes
cp -r /tmp/cctv-init/. .
rm -rf /tmp/cctv-init && rm -f README.md.bak
```
(Then restore our `README.md` if create-next-app overwrote it: `git checkout -- README.md`.)

- [ ] **Step 2: Install and configure Vitest**

Run:
```bash
npm install -D vitest
```
Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```
Add to `package.json` `"scripts"`: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 3: Write the failing toolchain test**

Create `src/lib/sanity.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { projectName } from './sanity';

describe('toolchain', () => {
  it('imports source modules and runs assertions', () => {
    expect(projectName()).toBe('CCTV_Digest');
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./sanity` / `projectName` is not defined.

- [ ] **Step 5: Implement the minimal module**

Create `src/lib/sanity.ts`:
```typescript
export function projectName(): string {
  return 'CCTV_Digest';
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest toolchain"
```

---

## Task 2: Database schema (Drizzle over Neon)

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/client.ts`
- Create: `drizzle.config.ts`
- Create: `.env.example`
- Test: `src/db/schema.test.ts`

- [ ] **Step 1: Install Drizzle + Neon driver**

Run:
```bash
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit
```

- [ ] **Step 2: Write the failing schema test**

Create `src/db/schema.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import * as schema from './schema';

describe('db schema', () => {
  it('defines all core tables', () => {
    for (const name of [
      'broadcastDay', 'item', 'tifa', 'tifaMention', 'sectorSignal',
      'dailyInterpretation', 'radarEvent', 'thread', 'threadPoint',
      'threadEvidence', 'stageConfig', 'pipelineRun',
    ]) {
      expect(schema, `missing table export: ${name}`).toHaveProperty(name);
    }
  });

  it('stageConfig is keyed by stage and carries provider/model/apiKeyEnv', () => {
    const cols = Object.keys(schema.stageConfig);
    expect(cols).toEqual(
      expect.arrayContaining(['stage', 'provider', 'model', 'baseUrl', 'apiKeyEnv']),
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test src/db/schema.test.ts`
Expected: FAIL — cannot resolve `./schema`.

- [ ] **Step 4: Implement the schema**

Create `src/db/schema.ts`:
```typescript
import {
  pgTable, serial, text, integer, real, date, jsonb, timestamp,
} from 'drizzle-orm/pg-core';

// One broadcast (a day's 新闻联播)
export const broadcastDay = pgTable('broadcast_day', {
  date: date('date').primaryKey(),
  blobUrl: text('blob_url'),                 // raw transcript in Vercel Blob
  source: text('source'),                    // govopendata | tushare | github | ...
  segmentStats: jsonb('segment_stats'),      // {leader:{count,proxy}, dev:{...}, intl:{...}}
  status: text('status').notNull().default('ingested'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// One news item within a broadcast
export const item = pgTable('item', {
  id: serial('id').primaryKey(),
  day: date('day').notNull(),
  ord: integer('ord').notNull(),             // rundown position
  segment: text('segment').notNull(),        // leader | dev | intl
  lengthProxy: integer('length_proxy'),      // char count / airtime proxy
  text: text('text'),
  summary: text('summary'),
});

// Normalized 提法 / keyword
export const tifa = pgTable('tifa', {
  id: serial('id').primaryKey(),
  term: text('term').notNull().unique(),
  firstSeen: date('first_seen'),
  aliases: jsonb('aliases'),                 // string[]
});

export const tifaMention = pgTable('tifa_mention', {
  id: serial('id').primaryKey(),
  day: date('day').notNull(),
  tifaId: integer('tifa_id').notNull(),
  count: integer('count').notNull().default(1),
  context: text('context'),
});

export const sectorSignal = pgTable('sector_signal', {
  id: serial('id').primaryKey(),
  day: date('day').notNull(),
  sector: text('sector').notNull(),
  polarity: text('polarity').notNull(),      // bull | bear | neutral
  strength: real('strength'),
});

export const dailyInterpretation = pgTable('daily_interpretation', {
  id: serial('id').primaryKey(),
  day: date('day').notNull(),
  topSignals: jsonb('top_signals'),          // [{title, layers:{theme,sector,tickers}, confidence, threadId, fromRadar}]
  model: text('model'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const radarEvent = pgTable('radar_event', {
  id: serial('id').primaryKey(),
  day: date('day').notNull(),
  type: text('type').notNull(),              // new_tifa | flip | drumbeat_up | drumbeat_down | order_jump
  target: text('target').notNull(),
  magnitude: real('magnitude'),
  detail: jsonb('detail'),
});

export const thread = pgTable('thread', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color'),
  status: text('status').notNull().default('active'), // active | merged | split | faded
  meta: jsonb('meta'),                       // lifecycle relations
});

export const threadPoint = pgTable('thread_point', {
  id: serial('id').primaryKey(),
  threadId: integer('thread_id').notNull(),
  period: text('period').notNull(),          // e.g. '2024-03' or ISO week
  intensity: real('intensity').notNull(),
});

export const threadEvidence = pgTable('thread_evidence', {
  id: serial('id').primaryKey(),
  threadId: integer('thread_id').notNull(),
  day: date('day').notNull(),
  itemId: integer('item_id'),
});

// Admin-editable per-stage model selection (NO api keys here)
export const stageConfig = pgTable('stage_config', {
  stage: text('stage').primaryKey(),         // extraction | radar | deep | thread
  provider: text('provider').notNull(),      // deepseek | siliconflow | gateway | openai-compatible
  model: text('model').notNull(),
  baseUrl: text('base_url'),
  apiKeyEnv: text('api_key_env').notNull(),
  params: jsonb('params'),                   // {effort, temperature, ...}
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Per-run audit for token/cost tracking
export const pipelineRun = pgTable('pipeline_run', {
  id: serial('id').primaryKey(),
  day: date('day'),
  stage: text('stage').notNull(),
  provider: text('provider'),
  model: text('model'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  costUsd: real('cost_usd'),
  status: text('status').notNull(),          // ok | error
  error: text('error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test src/db/schema.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Add the DB client, drizzle config, and env example**

Create `src/db/client.ts`:
```typescript
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

export const db = drizzle(neon(url), { schema });
```
Create `drizzle.config.ts`:
```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```
Create `.env.example`:
```bash
# Neon Postgres (free tier)
DATABASE_URL=

# LLM provider API keys (set only the ones you use)
DEEPSEEK_API_KEY=
SILICONFLOW_API_KEY=
AI_GATEWAY_API_KEY=
OPENAI_COMPATIBLE_API_KEY=

# Vercel Blob
BLOB_READ_WRITE_TOKEN=

# Admin auth (single admin secret; see spec §15)
ADMIN_SECRET=
```
Add `"db:generate": "drizzle-kit generate"` and `"db:migrate": "drizzle-kit migrate"` to `package.json` scripts. Add `drizzle/` is fine to commit (migrations). Do NOT commit `.env`.

- [ ] **Step 7: Generate the initial migration**

Run:
```bash
npx drizzle-kit generate
```
Expected: creates SQL under `drizzle/`. (No DB connection needed for `generate`.)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(db): add Drizzle schema, client, and initial migration"
```

---

## Task 3: LLM provider abstraction (pure, tested)

**Files:**
- Create: `src/llm/types.ts`
- Create: `src/llm/defaults.ts`
- Create: `src/llm/resolve.ts`
- Create: `src/llm/model.ts`
- Test: `src/llm/resolve.test.ts`

- [ ] **Step 1: Install the AI SDK**

Run:
```bash
npm install ai @ai-sdk/openai-compatible
```

- [ ] **Step 2: Define types and defaults**

Create `src/llm/types.ts`:
```typescript
export type Stage = 'extraction' | 'radar' | 'deep' | 'thread';
export type ProviderId = 'deepseek' | 'siliconflow' | 'gateway' | 'openai-compatible';

export interface StageModelConfig {
  provider: ProviderId;
  model: string;
  baseURL?: string;   // OpenAI-compatible endpoint
  apiKeyEnv: string;  // name of the env var holding the key
}
```
Create `src/llm/defaults.ts`:
```typescript
import type { ProviderId, Stage, StageModelConfig } from './types';

// baseURL undefined for 'openai-compatible' — caller must supply it via override.
// NOTE: confirm DeepSeek V4 model id strings and the AI Gateway baseURL against
// current provider docs at integration time; both are configurable.
export const PROVIDER_PRESETS: Record<ProviderId, { baseURL?: string; apiKeyEnv: string }> = {
  deepseek: { baseURL: 'https://api.deepseek.com/v1', apiKeyEnv: 'DEEPSEEK_API_KEY' },
  siliconflow: { baseURL: 'https://api.siliconflow.cn/v1', apiKeyEnv: 'SILICONFLOW_API_KEY' },
  gateway: { baseURL: 'https://ai-gateway.vercel.sh/v1', apiKeyEnv: 'AI_GATEWAY_API_KEY' },
  'openai-compatible': { apiKeyEnv: 'OPENAI_COMPATIBLE_API_KEY' },
};

function deepseek(model: string): StageModelConfig {
  return { provider: 'deepseek', model, ...PROVIDER_PRESETS.deepseek } as StageModelConfig;
}

// Default: DeepSeek V4 — Flash for high-volume, Pro for the IP-critical stages.
export const DEFAULT_STAGE_CONFIG: Record<Stage, StageModelConfig> = {
  extraction: deepseek('deepseek-v4-flash'),
  radar: deepseek('deepseek-v4-flash'),
  deep: deepseek('deepseek-v4-pro'),
  thread: deepseek('deepseek-v4-pro'),
};
```

- [ ] **Step 3: Write the failing resolver test**

Create `src/llm/resolve.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { resolveStageConfig, getApiKey } from './resolve';

describe('resolveStageConfig', () => {
  it('defaults extraction to DeepSeek V4 Flash', () => {
    const c = resolveStageConfig('extraction');
    expect(c.provider).toBe('deepseek');
    expect(c.model).toBe('deepseek-v4-flash');
    expect(c.baseURL).toBe('https://api.deepseek.com/v1');
    expect(c.apiKeyEnv).toBe('DEEPSEEK_API_KEY');
  });

  it('defaults deep to DeepSeek V4 Pro', () => {
    expect(resolveStageConfig('deep').model).toBe('deepseek-v4-pro');
  });

  it('applies admin overrides over defaults', () => {
    const c = resolveStageConfig('deep', {
      provider: 'siliconflow', model: 'Qwen3', baseURL: 'https://api.siliconflow.cn/v1', apiKeyEnv: 'SILICONFLOW_API_KEY',
    });
    expect(c.provider).toBe('siliconflow');
    expect(c.model).toBe('Qwen3');
  });

  it('ignores undefined override fields', () => {
    const c = resolveStageConfig('deep', { model: undefined });
    expect(c.model).toBe('deepseek-v4-pro');
  });

  it('throws on an unknown stage', () => {
    // @ts-expect-error runtime guard
    expect(() => resolveStageConfig('nope')).toThrow(/Unknown stage/);
  });
});

describe('getApiKey', () => {
  it('reads the configured env var', () => {
    const c = resolveStageConfig('extraction');
    expect(getApiKey(c, { DEEPSEEK_API_KEY: 'sk-x' })).toBe('sk-x');
  });

  it('throws a clear error when the key is missing', () => {
    const c = resolveStageConfig('extraction');
    expect(() => getApiKey(c, {})).toThrow(/DEEPSEEK_API_KEY/);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test src/llm/resolve.test.ts`
Expected: FAIL — cannot resolve `./resolve`.

- [ ] **Step 5: Implement the resolver**

Create `src/llm/resolve.ts`:
```typescript
import { DEFAULT_STAGE_CONFIG } from './defaults';
import type { Stage, StageModelConfig } from './types';

function stripUndefined<T extends object>(o?: Partial<T>): Partial<T> {
  if (!o) return {};
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

export function resolveStageConfig(
  stage: Stage,
  override?: Partial<StageModelConfig>,
): StageModelConfig {
  const base = DEFAULT_STAGE_CONFIG[stage];
  if (!base) throw new Error(`Unknown stage: ${stage}`);
  return { ...base, ...stripUndefined(override) };
}

export function getApiKey(
  cfg: StageModelConfig,
  env: Record<string, string | undefined> = process.env,
): string {
  const key = env[cfg.apiKeyEnv];
  if (!key) throw new Error(`Missing API key env var: ${cfg.apiKeyEnv}`);
  return key;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test src/llm/resolve.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 7: Implement the model builder**

Create `src/llm/model.ts`:
```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { getApiKey } from './resolve';
import type { StageModelConfig } from './types';

// All providers (DeepSeek, SiliconFlow, Vercel AI Gateway, generic) expose an
// OpenAI-compatible endpoint, so they share one code path.
export function getModel(cfg: StageModelConfig): LanguageModel {
  if (!cfg.baseURL) {
    throw new Error(`baseURL required for provider '${cfg.provider}'`);
  }
  const provider = createOpenAICompatible({
    name: cfg.provider,
    baseURL: cfg.baseURL,
    apiKey: getApiKey(cfg),
  });
  return provider(cfg.model);
}
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(llm): multi-provider stage config resolver + model builder"
```

---

## Task 4: Stage-config loader (DB overrides) + seed + health route

**Files:**
- Create: `src/llm/loadStageConfig.ts`
- Test: `src/llm/loadStageConfig.test.ts`
- Create: `src/db/seed.ts`
- Create: `src/app/api/health/route.ts`

- [ ] **Step 1: Write the failing loader test**

The loader merges a DB `stage_config` row (admin selection) over the code defaults. We test the **pure merge** by injecting rows, not by hitting the DB.

Create `src/llm/loadStageConfig.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { mergeStageConfig } from './loadStageConfig';

describe('mergeStageConfig', () => {
  it('returns the default when no row exists', () => {
    const c = mergeStageConfig('deep', undefined);
    expect(c.provider).toBe('deepseek');
    expect(c.model).toBe('deepseek-v4-pro');
  });

  it('overlays a DB row over the default', () => {
    const c = mergeStageConfig('extraction', {
      stage: 'extraction',
      provider: 'siliconflow',
      model: 'Qwen3-Flash',
      baseUrl: 'https://api.siliconflow.cn/v1',
      apiKeyEnv: 'SILICONFLOW_API_KEY',
      params: null,
    });
    expect(c.provider).toBe('siliconflow');
    expect(c.model).toBe('Qwen3-Flash');
    expect(c.baseURL).toBe('https://api.siliconflow.cn/v1');
    expect(c.apiKeyEnv).toBe('SILICONFLOW_API_KEY');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/llm/loadStageConfig.test.ts`
Expected: FAIL — cannot resolve `./loadStageConfig`.

- [ ] **Step 3: Implement the loader**

Create `src/llm/loadStageConfig.ts`:
```typescript
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { stageConfig } from '@/db/schema';
import { resolveStageConfig } from './resolve';
import type { Stage, StageModelConfig } from './types';

type StageConfigRow = {
  stage: string;
  provider: string;
  model: string;
  baseUrl: string | null;
  apiKeyEnv: string;
  params?: unknown;
};

// Pure: overlay a DB row (or none) on the code defaults.
export function mergeStageConfig(stage: Stage, row: StageConfigRow | undefined): StageModelConfig {
  if (!row) return resolveStageConfig(stage);
  return resolveStageConfig(stage, {
    provider: row.provider as StageModelConfig['provider'],
    model: row.model,
    baseURL: row.baseUrl ?? undefined,
    apiKeyEnv: row.apiKeyEnv,
  });
}

// Side-effecting: read the admin selection from the DB, then merge.
export async function loadStageConfig(stage: Stage): Promise<StageModelConfig> {
  const rows = await db.select().from(stageConfig).where(eq(stageConfig.stage, stage)).limit(1);
  return mergeStageConfig(stage, rows[0]);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test src/llm/loadStageConfig.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the seed script (writes defaults into stage_config)**

Create `src/db/seed.ts`:
```typescript
import { db } from './client';
import { stageConfig } from './schema';
import { DEFAULT_STAGE_CONFIG } from '@/llm/defaults';

async function main() {
  for (const [stage, cfg] of Object.entries(DEFAULT_STAGE_CONFIG)) {
    await db
      .insert(stageConfig)
      .values({
        stage,
        provider: cfg.provider,
        model: cfg.model,
        baseUrl: cfg.baseURL ?? null,
        apiKeyEnv: cfg.apiKeyEnv,
      })
      .onConflictDoNothing({ target: stageConfig.stage });
  }
  console.log('Seeded default stage configs.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```
Add to `package.json` scripts: `"db:seed": "tsx src/db/seed.ts"`. Install the runner: `npm install -D tsx`.

- [ ] **Step 6: Add a health-check route**

Create `src/app/api/health/route.ts`:
```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ ok: true, service: 'cctv-digest', ts: new Date().toISOString() });
}
```

- [ ] **Step 7: Verify the full test suite and build**

Run: `npm test`
Expected: PASS (all tests across sanity, schema, resolve, loadStageConfig).
Run: `npm run build`
Expected: Next.js build succeeds.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(llm): DB-backed stage-config loader, seed script, health route"
```

---

## Self-Review

**Spec coverage (P0 scope only):**
- §6 stack (Next.js + Neon + Blob env + AI SDK) — Tasks 1, 2, 4 (Blob token in `.env.example`; Blob client deferred to P1 where it's first used). ✓
- §7 data model (all entities incl. `app_config`/`stage_config`, `pipeline_run`) — Task 2. ✓
- §16 multi-provider abstraction (DeepSeek/SiliconFlow/Gateway/OpenAI-compatible, per-stage, default DeepSeek V4, keys in env) — Tasks 3, 4. ✓
- §13 P0 line (scaffold, abstraction, tables) — all tasks. ✓
- Out of P0 by design: ingestion (P1), extraction (P2), UI (P3+), auth UI (P7). Tracked in roadmap below.

**Placeholder scan:** No "TBD/TODO/handle later". The two "confirm against provider docs" notes (DeepSeek V4 model ids, AI Gateway baseURL) carry concrete default values and are real verification steps, not blanks.

**Type consistency:** `StageModelConfig` ({provider, model, baseURL, apiKeyEnv}) used identically in `types.ts`, `resolve.ts`, `model.ts`, `loadStageConfig.ts`. `Stage` union ('extraction'|'radar'|'deep'|'thread') consistent across defaults, resolver, seed, schema `stage_config.stage`. DB column `base_url`/`api_key_env` ↔ Drizzle `baseUrl`/`apiKeyEnv` ↔ config `baseURL`/`apiKeyEnv` mapping is explicit in `mergeStageConfig`. ✓

---

## Roadmap — subsequent plans (write each when reached)

Each is its own plan file under `docs/superpowers/plans/`, self-contained and testable:

- **P1 · Ingestion + backfill** — govopendata crawler (real headers + rate-limit/backoff), Tushare/GitHub fallback chain, Vercel Blob storage, `broadcast_day` rows; one-time local backfill script (~2009→now). Tests on parsers via golden files.
- **P2 · Structured extraction** — DeepSeek Flash extraction → `item`/`tifa`/`tifa_mention`/`sector_signal` + segment stats; run over full history; `count_tokens`/cost calibration.
- **P3 · River homepage + Explore basics** — full-screen streamgraph from real time-series, scrub readout, click→animated daily slice shell; keyword/sector time-series + drumbeat heatmap.
- **P4 · Deep interpretation + Radar + fused daily slice** — DeepSeek Pro 3-layer interpretation with confidence, radar (vs 90-day baseline), the 晨报+雷达 daily-read page.
- **P5 · Thread synthesis + thread detail** — objective emergent-thread clustering (lifecycle), thread detail editorial pages, river renders variable thread count + long-tail handling.
- **P6 · Daily Cron automation** — end-to-end pipeline on Vercel Cron (idempotent, `pipeline_run` logging, backfill of missed days).
- **P7 · System admin + auth + provider config UI** — middleware-gated `/admin` (single admin secret + signed cookie), per-stage provider/model editor, run/cost views, manual re-run trigger.
- **P8 (later) · Polish + 问联播 RAG**.
