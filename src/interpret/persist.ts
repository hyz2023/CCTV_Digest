import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { radarEvent, dailyInterpretation, broadcastDay } from '@/db/schema';
import type { DeepInterpretation } from './schema';
import type { RadarEvent } from '@/radar/detect';

export interface AnalysisPersistDeps {
  replaceRadar: (day: string, events: RadarEvent[]) => Promise<void>;
  upsertInterpretation: (day: string, interp: DeepInterpretation, model: string) => Promise<void>;
  markAnalyzed: (day: string) => Promise<void>;
}

const DEFAULT_DEPS: AnalysisPersistDeps = {
  replaceRadar: async (day, events) => {
    const db = getDb();
    await db.delete(radarEvent).where(eq(radarEvent.day, day));
    if (events.length) {
      await db.insert(radarEvent).values(events.map((e) => ({
        day: e.day, type: e.type, target: e.target, magnitude: e.magnitude, detail: e.detail ?? null,
      })));
    }
  },
  upsertInterpretation: async (day, interp, model) => {
    const db = getDb();
    await db.delete(dailyInterpretation).where(eq(dailyInterpretation.day, day));
    await db.insert(dailyInterpretation).values({ day, topSignals: interp.signals, model });
  },
  markAnalyzed: async (day) => {
    await getDb().update(broadcastDay).set({ status: 'analyzed' }).where(eq(broadcastDay.date, day));
  },
};

export async function persistAnalysis(
  day: string, radar: RadarEvent[], interp: DeepInterpretation, model: string,
  deps: AnalysisPersistDeps = DEFAULT_DEPS,
): Promise<void> {
  await deps.replaceRadar(day, radar);
  await deps.upsertInterpretation(day, interp, model);
  await deps.markAnalyzed(day);
}
