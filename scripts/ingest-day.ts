import { ingestDay } from '@/ingest/ingest';

async function main() {
  const day = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  const r = await ingestDay(day);
  console.log(r.skipped ? `skipped ${day} (already ingested)` : `ingested ${day}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
