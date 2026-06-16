import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { broadcastDay, item, tifaMention } from '@/db/schema';
import { loadStageConfig } from '@/llm/loadStageConfig';
import { detectRadar, type Mention, type RadarEvent } from '@/radar/detect';
import { interpretDay } from './interpret';
import { persistAnalysis } from './persist';
import type { InterpItem } from './prompt';
import type { DeepInterpretation } from './schema';

export function shouldSkipAnalysis(day: { status?: string } | undefined): boolean {
  return day?.status === 'analyzed';
}

export interface AnalyzeDeps {
  getDay: (date: string) => Promise<{ status?: string } | undefined>;
  loadInputs: (date: string) => Promise<{ items: InterpItem[]; mentions: Mention[] }>;
  detect: (date: string, mentions: Mention[]) => RadarEvent[];
  interpret: (input: { date: string; items: InterpItem[]; radar: { type: string; target: string; magnitude: number }[] }) => Promise<DeepInterpretation>;
  persist: (date: string, radar: RadarEvent[], interp: DeepInterpretation, model: string) => Promise<void>;
  model: string;
}

const DEFAULT_DEPS: AnalyzeDeps = {
  getDay: async (date) => (await getDb().select().from(broadcastDay).where(eq(broadcastDay.date, date)).limit(1))[0],
  loadInputs: async (date) => {
    const db = getDb();
    const items = await db.select({ ord: item.ord, segment: item.segment, title: item.title, summary: item.summary })
      .from(item).where(eq(item.day, date)).orderBy(item.ord) as { ord: number; segment: string; title: string | null; summary: string | null }[];
    const mentions = await db.select({ day: tifaMention.day, term: tifaMention.term, count: tifaMention.count }).from(tifaMention) as Mention[];
    return {
      items: items.map((i) => ({ ord: i.ord, segment: i.segment, title: i.title ?? '', summary: i.summary ?? '' })),
      mentions,
    };
  },
  detect: (date, mentions) => detectRadar(date, mentions),
  interpret: (input) => interpretDay(input),
  persist: (date, radar, interp, model) => persistAnalysis(date, radar, interp, model),
  model: '',
};

export async function analyzeDay(date: string, deps: AnalyzeDeps = DEFAULT_DEPS): Promise<{ date: string; skipped: boolean }> {
  const day = await deps.getDay(date);
  if (!day) throw new Error(`day ${date} not found`);
  if (shouldSkipAnalysis(day)) return { date, skipped: true };
  if (day.status !== 'extracted') throw new Error(`day ${date} is not extracted yet (status=${day.status})`);
  const { items, mentions } = await deps.loadInputs(date);
  const radar = deps.detect(date, mentions);
  const interp = await deps.interpret({ date, items, radar: radar.map((r) => ({ type: r.type, target: r.target, magnitude: r.magnitude })) });
  const model = deps.model || (await loadStageConfig('deep')).model;
  await deps.persist(date, radar, interp, model);
  return { date, skipped: false };
}
