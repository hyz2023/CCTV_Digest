# CCTV_Digest — P8 LLM 用量与成本捕获 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.

**Goal:** 每次 LLM 调用都把 token 用量与估算成本写入 `pipeline_run`（之前 inputTokens/outputTokens/costUsd 为 null），并在 `/admin` 运行表展示。做法：在三处 LLM 调用（extraction/deep/thread 的 `DEFAULT_DEPS.generate`）从 AI-SDK `generateObject` 的返回里取 `usage`，归一化后估算成本、写一条 `pipeline_run`（fire-and-forget，不影响主流程）。**不改各 wrapper 的导出签名/现有测试**，不改 P6 的编排日志（两类行共存：编排状态行 + LLM 用量行）。

**Architecture:** `src/llm/cost.ts`（纯：单价表 + `estimateCostUsd`，TDD）；`src/llm/usage.ts`（纯：`normalizeUsage` + `buildLlmRunRow`，TDD；+ `recordLlmRun` 写库、fire-and-forget、不单测）。三处 `DEFAULT_DEPS.generate` 各加两行（取 usage + `recordLlmRun`）。`/admin` 表加 tokens/成本列。

**Tech Stack:** TypeScript, `ai` v6（`generateObject` 返回 `usage`）, Drizzle（`pipeline_run`）, Vitest。

**Scope note:** `recordLlmRun` 用 `day` 上下文：deep 阶段能从 `input.date` 拿到 day；extraction/thread 无单日上下文，`day=null`（按 createdAt 仍可定位）。radar 是确定性、无 LLM，不记录。

---

## File Structure
| File | Responsibility |
|---|---|
| `src/llm/cost.ts` / `.test.ts` | 单价表 + `estimateCostUsd(model, usage)`（未知模型 → null） |
| `src/llm/usage.ts` / `.test.ts` | `normalizeUsage`（兼容字段名）+ `buildLlmRunRow`（纯）；`recordLlmRun`（写 pipeline_run，fire-and-forget） |
| `src/extract/extract.ts` | DEFAULT_DEPS.generate 取 usage + record（stage `extraction`） |
| `src/interpret/interpret.ts` | DEFAULT_DEPS.generate 取 usage + record（stage `deep`，带 input.date） |
| `src/threads/synthesize.ts` | DEFAULT_DEPS.generate 取 usage + record（stage `thread`） |
| `src/app/admin/page.tsx` | 运行表新增 tokens / 成本($) 两列 |

---

## Task 1: 成本估算 + 用量行构造（纯，TDD）

**Files:** Create `src/llm/cost.ts`(+test)、`src/llm/usage.ts`(+test)。

- [ ] **Step 1: failing test `src/llm/cost.test.ts`:**
```typescript
import { describe, it, expect } from 'vitest';
import { estimateCostUsd } from './cost';

describe('estimateCostUsd', () => {
  it('prices DeepSeek V4 Pro per the table', () => {
    // 1000 in * 0.435/1e6 + 2000 out * 0.87/1e6 = 0.000435 + 0.00174 = 0.002175
    expect(estimateCostUsd('deepseek-v4-pro', { inputTokens: 1000, outputTokens: 2000 })).toBeCloseTo(0.002175, 9);
  });
  it('prices DeepSeek V4 Flash', () => {
    expect(estimateCostUsd('deepseek-v4-flash', { inputTokens: 1_000_000, outputTokens: 0 })).toBeCloseTo(0.09, 9);
  });
  it('returns null for an unknown model', () => {
    expect(estimateCostUsd('mystery-model', { inputTokens: 100, outputTokens: 100 })).toBeNull();
  });
  it('is zero for zero usage on a known model', () => {
    expect(estimateCostUsd('deepseek-v4-flash', { inputTokens: 0, outputTokens: 0 })).toBe(0);
  });
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement `src/llm/cost.ts`:**
```typescript
export interface Usage { inputTokens: number; outputTokens: number }

// 单价：美元 / 每百万 token（in / out）。来源见 spec §17；落地前以各官方为准。
const PRICE_PER_M: Record<string, { in: number; out: number }> = {
  'deepseek-v4-pro': { in: 0.435, out: 0.87 },
  'deepseek-v4-flash': { in: 0.09, out: 0.18 },
  // 备用（若 admin 切换到 Claude 档）
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-fable-5': { in: 10, out: 50 },
};

