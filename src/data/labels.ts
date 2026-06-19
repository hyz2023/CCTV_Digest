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

interface RadarTypeStyle {
  fg: string;
  colBg: string;
  colBorder: string;
  trackBg: string;
  short: string;
}

const RADAR_STYLE: Record<string, RadarTypeStyle> = {
  new_tifa:      { fg: '#f5c842', colBg: '#141108', colBorder: '#1e1a08', trackBg: '#1e1a08', short: '首现' },
  drumbeat_up:   { fg: '#4ade80', colBg: '#0b1a10', colBorder: '#0e2018', trackBg: '#1a2e1a', short: '升温' },
  drumbeat_down: { fg: '#f87171', colBg: '#180b0b', colBorder: '#200e0e', trackBg: '#2e1a1a', short: '降温' },
  order_jump:    { fg: '#38bdf8', colBg: '#081520', colBorder: '#0a1e2e', trackBg: '#0a1e2e', short: '前移' },
  flip:          { fg: '#c084fc', colBg: '#130a1c', colBorder: '#180e22', trackBg: '#180e22', short: '翻转' },
};

const RADAR_STYLE_DEFAULT: RadarTypeStyle = {
  fg: '#8a8a98', colBg: '#0d0d16', colBorder: '#1b1b26', trackBg: '#1b1b26', short: '变化',
};

export function radarStyle(type: string): RadarTypeStyle {
  return RADAR_STYLE[type] ?? RADAR_STYLE_DEFAULT;
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
