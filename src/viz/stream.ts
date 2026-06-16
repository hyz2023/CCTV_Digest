export interface Stream { term: string; color: string; values: number[] }
export interface StreamPath { term: string; color: string; d: string }
export interface Dims { width: number; height: number; padX?: number }

interface Pt { x: number; y: number }
function curve(points: Pt[], move: boolean): string {
  if (points.length === 0) return '';
  let d = move ? `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}` : `L ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function computeStreamPaths(streams: Stream[], dims: Dims): StreamPath[] {
  if (streams.length === 0) return [];
  const padX = dims.padX ?? 8;
  const n = streams[0].values.length;
  const plotW = dims.width - 2 * padX;
  const xs = Array.from({ length: n }, (_, i) => padX + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1)));
  const totals = Array.from({ length: n }, (_, i) => streams.reduce((s, st) => s + (st.values[i] ?? 0), 0));
  const maxTotal = Math.max(1, ...totals);
  const cy = dims.height * 0.5;
  const scaleY = (dims.height * 0.66) / maxTotal;

  const tops: Pt[][] = streams.map(() => []);
  const bots: Pt[][] = streams.map(() => []);
  for (let i = 0; i < n; i++) {
    let top = cy - (totals[i] * scaleY) / 2;
    streams.forEach((st, si) => {
      tops[si].push({ x: xs[i], y: top });
      top += (st.values[i] ?? 0) * scaleY;
      bots[si].push({ x: xs[i], y: top });
    });
  }
  return streams.map((st, si) => ({
    term: st.term,
    color: st.color,
    d: `${curve(tops[si], true)} ${curve([...bots[si]].reverse(), false)} Z`,
  }));
}
