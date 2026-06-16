import { describe, it, expect } from 'vitest';
import { computeStreamPaths, computeStreamGeometry } from './stream';

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

describe('computeStreamGeometry', () => {
  const streams = [
    { term: 'A', color: '#f00', values: [1, 3] },
    { term: 'B', color: '#0f0', values: [2, 1] },
  ];
  const geom = computeStreamGeometry(streams, { width: 100, height: 100, padX: 10 });
  it('每条流有 top/bot 边点、x 对齐', () => {
    expect(geom.tops).toHaveLength(2);
    expect(geom.tops[0]).toHaveLength(2);
    expect(geom.xs[0]).toBe(10);
    expect(geom.xs[1]).toBe(90);
  });
  it('堆叠：A 的 bot == B 的 top（同一列相接）', () => {
    expect(geom.bots[0][0].y).toBeCloseTo(geom.tops[1][0].y);
    expect(geom.bots[0][1].y).toBeCloseTo(geom.tops[1][1].y);
  });
  it('某列带高 ∝ 值（A 第1列高 = 1*scaleY）', () => {
    expect(geom.bots[0][0].y - geom.tops[0][0].y).toBeCloseTo(1 * geom.scaleY);
  });
});
