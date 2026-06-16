import RiverChart from '@/components/RiverChart';
import { getMentions } from '@/data/queries';
import { getThreads } from '@/data/threads';
import { buildDailyStreamSeries, topTermGroups } from '@/viz/dailyStream';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [threads, mentions] = await Promise.all([getThreads(), getMentions()]);
  const groups = threads.length ? threads : topTermGroups(mentions, 6);
  const series = buildDailyStreamSeries(mentions, groups);
  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', background: '#08080e', color: '#ECEAE3' }}>
      <header style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 28px', borderBottom: '1px solid #1b1b26' }}>
        <div style={{ fontWeight: 800, letterSpacing: 1 }}>联播 · 脉络</div>
        <nav style={{ display: 'flex', gap: 20, fontSize: 13, color: '#8a8a98' }}>
          <span style={{ color: '#ECEAE3', borderBottom: '2px solid #e0436b' }}>脉络</span>
          <a href="/explore" style={{ color: '#8a8a98' }}>探索</a>
        </nav>
      </header>
      <section style={{ flex: '0 0 auto', padding: '14px 28px 10px' }}>
        <div style={{ fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: '#c99' }}>The Currents of China</div>
        <h1 className="serif" style={{ fontSize: 'clamp(22px,3vw,40px)', fontWeight: 800, margin: '4px 0 0' }}>几条主线，如何此消彼长</h1>
      </section>
      <div style={{ flex: 1, minHeight: 0 }}>
        <RiverChart series={series} />
      </div>
    </main>
  );
}
