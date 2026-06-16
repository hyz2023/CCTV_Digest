import DailyRead from '@/components/DailyRead';
import { getMentions, getItemsForDay, getInterpretation, getRadar } from '@/data/queries';
import { buildCrossSection } from '@/viz/series';
import { getThreads } from '@/data/threads';
import { buildDailyStreamSeries, topTermGroups } from '@/viz/dailyStream';

export const dynamic = 'force-dynamic';

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const [mentions, items, signals, radar, threads] = await Promise.all([
    getMentions(),
    getItemsForDay(date),
    getInterpretation(date),
    getRadar(date),
    getThreads(),
  ]);
  const crossSection = buildCrossSection(mentions, date, { topN: 8 });
  const groups = threads.length ? threads : topTermGroups(mentions, 6);
  const riverSeries = buildDailyStreamSeries(mentions, groups);
  return <DailyRead date={date} crossSection={crossSection} items={items} signals={signals} radar={radar} riverSeries={riverSeries} />;
}
