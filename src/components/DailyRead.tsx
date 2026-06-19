import type { CrossSection } from '@/viz/series';
import type { DayItem, Signal, RadarView } from '@/data/queries';
import { radarLabel, radarIcon, radarStyle } from '@/data/labels';
import SignalCard from '@/components/SignalCard';
import RiverChart from '@/components/RiverChart';
import type { StreamSeries } from '@/viz/series';

interface Props {
  date: string;
  crossSection: CrossSection;
  items: DayItem[];
  signals: Signal[];
  radar: RadarView[];
  riverSeries: StreamSeries;
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#8a8a98', marginBottom: 14,
};

const SEGMENT_LABEL: Record<string, string> = {
  leader: '领导动态',
  dev: '发展·民生',
  intl: '国际',
};

const NAV_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 28px',
  borderBottom: '1px solid #1b1b26',
};

export default function DailyRead({ date, crossSection, items, signals, radar, riverSeries }: Props) {
  // Group items by segment, preserving ord order
  const groups = new Map<string, DayItem[]>();
  for (const it of items) {
    if (!groups.has(it.segment)) groups.set(it.segment, []);
    groups.get(it.segment)!.push(it);
  }

  const maxVal = Math.max(1, ...crossSection.entries.map((e) => e.value));
  const maxMagnitude = Math.max(
    1,
    ...radar.filter((r) => r.magnitude != null).map((r) => r.magnitude as number),
  );

  return (
    <main style={{ minHeight: '100vh', background: '#08080e', color: '#ECE7DD' }}>
      {/* Nav */}
      <header style={NAV_STYLE}>
        <div style={{ fontWeight: 800, letterSpacing: 1 }}>联播 · 脉络</div>
        <nav style={{ display: 'flex', gap: 20, fontSize: 13, color: '#8a8a98' }}>
          <a href="/" style={{ color: '#8a8a98' }}>脉络</a>
          <a href="/explore" style={{ color: '#8a8a98' }}>探索</a>
        </nav>
      </header>

      <div
        className="fade-in"
        style={{ position: 'sticky', top: 0, zIndex: 5, height: '14vh', minHeight: 96, borderBottom: '1px solid #1b1b26' }}
      >
        <RiverChart series={riverSeries} showReadout={false} currentDate={date} enableIsolate={false} />
        <div style={{ position: 'absolute', left: 14, bottom: 8, fontSize: 11, color: '#c99', pointerEvents: 'none' }}>
          当前 {date} · 扫描或点击切换日期
        </div>
      </div>

      <div className="rise-in" style={{ maxWidth: 860, margin: '0 auto', padding: '40px 28px' }}>
        {/* Kicker */}
        <div style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: '#c99', marginBottom: 8 }}>
          每日解读 · DAILY SLICE
        </div>

        {/* Date headline */}
        <h1
          className="serif"
          style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 800, margin: '0 0 32px', lineHeight: 1.15 }}
        >
          {date}
        </h1>

        {/* Cross-section strip */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: '#8a8a98', marginBottom: 14 }}>
            今日横截面
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {crossSection.entries.map((entry) => (
              <div key={entry.term} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ minWidth: 80, fontSize: 13, color: '#ECE7DD' }}>{entry.term}</span>
                <div style={{ flex: 1, height: 6, background: '#1b1b26', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${(entry.value / maxVal) * 100}%`,
                      background: '#e0436b',
                      borderRadius: 3,
                    }}
                  />
                </div>
                <span style={{ fontSize: 12, color: '#8a8a98', minWidth: 28, textAlign: 'right' }}>{entry.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* §雷达 · 今日相对基线的变化 */}
        <section style={{ marginBottom: 40 }}>
          <div style={SECTION_LABEL}>§ 雷达 · 今日变化</div>
          {radar.length === 0 ? (
            <p style={{ color: '#6b6b78', fontSize: 13 }}>今日无显著雷达变化（相对 90 天基线）。</p>
          ) : (
            <div style={{ border: '1px solid #1b1b26', borderRadius: 6, overflow: 'hidden' }}>
              {radar.map((r, i) => {
                const s = radarStyle(r.type);
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'stretch',
                      borderBottom: i < radar.length - 1 ? '1px solid #1b1b26' : 'none',
                    }}
                  >
                    <div
                      style={{
                        width: 56,
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: '14px 0',
                        background: s.colBg,
                        borderRight: `1px solid ${s.colBorder}`,
                      }}
                    >
                      <span style={{ fontSize: 20, lineHeight: 1, color: s.fg }}>{radarIcon(r.type)}</span>
                      <span style={{ fontSize: 8, color: s.fg, letterSpacing: 0.5, marginTop: 4 }}>{s.short}</span>
                    </div>
                    <div
                      style={{
                        padding: '11px 16px',
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                      }}
                    >
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#ECE7DD', lineHeight: 1.3 }}>
                        {r.target}
                      </span>
                      {r.magnitude != null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                          <div style={{ width: 72, height: 2, background: s.trackBg, borderRadius: 1 }}>
                            <div
                              style={{
                                width: `${(r.magnitude / maxMagnitude) * 100}%`,
                                height: '100%',
                                background: s.fg,
                                borderRadius: 1,
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 10, color: s.fg }}>
                            {Number(r.magnitude).toFixed(1)}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 10, color: '#4a4a5a', marginTop: 3 }}>
                          {radarLabel(r.type)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* §晨报 · Top-3 信号（三层可展开解读） */}
        <section style={{ marginBottom: 40 }}>
          <div style={SECTION_LABEL}>§ 晨报 · 今日信号</div>
          {signals.length === 0 ? (
            <p style={{ color: '#6b6b78', fontSize: 13 }}>本日暂无深度解读（可能尚未分析）。</p>
          ) : (
            signals.map((s, i) => <SignalCard key={i} signal={s} index={i} />)
          )}
        </section>

        {/* §三段式 · 节目单 */}
        <div style={SECTION_LABEL}>§ 三段式 · 节目单</div>
        {/* Items grouped by segment */}
        {items.length === 0 ? (
          <p style={{ color: '#8a8a98', fontSize: 14 }}>暂无节目单数据。</p>
        ) : (
          [...groups.entries()].map(([seg, segItems]) => (
            <section key={seg} style={{ marginBottom: 40 }}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                  color: '#c99',
                  borderBottom: '1px solid #1b1b26',
                  paddingBottom: 6,
                  marginBottom: 16,
                }}
              >
                {SEGMENT_LABEL[seg] ?? seg}
              </div>
              {segItems.map((it) => (
                <article key={it.ord} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                    <span style={{ color: '#8a8a98', fontSize: 12, minWidth: 24 }}>{it.ord}.</span>
                    {it.title ? (
                      <h2 className="serif" style={{ fontSize: 18, fontWeight: 700, margin: 0, lineHeight: 1.4 }}>
                        {it.title}
                      </h2>
                    ) : null}
                  </div>
                  {it.summary ? (
                    <p style={{ color: '#9a9aac', fontSize: 14, lineHeight: 1.7, margin: '8px 0 0 36px' }}>
                      {it.summary}
                    </p>
                  ) : null}
                </article>
              ))}
            </section>
          ))
        )}
      </div>
    </main>
  );
}
