'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { StreamSeries } from '@/viz/series';
import { computeStreamPaths } from '@/viz/stream';
import { levelOf, trendOf } from '@/viz/readout';
import type { Level, Trend } from '@/viz/readout';
import { anchorIndex } from '@/viz/anchor';

const SVG_W = 1000;
const SVG_H = 600;
const PAD_X = 16;

const ARROW: Record<Trend, string> = { up: '↑', flat: '→', down: '↓' };
const ARROW_COLOR: Record<Trend, string> = { up: '#4ade80', flat: '#7a8699', down: '#f87171' };
const LEVEL_COLOR: Record<Level, string> = { '强': '#e0436b', '中': '#fbbf24', '弱': '#64748b' };

interface Props {
  series: StreamSeries;
  showReadout?: boolean;
  currentDate?: string;
}

export default function RiverChart({ series, showReadout = true, currentDate }: Props) {
  const lastIdx = Math.max(0, series.periods.length - 1);
  const anchorIdx = anchorIndex(series.periods, currentDate, lastIdx);
  const [hoverIdx, setHoverIdx] = useState<number>(anchorIdx);
  const svgRef = useRef<SVGSVGElement>(null);
  const router = useRouter();

  // periods 现在是真实日期（YYYY-MM-DD）→ 点击直接进当天
  const navigateToIdx = useCallback(
    (idx: number) => {
      const date = series.periods[idx];
      if (!date) return;
      const go = () => router.push(`/day/${date}`);
      const d = document as Document & { startViewTransition?: (cb: () => void) => void };
      if (typeof d.startViewTransition === 'function') d.startViewTransition(go);
      else go();
    },
    [series.periods, router],
  );
  const clickable = series.periods.length > 0;

  const paths = computeStreamPaths(series.streams, { width: SVG_W, height: SVG_H, padX: PAD_X });

  const n = series.periods.length;
  const plotW = SVG_W - 2 * PAD_X;

  // Map clientX → nearest period index
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      if (!svgRef.current || n === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width; // 0..1
      const svgX = relX * SVG_W;
      const frac = (svgX - PAD_X) / (plotW || 1);
      const idx = Math.round(Math.max(0, Math.min(1, frac)) * (n - 1));
      setHoverIdx(idx);
    },
    [n, plotW],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      if (!svgRef.current || n === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const frac = (relX * SVG_W - PAD_X) / (plotW || 1);
      const idx = Math.round(Math.max(0, Math.min(1, frac)) * (n - 1));
      navigateToIdx(idx);
    },
    [n, plotW, navigateToIdx],
  );

  // Scrubber X position in SVG coords
  const scrubberX =
    n <= 1
      ? PAD_X + plotW / 2
      : PAD_X + (plotW * hoverIdx) / (n - 1);

  // Cross-section data for the readout panel
  const dayMax = Math.max(1, ...series.streams.map((st) => st.values[hoverIdx] ?? 0));
  const crossSection = series.streams
    .map((st) => {
      const value = st.values[hoverIdx] ?? 0;
      return {
        term: st.term,
        color: st.color,
        value,
        level: levelOf(value, dayMax),
        trend: trendOf(st.values, hoverIdx, { dayMax }),
      };
    })
    .sort((a, b) => b.value - a.value);

  const hoverPeriod = series.periods[hoverIdx] ?? '';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', viewTransitionName: 'river-stream', background: 'radial-gradient(ellipse at 50% 40%, #0e1520 0%, #060a10 100%)' }}>
      {/* Main SVG */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        preserveAspectRatio="none"
        style={{ display: 'block', width: '100%', height: '100%' }}
        aria-label="Keyword stream chart"
      >
        {/* Stream paths */}
        {paths.map((p) => (
          <path
            key={p.term}
            d={p.d}
            fill={p.color}
            fillOpacity={0.88}
            stroke="none"
          />
        ))}

        {/* Scrubber line */}
        <line
          x1={scrubberX}
          y1={0}
          x2={scrubberX}
          y2={SVG_H}
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          pointerEvents="none"
        />

        {/* Invisible overlay rect to capture mouse events */}
        <rect
          x={0}
          y={0}
          width={SVG_W}
          height={SVG_H}
          fill="transparent"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(anchorIdx)}
          onClick={clickable ? handleClick : undefined}
          style={{ cursor: clickable ? 'pointer' : 'crosshair' }}
        />
      </svg>

      {/* Scrubber 日期标签（条形态：跟随扫描位置显示当前/目标日期） */}
      {!showReadout && hoverPeriod && (
        <div
          style={{
            position: 'absolute',
            left: `${(scrubberX / SVG_W) * 100}%`,
            top: 6,
            transform: 'translateX(-50%)',
            background: 'rgba(6,10,16,0.85)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 6,
            padding: '2px 8px',
            fontSize: 11,
            color: '#ECEAE3',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {hoverPeriod}
        </div>
      )}

      {/* Readout panel */}
      {showReadout && (
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          background: 'rgba(6,10,16,0.82)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          minWidth: '13rem',
          backdropFilter: 'blur(6px)',
          color: '#e2e8f0',
          fontSize: '0.78rem',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <div style={{ fontWeight: 700, letterSpacing: '0.06em', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.7rem' }}>
          {hoverPeriod}
        </div>
        {crossSection.map(({ term, color, value, level, trend }) => (
          <div key={term} style={{ marginBottom: '0.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 16px 30px', alignItems: 'center', columnGap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{term}</span>
              <span style={{ textAlign: 'center', fontWeight: 700, color: ARROW_COLOR[trend] }}>{ARROW[trend]}</span>
              <span style={{ textAlign: 'center', fontSize: '0.62rem', borderRadius: '4px', padding: '1px 0', color: LEVEL_COLOR[level], border: `1px solid ${LEVEL_COLOR[level]}55` }}>{level}</span>
            </div>
            <div style={{ height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(value / dayMax) * 100}%`, background: color, borderRadius: '2px', transition: 'width 0.15s ease' }} />
            </div>
          </div>
        ))}
        {clickable ? (
          <div style={{ marginTop: '0.6rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', color: '#c99', fontSize: '0.7rem' }}>
            点击进入当日解读 →
          </div>
        ) : null}
      </div>
      )}
    </div>
  );
}
