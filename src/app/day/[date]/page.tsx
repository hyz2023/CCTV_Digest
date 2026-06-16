import DailyRead from '@/components/DailyRead';
import { getMentions, getItemsForDay } from '@/data/queries';
import { buildCrossSection } from '@/viz/series';

export const dynamic = 'force-dynamic';

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const crossSection = buildCrossSection(await getMentions(), date, { topN: 8 });
  const items = await getItemsForDay(date);
  return <DailyRead date={date} crossSection={crossSection} items={items} />;
}
