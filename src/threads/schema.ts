import { z } from 'zod';
export const THREAD_STATUS = ['active', 'merged', 'split', 'faded'] as const;

// DeepSeek json_object drift: normalize key aliases (terms→memberTerms,
// description→read), soft-default an out-of-range status, drop empty member
// terms, and — since this is a single whole-corpus call — DROP individual
// malformed threads rather than failing the entire synthesis. Output shape is
// unchanged so rows.ts is unaffected.
const ThreadSchema = z.preprocess(
  (v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = { ...(v as Record<string, unknown>) };
      if (!Array.isArray(o.memberTerms)) {
        if (Array.isArray(o.terms)) o.memberTerms = o.terms;
        else if (Array.isArray(o.members)) o.memberTerms = o.members;
      }
      if (Array.isArray(o.memberTerms)) {
        o.memberTerms = (o.memberTerms as unknown[]).filter((t) => typeof t === 'string' && t.trim());
      }
      if (typeof o.read !== 'string') {
        if (typeof o.interpretation === 'string') o.read = o.interpretation;
        else if (typeof o.description === 'string') o.read = o.description;
        else if (typeof o.summary === 'string') o.read = o.summary;
      }
      return o;
    }
    return v;
  },
  z.object({
    name: z.string().min(1).describe('主线名，如 新质生产力·科技自立'),
    status: z.enum(THREAD_STATUS).catch('active'),
    memberTerms: z.array(z.string().min(1)).min(1).describe('归属该主线的提法（来自输入的词）'),
    read: z.string().min(1).describe('当下解读：这条主线眼下在表达什么'),
  }),
);

export const ThreadSetSchema = z.object({
  threads: z
    .preprocess(
      (v) => (Array.isArray(v) ? v : []),
      z.array(z.unknown()).transform((arr) => {
        const out: z.infer<typeof ThreadSchema>[] = [];
        for (const x of arr) {
          const r = ThreadSchema.safeParse(x);
          if (r.success) out.push(r.data);
        }
        return out;
      }),
    )
    .describe('客观存在的主线集合；数量由数据决定，宁缺毋滥'),
});
export type ThreadSet = z.infer<typeof ThreadSetSchema>;
