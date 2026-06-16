import { z } from 'zod';

export const CONFIDENCE = ['high', 'mid', 'low'] as const;

export const DeepInterpretationSchema = z.object({
  signals: z.array(z.object({
    title: z.string().min(1).describe('one-line signal headline (Chinese)'),
    theme: z.string().min(1).describe('政策主题层：它意味着什么政策方向'),
    confidence: z.enum(CONFIDENCE),
    sectors: z.array(z.object({
      sector: z.string().min(1),
      polarity: z.enum(['bull', 'bear', 'neutral']),
    })).describe('受影响行业/板块'),
    tickers: z.array(z.string()).describe('示例标的（线索，非建议；可空，宁缺毋滥）'),
    thread: z.string().describe('所属主线名（自由文本，P5 会归一）'),
    fromRadar: z.boolean().describe('该信号是否由今日雷达变化驱动'),
  })).min(1).max(3).describe('今日最重要的最多 3 个信号'),
});
export type DeepInterpretation = z.infer<typeof DeepInterpretationSchema>;
