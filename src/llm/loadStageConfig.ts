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
