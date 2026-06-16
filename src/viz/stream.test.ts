import { describe, it, expect } from 'vitest';
import { computeStreamPaths } from './stream';

const streams = [
  { term: 'A', color: '#f00', values: [1, 2, 3] },
  { term: 'B', color: '#0f0', values: [3, 2, 1] },
];

describe('computeStreamPaths', () => {
  const paths = computeStreamPaths(streams, { width: 600, height: 200 });
  it('returns one closed path per stream', () => {
    expect(paths).toHaveLength(2);
    for (const p of paths) {
      expect(p.term).toBeDefined();
      expect(p.d).toMatch(/^M /);
      expect(p.d.trim().endsWith('Z')).toBe(true);
      expect(p.color).toBeDefined();
    }
  });
  it('handles a single period without NaN', () => {
    const one = computeStreamPaths([{ term: 'X', color: '#00f', values: [5] }], { width: 100, height: 100 });
    expect(one[0].d).not.toMatch(/NaN/);
  });
  it('handles empty streams gracefully', () => {
    expect(computeStreamPaths([], { width: 100, height: 100 })).toEqual([]);
  });
});
