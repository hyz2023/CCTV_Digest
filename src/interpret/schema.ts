import { z } from 'zod';

export const CONFIDENCE = ['high', 'mid', 'low'] as const;
const POLARITY = ['bull', 'bear', 'neutral'] as const;

// DeepSeek in json_object mode (no server-side enforcement) drifts on key names:
// sectors come back as `name`/`direction` instead of `sector`/`polarity`, and a
// signal often folds its one-line headline into `theme` and omits `title`. These
// preprocessors normalize that drift before validation; the canonical output
// shape is unchanged so persist.ts (topSignals) is unaffected.
function deriveTitle(o: Record<string, unknown>): string {
  if (typeof o.title === 'string' && o.title.trim()) return o.title.trim();
  const theme = typeof o.theme === 'string' ? o.theme : '';
  const head = (theme.split(/[。；;\n]/)[0] ?? '').trim();
  return head.slice(0, 40) || '信号';
}

const SectorSignalSchema = z.preprocess(
  (v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = { ...(v as Record<string, unknown>) };
      if (!('sector' in o) && typeof o.name === 'string') o.sector = o.name;
      if (!('polarity' in o) && typeof o.direction === 'string') o.polarity = o.direction;
      return o;
    }
    return v;
  },
  z.object({
    sector: z.string().min(1),
    polarity: z.enum(POLARITY).catch('neutral'),
  }),
);

const SignalSchema = z.preprocess(
  (v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = { ...(v as Record<string, unknown>) };
      o.title = deriveTitle(o);
      if (!Array.isArray(o.sectors)) o.sectors = [];
      if (!Array.isArray(o.tickers)) o.tickers = [];
      else o.tickers = (o.tickers as unknown[]).filter((t) => typeof t === 'string');
      if (typeof o.thread !== 'string') o.thread = '';
      if (typeof o.fromRadar !== 'boolean') o.fromRadar = false;
      return o;
    }
    return v;
  },
  z.object({
    title: z.string().min(1).describe('one-line signal headline (Chinese)'),
    theme: z.string().min(1).describe('政策主题层：它意味着什么政策方向'),
    confidence: z.enum(CONFIDENCE).catch('mid'),
    sectors: z.array(SectorSignalSchema).describe('受影响行业/板块'),
    tickers: z.array(z.string()).describe('示例标的（线索，非建议；可空，宁缺毋滥）'),
    thread: z.string().describe('所属主线名（自由文本，P5 会归一）'),
    fromRadar: z.boolean().describe('该信号是否由今日雷达变化驱动'),
  }),
);

export const DeepInterpretationSchema = z.object({
  // Cap to the top 3 signals; tolerate a model that returns more.
  signals: z.preprocess(
    (v) => (Array.isArray(v) ? v.slice(0, 3) : v),
    z.array(SignalSchema).min(1),
  ).describe('今日最重要的最多 3 个信号'),
});
export type DeepInterpretation = z.infer<typeof DeepInterpretationSchema>;
