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
