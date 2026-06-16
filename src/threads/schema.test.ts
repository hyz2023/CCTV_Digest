import { describe, it, expect } from 'vitest';
import { ThreadSetSchema } from './schema';

describe('ThreadSetSchema — json_object drift tolerance', () => {
  it('accepts the canonical shape unchanged', () => {
    const r = ThreadSetSchema.safeParse({
      threads: [{ name: '科技', status: 'active', memberTerms: ['新质生产力'], read: 'r' }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.threads.length).toBe(1);
  });

  it('aliases terms→memberTerms, filters empty terms, soft-defaults bad status', () => {
    const r = ThreadSetSchema.safeParse({
      threads: [{ name: '科技', status: '进行中', terms: ['新质生产力', ''], read: 'r' }],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.threads[0].memberTerms).toEqual(['新质生产力']);
      expect(r.data.threads[0].status).toBe('active');
    }
  });

  it('drops a malformed thread instead of failing the whole set', () => {
    const r = ThreadSetSchema.safeParse({
      threads: [
        { name: '好主线', status: 'active', memberTerms: ['x'], read: 'r' },
        { name: '坏主线', status: 'active', memberTerms: [], read: 'r' },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.threads.length).toBe(1);
      expect(r.data.threads[0].name).toBe('好主线');
    }
  });
});