export function estimateCostUsd(model: string, u: Usage): number | null {
  const p = PRICE_PER_M[model];
  if (!p) return null;
  return +((u.inputTokens / 1e6) * p.in + (u.outputTokens / 1e6) * p.out).toFixed(8);
}
```

- [ ] **Step 4: run → PASS.**

- [ ] **Step 5: failing test `src/llm/usage.test.ts`:**
```typescript
import { describe, it, expect } from 'vitest';
import { normalizeUsage, buildLlmRunRow } from './usage';

describe('normalizeUsage', () => {
  it('reads AI-SDK v6 inputTokens/outputTokens', () => {
    expect(normalizeUsage({ inputTokens: 12, outputTokens: 7, totalTokens: 19 })).toEqual({ inputTokens: 12, outputTokens: 7 });
  });
  it('falls back to prompt/completion token names', () => {
    expect(normalizeUsage({ promptTokens: 5, completionTokens: 3 })).toEqual({ inputTokens: 5, outputTokens: 3 });
  });
  it('defaults missing/undefined usage to zeros', () => {
    expect(normalizeUsage(undefined)).toEqual({ inputTokens: 0, outputTokens: 0 });
    expect(normalizeUsage({})).toEqual({ inputTokens: 0, outputTokens: 0 });
  });
});

describe('buildLlmRunRow', () => {
  it('maps an entry to a pipeline_run row with computed cost', () => {
    const row = buildLlmRunRow({ day: '2026-06-13', stage: 'deep', provider: 'deepseek', model: 'deepseek-v4-pro', usage: { inputTokens: 1000, outputTokens: 2000 } });
    expect(row).toMatchObject({ day: '2026-06-13', stage: 'deep', provider: 'deepseek', model: 'deepseek-v4-pro', inputTokens: 1000, outputTokens: 2000, status: 'ok' });
    expect(row.costUsd).toBeCloseTo(0.002175, 9);
  });
  it('day defaults to null and unknown model → costUsd null', () => {
    const row = buildLlmRunRow({ stage: 'thread', provider: 'x', model: 'mystery', usage: { inputTokens: 1, outputTokens: 1 } });
    expect(row.day).toBeNull();
    expect(row.costUsd).toBeNull();
  });
});
```

- [ ] **Step 6: run → FAIL.**

- [ ] **Step 7: implement `src/llm/usage.ts`:**
```typescript
import { getDb } from '@/db/client';
import { pipelineRun } from '@/db/schema';
import { estimateCostUsd, type Usage } from './cost';

export type LlmUsage = Usage;

// AI SDK 版本间字段名可能不同（inputTokens/outputTokens 或 promptTokens/completionTokens）。
export function normalizeUsage(raw: unknown): LlmUsage {
  const u = (raw ?? {}) as Record<string, number | undefined>;
  return {
    inputTokens: u.inputTokens ?? u.promptTokens ?? 0,
    outputTokens: u.outputTokens ?? u.completionTokens ?? 0,
  };
}

export interface LlmRunEntry {
  day?: string | null;
  stage: string;
  provider: string;
  model: string;
  usage: LlmUsage;
  status?: 'ok' | 'error';
  error?: string;
}

export function buildLlmRunRow(e: LlmRunEntry) {
  return {
    day: e.day ?? null,
    stage: e.stage,
    provider: e.provider,
    model: e.model,
    inputTokens: e.usage.inputTokens,
    outputTokens: e.usage.outputTokens,
    costUsd: estimateCostUsd(e.model, e.usage),
    status: e.status ?? 'ok',
    error: e.error ?? null,
  };
}

