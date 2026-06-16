import { curve, type Pt, type StreamGeometry } from './stream';

export function peakIndex(values: number[]): number {
  let pi = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[pi]) pi = i;
  return pi;
}

export function hitStream(geom: StreamGeometry, idx: number, y: number): number {
  if (idx < 0) return -1;
  for (let s = 0; s < geom.tops.length; s++) {
    const top = geom.tops[s][idx]?.y, bot = geom.bots[s][idx]?.y;
    if (top == null || bot == null) continue;
    if (y >= top && y <= bot) return s;
  }
  return -1;
}

export function flattenedTop(values: number[], xs: number[], floorY: number, usableH: number): Pt[] {
  const mx = Math.max(1, ...values);
  return values.map((v, i) => ({ x: xs[i], y: floorY - (v / mx) * usableH }));
}

export function morphTop(stackedTop: Pt[], flatTop: Pt[], progress: number): Pt[] {
  return stackedTop.map((p, i) => ({ x: p.x, y: p.y + (flatTop[i].y - p.y) * progress }));
}

export function morphIsolatedPath(stackedTop: Pt[], stackedBot: Pt[], flatTop: Pt[], floorY: number, progress: number): string {
  const top = morphTop(stackedTop, flatTop, progress);
  const bot = stackedBot.map((p) => ({ x: p.x, y: p.y + (floorY - p.y) * progress }));
  return `${curve(top, true)} ${curve([...bot].reverse(), false)} Z`;
}
