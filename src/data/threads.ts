import { getDb } from '@/db/client';
import { thread } from '@/db/schema';
import type { TermGroup } from '@/viz/dailyStream';

// 主线 → 词组（name/color/memberTerms），供首页日级聚合用。
export async function getThreads(): Promise<TermGroup[]> {
  try {
    const rows = await getDb().select({ name: thread.name, color: thread.color, meta: thread.meta }).from(thread);
    return rows
      .map((r) => ({
        name: r.name,
        color: r.color ?? '#888',
        terms: (r.meta as { memberTerms?: string[] } | null)?.memberTerms ?? [],
      }))
      .filter((g) => g.terms.length > 0);
  } catch {
    return [];
  }
}
