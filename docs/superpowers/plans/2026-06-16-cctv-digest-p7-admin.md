# CCTV_Digest — P7 System Admin + Auth + Model Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.

**Goal:** An auth-gated **系统管理 (`/admin`)** where the single admin configures, per pipeline stage, which **LLM provider + model** to use (editing `stage_config`), and views recent `pipeline_run` records. Content pages stay public; only `/admin` (and its write APIs) are protected, using a free, zero-dependency scheme: a single `ADMIN_SECRET` + an HMAC-signed, expiring session cookie enforced by middleware.

**Architecture:** `src/auth/session.ts` — pure/async Web-Crypto HMAC `signSession`/`verifySession` (+ constant-time compare), fully TDD'd. `src/middleware.ts` gates `/admin/*` (redirect to `/admin/login` if no valid cookie). Login/logout via API routes that re-check the password/clear the cookie. `/admin` server page reads `stage_config` + `pipeline_run`; an auth-gated `/api/admin/config` upserts a stage's provider/model/params (NEVER api keys — those stay in env). Pure logic TDD'd; pages/middleware verified via build + render checks.

**Tech Stack:** Next.js 16 middleware + route handlers, Web Crypto (Edge-safe), Drizzle (`stage_config`, `pipeline_run`), Vitest. Builds on P0 (`stage_config`, `loadStageConfig`, providers).

**Security invariants:** fail-closed when `ADMIN_SECRET` unset; cookie is HMAC-signed + expiring; password compared in constant time; API keys never read/written/displayed by the admin surface.

---

## File Structure
| File | Responsibility |
|---|---|
| `src/auth/session.ts` / `.test.ts` | `signSession`/`verifySession`/`checkPassword` (Web-Crypto HMAC) |
| `src/middleware.ts` | gate `/admin/*` (verify cookie) |
| `src/app/api/admin/login/route.ts` | POST password → set signed cookie |
| `src/app/api/admin/logout/route.ts` | clear cookie |
| `src/app/admin/login/page.tsx` | login form |
| `src/data/adminConfig.ts` / `.test.ts` | read/upsert `stage_config`; recent `pipeline_run` |
| `src/app/api/admin/config/route.ts` | POST stage config (auth-gated) |
| `src/app/admin/page.tsx` | admin dashboard (per-stage model config form + run list) |
| `src/components/AdminConfig.tsx` | client form for the stage configs |

---

## Task 1: Auth session core (Web-Crypto HMAC) — TDD

**Files:** Create `src/auth/session.ts`; Test `src/auth/session.test.ts`.

- [ ] **Step 1: failing test `src/auth/session.test.ts`:**
```typescript
import { describe, it, expect } from 'vitest';
import { signSession, verifySession, checkPassword } from './session';

const SECRET = 'top-secret-value';
const NOW = 1_750_000_000_000;

describe('session signing', () => {
  it('a freshly-signed token verifies', async () => {
    const token = await signSession(SECRET, { ttlMs: 1000, now: NOW });
    expect(await verifySession(token, SECRET, { now: NOW + 500 })).toBe(true);
  });
  it('rejects an expired token', async () => {
    const token = await signSession(SECRET, { ttlMs: 1000, now: NOW });
    expect(await verifySession(token, SECRET, { now: NOW + 2000 })).toBe(false);
  });
  it('rejects a tampered expiry', async () => {
    const token = await signSession(SECRET, { ttlMs: 1000, now: NOW });
    const [, sig] = token.split('.');
    const forged = `${NOW + 999999}.${sig}`;
    expect(await verifySession(forged, SECRET, { now: NOW + 500 })).toBe(false);
  });
  it('rejects a token signed with a different secret', async () => {
    const token = await signSession('other', { ttlMs: 1000, now: NOW });
    expect(await verifySession(token, SECRET, { now: NOW + 500 })).toBe(false);
  });
  it('rejects empty/garbage', async () => {
    expect(await verifySession('', SECRET)).toBe(false);
    expect(await verifySession('garbage', SECRET)).toBe(false);
  });
});

describe('checkPassword', () => {
  it('true on exact match', () => { expect(checkPassword('abc', 'abc')).toBe(true); });
  it('false on mismatch / empty secret', () => {
    expect(checkPassword('abc', 'abd')).toBe(false);
    expect(checkPassword('abc', '')).toBe(false);
    expect(checkPassword('', '')).toBe(false);
  });
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement `src/auth/session.ts`** (Web Crypto HMAC-SHA256; Edge + Node compatible):
```typescript
async function hmacHex(secret: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const DAY = 86_400_000;

export async function signSession(secret: string, opts: { ttlMs?: number; now?: number } = {}): Promise<string> {
  const now = opts.now ?? Date.now();
  const exp = now + (opts.ttlMs ?? 7 * DAY);
  return `${exp}.${await hmacHex(secret, String(exp))}`;
}

export async function verifySession(token: string, secret: string, opts: { now?: number } = {}): Promise<boolean> {
  if (!secret) return false;
  const now = opts.now ?? Date.now();
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const expStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < now) return false;
  return timingSafeEqual(sig, await hmacHex(secret, expStr));
}

