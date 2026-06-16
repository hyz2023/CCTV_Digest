import { getDb } from '@/db/client';
import { pipelineRun } from '@/db/schema';
import { estimateCostUsd, type Usage } from './cost';

export type LlmUsage = Usage;

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
    // 忽略
  }
}
