import Explore from '@/components/Explore';
import { getMentions, getSectorSignals } from '@/data/queries';
import { buildKeywordSeries, buildStreamSeries, buildSectorHeatmap } from '@/viz/series';

export const dynamic = 'force-dynamic';

export default async function ExplorePage() {
  const mentions = await getMentions();
  const top = buildStreamSeries(mentions, { topN: 1 }).streams[0]?.term ?? '';
  const keyword = buildKeywordSeries(mentions, top);
  const heatmap = buildSectorHeatmap(await getSectorSignals());
  return <Explore keyword={keyword} heatmap={heatmap} />;
}
