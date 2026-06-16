import RiverChart from '@/components/RiverChart';
import { getMentions } from '@/data/queries';
import { buildStreamSeries } from '@/viz/series';
import { getThreadStreamSeries } from '@/data/threads';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const series = (await getThreadStreamSeries()) ?? buildStreamSeries(await getMentions(), { topN: 6 });
  return (
    <main style={{ minHeight: '100vh', background: '#08080e', color: '#ECEAE3' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 28px', borderBottom: '1px solid #1b1b26' }}>
        <div style={{ fontWeight: 800, letterSpacing: 1 }}>联播 · 脉络</div>
        <nav style={{ display: 'flex', gap: 20, fontSize: 13, color: '#8a8a98' }}>
          <span style={{ color: '#ECEAE3', borderBottom: '2px solid #e0436b' }}>脉络</span>
          <a href="/explore" style={{ color: '#8a8a98' }}>探索</a>
        </nav>
      </header>
      <section style={{ padding: '28px 28px 8px' }}>
        <div style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: '#c99' }}>The Currents of China</div>
        <h1 className="serif" style={{ fontSize: 'clamp(30px,4.4vw,56px)', fontWeight: 800, margin: '8px 0' }}>几条主线，如何此消彼长</h1>
        <p style={{ color: '#9a9aac', fontSize: 14, maxWidth: 620 }}>每条河流是一条发展主线，宽度=被强调的力度。移动鼠标扫描时间，读取当月横截面。</p>
      </section>
      <div style={{ height: '60vh', minHeight: 420 }}>
        <RiverChart series={series} />
      </div>
    </main>
  );
}
