// Stable, deterministic colors for streams (assigned by sorted key order).
export const STREAM_COLORS = [
  '#ff8a3d', '#2bb6c8', '#e0436b', '#8a7bff', '#38c172', '#ff6fae',
  '#ffce7a', '#7be3f0', '#ff8fa8', '#c3b8ff',
];
export function colorFor(index: number): string {
  return STREAM_COLORS[index % STREAM_COLORS.length];
}
