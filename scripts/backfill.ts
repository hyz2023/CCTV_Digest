import { dateRange, ingestDay } from '@/ingest/ingest';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function main() {
  const start = process.argv[2];
  const end = process.argv[3] ?? new Date().toISOString().slice(0, 10);
  if (!start) {
    console.error('usage: tsx scripts/backfill.ts <start YYYY-MM-DD> [end YYYY-MM-DD]');
    process.exit(1);
  }
  const days = dateRange(start, end);
  const delayMs = Number(process.env.BACKFILL_DELAY_MS ?? 1500);
  let ok = 0, skip = 0, fail = 0;
  for (const day of days) {
    try {
      const r = await ingestDay(day);
      if (r.skipped) { skip++; } else { ok++; console.log(`✓ ${day}`); }
    } catch (e) {
      fail++;
      console.error(`✗ ${day}: ${e instanceof Error ? e.message : e}`);
    }
    await sleep(delayMs);
  }
  console.log(`done. ingested=${ok} skipped=${skip} failed=${fail} of ${days.length}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
