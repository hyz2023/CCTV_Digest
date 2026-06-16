import DailyRead from '@/components/DailyRead';
import { getMentions, getItemsForDay, getInterpretation, getRadar } from '@/data/queries';
import { buildCrossSection } from '@/viz/series';

export const dynamic = 'force-dynamic';

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const [mentions, items, signals, radar] = await Promise.all([
    getMentions(),
    getItemsForDay(date),
    getInterpretation(date),
    getRadar(date),
  ]);
  const crossSection = buildCrossSection(mentions, date, { topN: 8 });
  return <DailyRead date={date} crossSection={crossSection} items={items} signals={signals} radar={radar} />;
}
