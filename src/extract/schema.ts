import { z } from 'zod';

export const SEGMENTS = ['leader', 'dev', 'intl'] as const; // 领导动态 / 发展·民生 / 国际
export const POLARITIES = ['bull', 'bear', 'neutral'] as const; // 利好 / 利空 / 中性

export const ExtractionSchema = z.object({
  items: z.array(z.object({
    ord: z.number().int().describe('1-based order in the broadcast rundown'),
    segment: z.enum(SEGMENTS),
    title: z.string(),
    summary: z.string().describe('1-2 sentence Chinese summary'),
  })),
  tifa: z.array(z.object({
    term: z.string().describe('normalized 提法/keyword, e.g. 新质生产力'),
    count: z.number().int().min(1),
  })),
  sectors: z.array(z.object({
    sector: z.string().describe('affected industry, e.g. 半导体'),
    polarity: z.enum(POLARITIES),
    strength: z.number().min(0).max(1),
  })),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
export type Segment = (typeof SEGMENTS)[number];
