import type { KeywordSeries, SectorHeatmap } from '@/viz/series';

interface Props {
  keyword: KeywordSeries;
  heatmap: SectorHeatmap;
}

const NAV_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 28px',
  borderBottom: '1px solid #1b1b26',
};

const SVG_W = 480;
const SVG_H = 80;
const PAD = 12;

export default function Explore({ keyword, heatmap }: Props) {
  // Build sparkline path for keyword series
  const pts = keyword.points;
  const maxVal = Math.max(1, ...pts.map((p) => p.value));
  const plotW = SVG_W - PAD * 2;
  const plotH = SVG_H - PAD * 2;

  const sparkPoints =
    pts.length >= 2
      ? pts
          .map((p, i) => {
            const x = PAD + (i / (pts.length - 1)) * plotW;
            const y = PAD + plotH - (p.value / maxVal) * plotH;
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ')
      : '';

  // Heatmap: max value across all rows for normalization
  const heatMax = Math.max(
    1,
    ...heatmap.rows.flatMap((r) => r.values),
  );

  return (
    <main style={{ minHeight: '100vh', background: '#08080e', color: '#ECE7DD' }}>
      {/* Nav */}
      <header style={NAV_STYLE}>
        <div style={{ fontWeight: 800, letterSpacing: 1 }}>联播 · 脉络</div>
        <nav style={{ display: 'flex', gap: 20, fontSize: 13, color: '#8a8a98' }}>
          <a href="/" style={{ color: '#8a8a98' }}>脉络</a>
          <span style={{ color: '#ECEAE3', borderBottom: '2px solid #e0436b' }}>探索</span>
        </nav>
      </header>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 28px' }}>
        {/* Keyword sparkline */}
        <section style={{ marginBottom: 56 }}>
          <div style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: '#c99', marginBottom: 8 }}>
            关键词趋势 · KEYWORD TREND
          </div>
          <h2 className="serif" style={{ fontSize: 28, fontWeight: 800, margin: '0 0 20px' }}>
            {keyword.term || '—'}
          </h2>

          {pts.length >= 2 ? (
            <div style={{ overflowX: 'auto' }}>
              <svg
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                style={{ display: 'block', width: '100%', maxWidth: SVG_W, height: SVG_H, background: '#0e0e18', borderRadius: 8 }}
                aria-label={`${keyword.term} 趋势折线`}
              >
                {/* Zero baseline */}
                <line
                  x1={PAD}
                  y1={PAD + plotH}
                  x2={PAD + plotW}
                  y2={PAD + plotH}
                  stroke="#1b1b26"
                  strokeWidth={1}
                />
                {/* Sparkline */}
                <path d={sparkPoints} fill="none" stroke="#e0436b" strokeWidth={2} strokeLinejoin="round" />
                {/* Dots */}
                {pts.map((p, i) => {
                  const x = PAD + (i / (pts.length - 1)) * plotW;
                  const y = PAD + plotH - (p.value / maxVal) * plotH;
                  return <circle key={p.period} cx={x.toFixed(1)} cy={y.toFixed(1)} r={3} fill="#e0436b" />;
                })}
                {/* Period labels */}
                {pts.map((p, i) => {
                  if (pts.length > 8 && i % 3 !== 0) return null;
                  const x = PAD + (i / (pts.length - 1)) * plotW;
                  return (
                    <text
                      key={p.period}
                      x={x}
                      y={SVG_H - 2}
                      textAnchor="middle"
                      fontSize={7}
                      fill="#8a8a98"
                    >
                      {p.period}
                    </text>
                  );
                })}
              </svg>
            </div>
          ) : (
            <p style={{ color: '#8a8a98', fontSize: 14 }}>暂无关键词数据。</p>
          )}
        </section>

        {/* Sector heatmap */}
        <section>
          <div style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: '#c99', marginBottom: 8 }}>
            领域热力图 · SECTOR HEATMAP
          </div>
          <h2 className="serif" style={{ fontSize: 28, fontWeight: 800, margin: '0 0 20px' }}>
            各领域强度分布
          </h2>

          {heatmap.rows.length === 0 ? (
            <p style={{ color: '#8a8a98', fontSize: 14 }}>暂无领域数据。</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              {/* Period header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `80px repeat(${heatmap.periods.length}, 1fr)`,
                  gap: 2,
                  marginBottom: 2,
                }}
              >
                <div />
                {heatmap.periods.map((p) => (
                  <div key={p} style={{ fontSize: 9, color: '#8a8a98', textAlign: 'center', padding: '2px 0' }}>
                    {p.slice(2)}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {heatmap.rows.map((row) => (
                <div
                  key={row.sector}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `80px repeat(${heatmap.periods.length}, 1fr)`,
                    gap: 2,
                    marginBottom: 2,
                  }}
                >
                  <div style={{ fontSize: 12, color: '#ECE7DD', display: 'flex', alignItems: 'center', paddingRight: 8 }}>
                    {row.sector}
                  </div>
                  {row.values.map((val, i) => {
                    const opacity = val / heatMax;
                    return (
                      <div
                        key={heatmap.periods[i]}
                        title={`${row.sector} ${heatmap.periods[i]}: ${val.toFixed(2)}`}
                        style={{
                          height: 24,
                          background: `rgba(224,67,107,${opacity.toFixed(3)})`,
                          borderRadius: 3,
                          minWidth: 18,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
