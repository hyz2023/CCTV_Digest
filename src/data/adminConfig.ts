import { desc } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { stageConfig, pipelineRun } from '@/db/schema';
import { DEFAULT_STAGE_CONFIG, PROVIDER_PRESETS } from '@/llm/defaults';
import type { Stage, ProviderId } from '@/llm/types';

const STAGES = Object.keys(DEFAULT_STAGE_CONFIG) as Stage[];
const PROVIDERS = Object.keys(PROVIDER_PRESETS) as ProviderId[];

export interface ValidatedUpdate { stage: Stage; provider: ProviderId; model: string; baseUrl: string | null; apiKeyEnv: string; params: unknown }

export function validateStageUpdate(input: Record<string, unknown>): { ok: boolean; value?: ValidatedUpdate; error?: string } {
  const stage = String(input.stage ?? '');
  const provider = String(input.provider ?? '');
  const model = String(input.model ?? '');
  const apiKeyEnv = String(input.apiKeyEnv ?? '');
  if (!STAGES.includes(stage as Stage)) return { ok: false, error: 'unknown stage' };
  if (!PROVIDERS.includes(provider as ProviderId)) return { ok: false, error: 'unknown provider' };
  if (!model) return { ok: false, error: 'model required' };
  if (!apiKeyEnv) return { ok: false, error: 'apiKeyEnv required' };
  // Only these fields are ever copied — any incoming `apiKey` is intentionally dropped.
  const value: ValidatedUpdate = {
    stage: stage as Stage, provider: provider as ProviderId, model,
    baseUrl: input.baseUrl ? String(input.baseUrl) : null, apiKeyEnv, params: input.params ?? null,
  };
  return { ok: true, value };
}

export async function upsertStageConfig(v: ValidatedUpdate): Promise<void> {
  await getDb().insert(stageConfig)
    .values({ stage: v.stage, provider: v.provider, model: v.model, baseUrl: v.baseUrl, apiKeyEnv: v.apiKeyEnv, params: v.params, updatedAt: new Date() })
    .onConflictDoUpdate({ target: stageConfig.stage, set: { provider: v.provider, model: v.model, baseUrl: v.baseUrl, apiKeyEnv: v.apiKeyEnv, params: v.params, updatedAt: new Date() } });
}

export interface StageConfigView { stage: string; provider: string; model: string; baseUrl: string; apiKeyEnv: string }
export async function getStageConfigs(): Promise<StageConfigView[]> {
  const fallback = () => STAGES.map((s) => ({ stage: s, provider: DEFAULT_STAGE_CONFIG[s].provider, model: DEFAULT_STAGE_CONFIG[s].model, baseUrl: DEFAULT_STAGE_CONFIG[s].baseURL ?? '', apiKeyEnv: DEFAULT_STAGE_CONFIG[s].apiKeyEnv }));
  try {
    const rows = await getDb().select().from(stageConfig);
    const byStage = new Map(rows.map((r) => [r.stage, r]));
    return STAGES.map((s) => {
      const r = byStage.get(s); const d = DEFAULT_STAGE_CONFIG[s];
      return { stage: s, provider: r?.provider ?? d.provider, model: r?.model ?? d.model, baseUrl: r?.baseUrl ?? d.baseURL ?? '', apiKeyEnv: r?.apiKeyEnv ?? d.apiKeyEnv };
    });
  } catch { return fallback(); }
}

export async function recentRuns(limit = 50) {
  try { return await getDb().select().from(pipelineRun).orderBy(desc(pipelineRun.createdAt)).limit(limit); }
  catch { return []; }
}

export { STAGES, PROVIDERS };
