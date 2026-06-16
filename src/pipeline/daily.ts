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
    ['ingest', deps.ingest], ['extract', deps.extract], ['analyze', deps.analyze],
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
      break;
    }
  }
  return { date, results };
}
