import { z } from 'zod';

export const SEGMENTS = ['leader', 'dev', 'intl'] as const; // 领导动态 / 发展·民生 / 国际
export const POLARITIES = ['bull', 'bear', 'neutral'] as const; // 利好 / 利空 / 中性

// DeepSeek in json_object mode (no server-side schema enforcement) sometimes
// labels the key `name` instead of the schema's `term`/`sector`, and now and
// then returns numbers as strings. These helpers normalize that drift before
// validation. The canonical output shape is unchanged, so downstream consumers
// (rows.ts and beyond) are unaffected.
function aliasName(target: 'term' | 'sector') {
  return (v: unknown): unknown => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      if (!(target in o) && typeof o.name === 'string') return { ...o, [target]: o.name };
    }
    return v;
  };
}

const ItemSchema = z.object({
  ord: z.coerce.number().int().min(1).describe('1-based order in the broadcast rundown'),
  segment: z.enum(SEGMENTS),
  title: z.string().min(1),
  summary: z.string().min(1).describe('1-2 sentence Chinese summary'),
});

const TifaSchema = z.preprocess(
  aliasName('term'),
  z.object({
    term: z.string().min(1).describe('normalized 提法/keyword, e.g. 新质生产力'),
    count: z.coerce.number().int().min(1),
  }),
);

const SectorSchema = z.preprocess(
  aliasName('sector'),
  z.object({
    sector: z.string().min(1).describe('affected industry, e.g. 半导体'),
    polarity: z.enum(POLARITIES),
    strength: z
      .coerce.number()
      .min(0)
      .max(1)
      .describe('signal strength: 0 = negligible, 0.5 = moderate, 1 = dominant/unambiguous'),
  }),
);

export const ExtractionSchema = z.object({
  items: z.array(ItemSchema).min(1).describe('every broadcast has at least one item'),
  tifa: z.array(TifaSchema),
  sectors: z.array(SectorSchema),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
export type Segment = (typeof SEGMENTS)[number];
