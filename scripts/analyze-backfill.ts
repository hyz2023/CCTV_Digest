import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { broadcastDay } from '@/db/schema';
import { analyzeDay } from '@/interpret/run';

async function main() {
  const rows = await getDb().select({ date: broadcastDay.date })
    .from(broadcastDay).where(eq(broadcastDay.status, 'extracted')).orderBy(asc(broadcastDay.date));
  let ok = 0, fail = 0;
  for (const { date } of rows) {
    try { await analyzeDay(date); ok++; console.log(`✓ ${date}`); }
    catch (e) { fail++; console.error(`✗ ${date}: ${e instanceof Error ? e.message : e}`); }
  }
  console.log(`analysis done. ok=${ok} failed=${fail} of ${rows.length}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
