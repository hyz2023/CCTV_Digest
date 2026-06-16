import { getDb } from '@/db/client';
import { tifaMention, dailyInterpretation } from '@/db/schema';
import { STREAM_COLORS } from '@/viz/palette';
import { buildThreadInput, type Mention } from './aggregate';
import { synthesizeThreads } from './synthesize';
import { buildThreadRows } from './rows';
import { persistThreads } from './persist';
import type { ThreadSet } from './schema';

export interface ThreadRunDeps {
  loadMentions: () => Promise<Mention[]>;
  loadThreadLabels: () => Promise<string[]>;
  synthesize: (input: ReturnType<typeof buildThreadInput>) => Promise<ThreadSet>;
  persist: (rows: ReturnType<typeof buildThreadRows>) => Promise<void>;
}

const DEFAULT_DEPS: ThreadRunDeps = {
  loadMentions: async () => await getDb().select({ day: tifaMention.day, term: tifaMention.term, count: tifaMention.count }).from(tifaMention) as Mention[],
  loadThreadLabels: async () => {
    const rows = await getDb().select({ topSignals: dailyInterpretation.topSignals }).from(dailyInterpretation);
    const labels: string[] = [];
    for (const r of rows) for (const s of ((r.topSignals as { thread?: string }[]) ?? [])) if (s.thread) labels.push(s.thread);
    return labels;
  },
  synthesize: (input) => synthesizeThreads(input),
  persist: (rows) => persistThreads(rows),
};

export async function synthesizeAllThreads(deps: ThreadRunDeps = DEFAULT_DEPS): Promise<{ threadCount: number }> {
  const mentions = await deps.loadMentions();
  if (!mentions.length) throw new Error('no mentions to cluster into threads');
  const input = buildThreadInput(mentions, await deps.loadThreadLabels());
  const set = await deps.synthesize(input);
  const rows = buildThreadRows(set, mentions, STREAM_COLORS);
  await deps.persist(rows);
  return { threadCount: set.threads.length };
}
