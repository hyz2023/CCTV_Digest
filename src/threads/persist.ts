import { getDb } from '@/db/client';
import { thread, threadPoint, threadEvidence } from '@/db/schema';
import type { ThreadRows } from './rows';

export interface ThreadPersistDeps {
  clearAll: () => Promise<void>;
  insertThreads: (rows: ThreadRows['threads']) => Promise<Map<string, number>>;
  insertPoints: (rows: { threadId: number; period: string; intensity: number }[]) => Promise<void>;
}

const DEFAULT_DEPS: ThreadPersistDeps = {
  clearAll: async () => {
    const db = getDb();
    await db.delete(threadEvidence);
    await db.delete(threadPoint);
    await db.delete(thread);
  },
  insertThreads: async (rows) => {
    if (!rows.length) return new Map();
    const inserted = await getDb().insert(thread)
      .values(rows.map((r) => ({ name: r.name, status: r.status, color: r.color, meta: r.meta })))
      .returning({ id: thread.id, name: thread.name });
    return new Map(inserted.map((i) => [i.name, i.id]));
  },
  insertPoints: async (rows) => { if (rows.length) await getDb().insert(threadPoint).values(rows); },
};

export async function persistThreads(rows: ThreadRows, deps: ThreadPersistDeps = DEFAULT_DEPS): Promise<void> {
  await deps.clearAll();
  const idByName = await deps.insertThreads(rows.threads);
  const points = rows.points
    .filter((p) => idByName.has(p.threadName))
    .map((p) => ({ threadId: idByName.get(p.threadName)!, period: p.period, intensity: p.intensity }));
  await deps.insertPoints(points);
}
