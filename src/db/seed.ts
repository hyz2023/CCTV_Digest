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
