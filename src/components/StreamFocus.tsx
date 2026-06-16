'use client';
import { curve, type Pt } from '@/viz/stream';
import { flattenedTop, morphTop, morphIsolatedPath, peakIndex } from '@/viz/focus';

const SVG_W = 1000, SVG_H = 600, PAD_X = 16, PAD_Y = 30;
const FLOOR = SVG_H - PAD_Y, USABLE = SVG_H - 2 * PAD_Y;

interface Props {
  term: string; color: string; values: number[];
  stackedTop: Pt[]; stackedBot: Pt[]; xs: number[];
  periods: string[]; progress: number; hoverIdx: number;
}

export default function StreamFocus({ term, color, values, stackedTop, stackedBot, xs, periods, progress, hoverIdx }: Props) {
  const flat = flattenedTop(values, xs, FLOOR, USABLE);
  const area = morphIsolatedPath(stackedTop, stackedBot, flat, FLOOR, progress);
  const topLine = curve(morphTop(stackedTop, flat, progress), true);
  const pk = peakIndex(values);
  const hi = Math.max(0, Math.min(values.length - 1, hoverIdx));
  const maxV = Math.max(1, ...values);
  const lerpY = (a: number, b: number) => a + (b - a) * progress;
  const px = (x: number) => `${(x / SVG_W) * 100}%`;
  const py = (y: number) => `${(y / SVG_H) * 100}%`;
  const peakY = lerpY(stackedTop[pk].y, flat[pk].y);
  const todayY = lerpY(stackedTop[hi].y, flat[hi].y);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: Math.min(1, progress * 1.25) }}>
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="sf-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.85" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#sf-grad)" stroke="none" />
        <path d={topLine} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <line x1={PAD_X} y1={FLOOR} x2={SVG_W - PAD_X} y2={FLOOR} stroke="rgba(255,255,255,0.18)" strokeDasharray="2 5" vectorEffect="non-scaling-stroke" />
        <line x1={PAD_X} y1={FLOOR - USABLE} x2={SVG_W - PAD_X} y2={FLOOR - USABLE} stroke="rgba(255,255,255,0.10)" strokeDasharray="2 5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="serif" style={{ position: 'absolute', left: 16, top: 10, fontWeight: 800, fontSize: 15, color: '#ECEAE3' }}>{term}</div>
      <div style={{ position: 'absolute', left: px(xs[pk]), top: py(peakY), width: 9, height: 9, margin: '-5px 0 0 -5px', borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 2px rgba(0,0,0,.35)' }} />
      <div style={{ position: 'absolute', left: px(xs[hi]), top: py(todayY), width: 9, height: 9, margin: '-5px 0 0 -5px', borderRadius: '50%', background: color, border: '2px solid #fff' }} />
      <div style={{ position: 'absolute', left: px(xs[hi]), top: py(todayY), transform: 'translate(-50%,-150%)', fontSize: 10, color: '#cbd5e1', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{periods[hi] ?? ''}</div>
      <div style={{ position: 'absolute', right: 10, top: py(FLOOR - USABLE), marginTop: -7, fontSize: 10, color: '#9fb0c0', fontVariantNumeric: 'tabular-nums' }}>{Math.round(maxV)}</div>
      <div style={{ position: 'absolute', right: 10, top: py(FLOOR), marginTop: -15, fontSize: 10, color: '#9fb0c0' }}>0</div>
    </div>
  );
}
