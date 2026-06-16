import { synthesizeAllThreads } from '@/threads/run';
async function main() {
  const { threadCount } = await synthesizeAllThreads();
  console.log(`synthesized ${threadCount} threads`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
