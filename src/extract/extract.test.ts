import { describe, it, expect, vi } from 'vitest';
import { extractTranscript } from './extract';
import type { Extraction } from './schema';

const canned: Extraction = {
  items: [{ ord: 1, segment: 'leader', title: 't', summary: 's' }],
  tifa: [{ term: '新质生产力', count: 2 }],
  sectors: [{ sector: '半导体', polarity: 'bull', strength: 0.7 }],
};

describe('extractTranscript', () => {
  it('returns the model-produced Extraction via injected generate', async () => {
    const generate = vi.fn(async () => canned);
    const out = await extractTranscript('正文', { generate });
    expect(out).toEqual(canned);
    expect(generate).toHaveBeenCalledWith('正文');
  });

  it('throws on an empty/whitespace transcript without calling generate', async () => {
    const generate = vi.fn(async () => canned);
    await expect(extractTranscript('   ', { generate })).rejects.toThrow(/empty/);
    expect(generate).not.toHaveBeenCalled();
  });
});