export function checkPassword(input: string, secret: string): boolean {
  if (!secret) return false;
  return timingSafeEqual(input, secret);
}

export const ADMIN_COOKIE = 'cctv_admin';
```

- [ ] **Step 4: run → PASS (7 tests).** Then `npm test` + `npx tsc --noEmit`.

- [ ] **Step 5: commit** — `git add -A && git commit -m "feat(auth): HMAC-signed expiring session core (Web Crypto)"`

---

## Task 2: Middleware gate + login/logout

**Files:** Create `src/middleware.ts`, `src/app/api/admin/login/route.ts`, `src/app/api/admin/logout/route.ts`, `src/app/admin/login/page.tsx`.

- [ ] **Step 1: `src/middleware.ts`** — gate `/admin/*` except `/admin/login`. Verify the cookie; redirect to login otherwise. (No unit test — verified via render checks; logic is thin over the TDD'd `verifySession`.)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifySession, ADMIN_COOKIE } from '@/auth/session';

export const config = { matcher: ['/admin/:path*'] };

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === '/admin/login') return NextResponse.next();
  const token = req.cookies.get(ADMIN_COOKIE)?.value ?? '';
  const ok = await verifySession(token, process.env.ADMIN_SECRET ?? '');
  if (ok) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  return NextResponse.redirect(url);
}
```

- [ ] **Step 2: `src/app/api/admin/login/route.ts`** — POST `{ password }`; on match, set the signed cookie (httpOnly, sameSite lax, secure, path=/, ~7d); else 401.
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { checkPassword, signSession, ADMIN_COOKIE } from '@/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET ?? '';
  const { password } = await req.json().catch(() => ({ password: '' }));
  if (!checkPassword(String(password ?? ''), secret)) {
    return NextResponse.json({ error: 'invalid' }, { status: 401 });
  }
  const token = await signSession(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 7 * 86400 });
  return res;
}
```

- [ ] **Step 3: `src/app/api/admin/logout/route.ts`** — clear the cookie:
```typescript
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE } from '@/auth/session';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
```

- [ ] **Step 4: `src/app/admin/login/page.tsx`** — a minimal client login form: password input → POST `/api/admin/login` → on ok `location.href='/admin'`; on 401 show an error. Dark, simple (admin doesn't need River aesthetics).

- [ ] **Step 5: verify.** `npm test` (all pass), `npx tsc --noEmit` (clean), `npm run build` (green; `/admin/login`, `/api/admin/login`, `/api/admin/logout` present; middleware compiles). Render check (no ADMIN_SECRET → fail-closed): start dev PORT=3100, then:
```bash
echo "admin redirect status: $(curl -s -o /dev/null -w '%{http_code}' localhost:3100/admin)"      # expect 307 (redirect to login)
echo "login page: $(curl -s -o /dev/null -w '%{http_code}' localhost:3100/admin/login)"            # expect 200
echo "login POST (no secret set → 401): $(curl -s -o /dev/null -w '%{http_code}' -X POST localhost:3100/api/admin/login -H 'content-type: application/json' -d '{"password":"x"}')"
```
Expect: /admin → 307 (redirect), /admin/login → 200, login POST → 401. Report numbers.

- [ ] **Step 6: commit** — `git add -A && git commit -m "feat(auth): middleware gate for /admin + login/logout + login page"`

---

## Task 3: Admin config (per-stage model) + run view

**Files:** Create `src/data/adminConfig.ts`(+test), `src/app/api/admin/config/route.ts`, `src/components/AdminConfig.tsx`, `src/app/admin/page.tsx`.

- [ ] **Step 1: failing test `src/data/adminConfig.test.ts`** (pure validation of an incoming config update):
```typescript
import { describe, it, expect } from 'vitest';
import { validateStageUpdate } from './adminConfig';

describe('validateStageUpdate', () => {
  it('accepts a valid update', () => {
    const r = validateStageUpdate({ stage: 'deep', provider: 'deepseek', model: 'deepseek-v4-pro', baseUrl: 'https://api.deepseek.com/v1', apiKeyEnv: 'DEEPSEEK_API_KEY' });
    expect(r.ok).toBe(true);
  });
  it('rejects an unknown stage', () => {
    expect(validateStageUpdate({ stage: 'nope', provider: 'deepseek', model: 'm', apiKeyEnv: 'X' }).ok).toBe(false);
  });
  it('rejects an unknown provider', () => {
    expect(validateStageUpdate({ stage: 'deep', provider: 'bogus', model: 'm', apiKeyEnv: 'X' }).ok).toBe(false);
  });
  it('rejects a missing model', () => {
    expect(validateStageUpdate({ stage: 'deep', provider: 'deepseek', model: '', apiKeyEnv: 'X' }).ok).toBe(false);
  });
  it('never accepts an apiKey value field (keys stay in env)', () => {
    const r = validateStageUpdate({ stage: 'deep', provider: 'deepseek', model: 'm', apiKeyEnv: 'X', apiKey: 'sk-leak' } as Record<string, unknown>);
    expect(r.ok).toBe(true);
    expect('apiKey' in (r.value ?? {})).toBe(false); // stripped
  });
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement `src/data/adminConfig.ts`.** Pure `validateStageUpdate` (whitelist stage ∈ Stage, provider ∈ ProviderId, model non-empty; strip everything except {stage,provider,model,baseUrl,apiKeyEnv,params}; NEVER pass through an `apiKey`) + server fns `getStageConfigs()` (read all `stage_config` rows, fall back to defaults via `mergeStageConfig` per stage) and `upsertStageConfig(value)` (Drizzle upsert on stage) and `recentRuns(limit)` (read `pipeline_run` desc).
```typescript
import { eq, desc } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { stageConfig, pipelineRun } from '@/db/schema';
import { DEFAULT_STAGE_CONFIG, PROVIDER_PRESETS } from '@/llm/defaults';
import type { Stage, ProviderId } from '@/llm/types';

const STAGES = Object.keys(DEFAULT_STAGE_CONFIG) as Stage[];
const PROVIDERS = Object.keys(PROVIDER_PRESETS) as ProviderId[];

export interface StageUpdate { stage: string; provider: string; model: string; baseUrl?: string; apiKeyEnv: string; params?: unknown }
export interface ValidatedUpdate { stage: Stage; provider: ProviderId; model: string; baseUrl: string | null; apiKeyEnv: string; params: unknown }

export function validateStageUpdate(input: Record<string, unknown>): { ok: boolean; value?: ValidatedUpdate; error?: string } {
  const stage = String(input.stage ?? '');
  const provider = String(input.provider ?? '');
  const model = String(input.model ?? '');
  if (!STAGES.includes(stage as Stage)) return { ok: false, error: 'unknown stage' };
  if (!PROVIDERS.includes(provider as ProviderId)) return { ok: false, error: 'unknown provider' };
  if (!model) return { ok: false, error: 'model required' };
  const apiKeyEnv = String(input.apiKeyEnv ?? '');
  if (!apiKeyEnv) return { ok: false, error: 'apiKeyEnv required' };
  const value: ValidatedUpdate = {
    stage: stage as Stage, provider: provider as ProviderId, model,
    baseUrl: input.baseUrl ? String(input.baseUrl) : null,
    apiKeyEnv, params: input.params ?? null,
  };
  return { ok: true, value }; // note: any incoming `apiKey` is simply never copied
}

export async function upsertStageConfig(v: ValidatedUpdate): Promise<void> {
  await getDb().insert(stageConfig)
    .values({ stage: v.stage, provider: v.provider, model: v.model, baseUrl: v.baseUrl, apiKeyEnv: v.apiKeyEnv, params: v.params, updatedAt: new Date() })
    .onConflictDoUpdate({ target: stageConfig.stage, set: { provider: v.provider, model: v.model, baseUrl: v.baseUrl, apiKeyEnv: v.apiKeyEnv, params: v.params, updatedAt: new Date() } });
}

export async function getStageConfigs() {
  try {
    const rows = await getDb().select().from(stageConfig);
    const byStage = new Map(rows.map((r) => [r.stage, r]));
    return STAGES.map((s) => {
      const r = byStage.get(s);
      const d = DEFAULT_STAGE_CONFIG[s];
      return { stage: s, provider: r?.provider ?? d.provider, model: r?.model ?? d.model, baseUrl: r?.baseUrl ?? d.baseURL ?? '', apiKeyEnv: r?.apiKeyEnv ?? d.apiKeyEnv };
    });
  } catch {
    return STAGES.map((s) => ({ stage: s, provider: DEFAULT_STAGE_CONFIG[s].provider, model: DEFAULT_STAGE_CONFIG[s].model, baseUrl: DEFAULT_STAGE_CONFIG[s].baseURL ?? '', apiKeyEnv: DEFAULT_STAGE_CONFIG[s].apiKeyEnv }));
  }
}

export async function recentRuns(limit = 50) {
  try {
    return await getDb().select().from(pipelineRun).orderBy(desc(pipelineRun.createdAt)).limit(limit);
  } catch { return []; }
}

export { STAGES, PROVIDERS };
```

- [ ] **Step 4: run → PASS (5 tests).**

- [ ] **Step 5: `src/app/api/admin/config/route.ts`** — auth-gated (re-verify cookie server-side, don't rely on middleware alone for the write API), validate, upsert.
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifySession, ADMIN_COOKIE } from '@/auth/session';
import { validateStageUpdate, upsertStageConfig } from '@/data/adminConfig';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ok = await verifySession(req.cookies.get(ADMIN_COOKIE)?.value ?? '', process.env.ADMIN_SECRET ?? '');
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const v = validateStageUpdate(body);
  if (!v.ok || !v.value) return NextResponse.json({ error: v.error ?? 'invalid' }, { status: 400 });
  await upsertStageConfig(v.value);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: `src/components/AdminConfig.tsx`** (client) — props `{ stages: {stage,provider,model,baseUrl,apiKeyEnv}[]; providers: string[] }`. A table: per stage, editable provider (select), model (text), baseUrl (text), apiKeyEnv (text) + a Save button POSTing `/api/admin/config`. Shows success/error. A logout button (POST /api/admin/logout → redirect /admin/login). NEVER render or accept an API key value — only the env-var NAME.

- [ ] **Step 7: `src/app/admin/page.tsx`** (server, force-dynamic) — load `getStageConfigs()` + `recentRuns()`; render `<AdminConfig stages=... providers={PROVIDERS} />` and a recent-runs table (day, stage, status, error, createdAt). Header notes 系统管理 + that content pages are public.

- [ ] **Step 8: verify.** `npm test` (all pass), `npx tsc --noEmit` (clean), `npm run build` (green; `/admin`, `/api/admin/config` present). Render check: with `ADMIN_SECRET` UNSET, `/admin` redirects to login (307) and `/api/admin/config` POST → 401. With `ADMIN_SECRET=test` set for the dev process, a login POST with the right password returns 200 + sets cookie. Report the unset-case numbers at minimum.

- [ ] **Step 9: commit** — `git add -A && git commit -m "feat(admin): per-stage model config UI + update API + run view"`

---

## Self-Review
**Spec coverage (P7 / §15-16):** `/admin` auth-gated, content public ✓; single ADMIN_SECRET + signed expiring cookie + middleware, fail-closed ✓; per-stage provider+model config editing `stage_config` ✓; providers from the abstraction (deepseek/siliconflow/gateway/openai-compatible) ✓; **API keys never read/written/shown** (only env-var name; incoming apiKey stripped) ✓; `pipeline_run` run view ✓; write API re-verifies auth server-side (defense in depth) ✓; constant-time password + HMAC ✓. Out of scope: multi-user/Clerk (future), per-param tuning UI beyond model (params editable as needed later).

**Placeholder scan:** none.

**Type consistency:** `Stage`/`ProviderId` from `@/llm/types`; `ADMIN_COOKIE`/`signSession`/`verifySession`/`checkPassword` from `@/auth/session` used in middleware + login + config routes; `validateStageUpdate`/`upsertStageConfig`/`getStageConfigs`/`recentRuns` consistent; stage_config columns match P0 schema.

## Live note
Set `ADMIN_SECRET` in Vercel env. Visit `/admin` → redirected to `/admin/login` → enter the secret → manage per-stage models + view runs. API keys (`DEEPSEEK_API_KEY` etc.) are set in env only and never exposed in the admin UI.
