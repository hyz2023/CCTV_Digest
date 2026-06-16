import { z } from 'zod';
export const THREAD_STATUS = ['active', 'merged', 'split', 'faded'] as const;
export const ThreadSetSchema = z.object({
  threads: z.array(z.object({
    name: z.string().min(1).describe('主线名，如 新质生产力·科技自立'),
    status: z.enum(THREAD_STATUS),
    memberTerms: z.array(z.string().min(1)).min(1).describe('归属该主线的提法（来自输入的词）'),
    read: z.string().min(1).describe('当下解读：这条主线眼下在表达什么'),
  })).describe('客观存在的主线集合；数量由数据决定，宁缺毋滥'),
});
export type ThreadSet = z.infer<typeof ThreadSetSchema>;
