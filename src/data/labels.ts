// Display labels for radar event types, signal confidence, and sector polarity.
// Pure lookups with passthrough fallbacks so unknown values never break rendering.

export const RADAR_LABELS: Record<string, { label: string; icon: string }> = {
  new_tifa: { label: '新提法首现', icon: '✦' },
  drumbeat_up: { label: '敲鼓升温', icon: '▲' },
  drumbeat_down: { label: '敲鼓降温', icon: '▼' },
  order_jump: { label: '位置前移', icon: '↑' },
  flip: { label: '口径翻转', icon: '⇅' },
};
export function radarLabel(type: string): string {
  return RADAR_LABELS[type]?.label ?? type;
}
export function radarIcon(type: string): string {
  return RADAR_LABELS[type]?.icon ?? '•';
}

export const CONFIDENCE_LABELS: Record<string, string> = { high: '高', mid: '中', low: '低' };
export const CONFIDENCE_COLORS: Record<string, string> = { high: '#4ade80', mid: '#fbbf24', low: '#8a8a98' };
export function confidenceLabel(c: string): string {
  return CONFIDENCE_LABELS[c] ?? c;
}
export function confidenceColor(c: string): string {
  return CONFIDENCE_COLORS[c] ?? '#8a8a98';
}

export const POLARITY_LABELS: Record<string, { label: string; color: string }> = {
  bull: { label: '利好', color: '#4ade80' },
  bear: { label: '利空', color: '#f87171' },
  neutral: { label: '中性', color: '#9a9aac' },
};
export function polarityLabel(p: string): string {
  return POLARITY_LABELS[p]?.label ?? p;
}
export function polarityColor(p: string): string {
  return POLARITY_LABELS[p]?.color ?? '#9a9aac';
}