// 写一条 pipeline_run；fire-and-forget——记账失败绝不影响主流程。
export async function recordLlmRun(e: LlmRunEntry): Promise<void> {
  try {
    await getDb().insert(pipelineRun).values(buildLlmRunRow(e));
  } catch {
    // 忽略（无 DATABASE_URL / 写入失败时不阻断分析流程）
  }
}
```

- [ ] **Step 8: run → PASS.** 然后 `npm test` + `npx tsc --noEmit`。

- [ ] **Step 9: commit** — `git add -A && git commit -m "feat(llm): cost estimation + pipeline_run usage-row builder (pure, TDD)"`

---

## Task 2: 三处 LLM 调用接线 + admin 表加列

**Files:** Edit `src/extract/extract.ts`、`src/interpret/interpret.ts`、`src/threads/synthesize.ts`、`src/app/admin/page.tsx`。（无新单测——三处 DEFAULT_DEPS 是真实 LLM 路径，与现有约定一致不单测；现有 wrapper 测试用注入的 mock generate，必须保持全绿。）

- [ ] **Step 1: `src/extract/extract.ts`** —— 只改 `DEFAULT_DEPS.generate`，取 usage + record；wrapper `extractTranscript` 与其测试不变。
```typescript
// 顶部新增 import：
import { normalizeUsage, recordLlmRun } from '@/llm/usage';
// DEFAULT_DEPS.generate 改为：
const DEFAULT_DEPS: ExtractDeps = {
  generate: async (text) => {
    const cfg = await loadStageConfig('extraction');
    const { object, usage } = await generateObject({
      model: getModel(cfg),
      schema: ExtractionSchema,
      prompt: buildExtractionPrompt(text),
    });
    await recordLlmRun({ stage: 'extraction', provider: cfg.provider, model: cfg.model, usage: normalizeUsage(usage) });
    return object;
  },
};
```

- [ ] **Step 2: `src/interpret/interpret.ts`** —— deep 阶段带 day（来自 input.date）：
```typescript
import { normalizeUsage, recordLlmRun } from '@/llm/usage';
const DEFAULT_DEPS: InterpretDeps = {
  generate: async (input) => {
    const cfg = await loadStageConfig('deep');
    const { object, usage } = await generateObject({
      model: getModel(cfg),
      schema: DeepInterpretationSchema,
      prompt: buildInterpretationPrompt(input),
    });
    await recordLlmRun({ day: input.date, stage: 'deep', provider: cfg.provider, model: cfg.model, usage: normalizeUsage(usage) });
    return object;
  },
};
```

- [ ] **Step 3: `src/threads/synthesize.ts`** —— thread 阶段（无单日，day=null）：
```typescript
import { normalizeUsage, recordLlmRun } from '@/llm/usage';
const DEFAULT_DEPS: SynthesizeDeps = {
  generate: async (input) => {
    const cfg = await loadStageConfig('thread');
    const { object, usage } = await generateObject({ model: getModel(cfg), schema: ThreadSetSchema, prompt: buildThreadPrompt(input) });
    await recordLlmRun({ stage: 'thread', provider: cfg.provider, model: cfg.model, usage: normalizeUsage(usage) });
    return object;
  },
};
```
**核对：** 确认安装的 `ai` v6 `generateObject` 返回对象上确实有 `usage` 字段，且 `normalizeUsage` 取到的字段名正确（写一个一次性脚本或查 `node_modules/ai` 的类型：`GenerateObjectResult.usage` 的形状——很可能是 `{ inputTokens, outputTokens, totalTokens }`）。若字段名不同，调整 `normalizeUsage` 的兼容键。报告确认结果。

- [ ] **Step 4: `src/app/admin/page.tsx`** —— 运行表头加 `Tokens` 和 `成本($)` 两列；行内显示 `{r.inputTokens ?? '—'} / {r.outputTokens ?? '—'}` 和 `{r.costUsd != null ? '$'+r.costUsd.toFixed(4) : '—'}`。`recentRuns()` 已 `select * from pipeline_run`，这些字段已在返回里。保持现有样式风格，`colSpan` 由 5 改为 7（空态那一行）。

- [ ] **Step 5: verify.** `npm test`（全绿——尤其 extract/interpret/synthesize 现有测试不变）、`npx tsc --noEmit`（clean）、`npm run build`（green）。渲染检查（带 ADMIN_SECRET 登录后 /admin 仍渲染，运行表多两列；无运行记录时显示"暂无运行记录" colSpan=7）——可选，至少确认 build 含 /admin。

- [ ] **Step 6: commit** — `git add -A && git commit -m "feat(llm): record token usage + cost to pipeline_run on every LLM call; show in admin"`

---

## Self-Review
**Spec coverage:** 每次 LLM 调用（extraction/deep/thread）写 pipeline_run 含 inputTokens/outputTokens/costUsd ✓；成本按单价表估算、未知模型 null ✓；fire-and-forget 不影响主流程 ✓；admin 可见 token/成本 ✓；radar（无 LLM）不记录 ✓。沿用配置化的 provider/model（记录实际所用 model）✓。

**Placeholder scan:** 无。单价表为具体值（落地以官方为准的说明已在注释）。

**Type consistency:** `Usage`/`LlmUsage` 跨 cost/usage 一致；`buildLlmRunRow` 输出匹配 `pipeline_run` 列；三处 `generate` 仍返回各自 object（wrapper 签名不变）。

## Live note
接线后，跑 `analyze:backfill` / 每日 cron 时，每次 DeepSeek 调用会在 `pipeline_run` 留一条带 token/成本的记录，可在 `/admin` 查看累计花费。
