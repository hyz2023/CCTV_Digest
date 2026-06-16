'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { StreamSeries } from '@/viz/series';
import { computeStreamPaths } from '@/viz/stream';

const SVG_W = 1000;
const SVG_H = 600;
const PAD_X = 16;

interface Props {
  series: StreamSeries;
  // period (YYYY-MM) → 可点的播出日 (YYYY-MM-DD)
  periodDate?: Record<string, string>;
}

export default function RiverChart({ series, periodDate }: Props) {
  const lastIdx = Math.max(0, series.periods.length - 1);
  const [hoverIdx, setHoverIdx] = useState<number>(lastIdx);
  const svgRef = useRef<SVGSVGElement>(null);
  const router = useRouter();

  // 点击某个时间位置 → 带动效进入该月最近一天的每日解读
  const navigateToIdx = useCallback(
    (idx: number) => {
      const date = periodDate?.[series.periods[idx]];
      if (!date) return;
      const go = () => router.push(`/day/${date}`);
      const d = document as Document & { startViewTransition?: (cb: () => void) => void };
      if (typeof d.startViewTransition === 'function') d.startViewTransition(go);
      else go();
    },
    [periodDate, series.periods, router],
  );
  const clickable = !!periodDate && Object.keys(periodDate).length > 0;

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
  const crossSection = series.streams
    .map((st) => ({ term: st.term, color: st.color, value: st.values[hoverIdx] ?? 0 }))
    .sort((a, b) => b.value - a.value);

  const maxValue = Math.max(1, ...crossSection.map((c) => c.value));
  const hoverPeriod = series.periods[hoverIdx] ?? '';

  return (
    <div style={{ position: 'relative', width: '100%', background: 'radial-gradient(ellipse at 50% 40%, #0e1520 0%, #060a10 100%)' }}>
      {/* Main SVG */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        preserveAspectRatio="none"
        style={{ display: 'block', width: '100%', height: 'auto' }}
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
          onMouseLeave={() => setHoverIdx(lastIdx)}
          onClick={clickable ? handleClick : undefined}
          style={{ cursor: clickable ? 'pointer' : 'crosshair' }}
        />
      </svg>

      {/* Readout panel */}
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          background: 'rgba(6,10,16,0.82)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          minWidth: '11rem',
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
        {crossSection.map(({ term, color, value }) => (
          <div key={term} style={{ marginBottom: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
              <span style={{ color }}>{term}</span>
              <span style={{ color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
            </div>
            <div style={{ height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${(value / maxValue) * 100}%`,
                  background: color,
                  borderRadius: '2px',
                  transition: 'width 0.15s ease',
                }}
              />
            </div>
          </div>
        ))}
        {clickable ? (
          <div style={{ marginTop: '0.6rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', color: '#c99', fontSize: '0.7rem' }}>
            点击进入当日解读 →
          </div>
        ) : null}
      </div>
    </div>
  );
}
