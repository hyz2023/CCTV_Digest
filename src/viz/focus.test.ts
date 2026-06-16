import { describe, it, expect } from 'vitest';
import { peakIndex, hitStream, flattenedTop, morphTop, morphIsolatedPath } from './focus';
import { computeStreamGeometry, curve } from './stream';

describe('peakIndex', () => {
  it('返回最大值下标（并列取首个）', () => {
    expect(peakIndex([1, 5, 3])).toBe(1);
    expect(peakIndex([4, 4, 2])).toBe(0);
  });
});

describe('hitStream', () => {
  const geom = computeStreamGeometry(
    [{ term: 'A', color: '#f00', values: [1] }, { term: 'B', color: '#0f0', values: [1] }],
    { width: 100, height: 100, padX: 10 },
  );
  it('y 落在某流 top..bot → 该流下标', () => {
    expect(hitStream(geom, 0, (geom.tops[0][0].y + geom.bots[0][0].y) / 2)).toBe(0);
    expect(hitStream(geom, 0, (geom.tops[1][0].y + geom.bots[1][0].y) / 2)).toBe(1);
  });
  it('y 在所有流之外 / idx<0 → -1', () => {
    expect(hitStream(geom, 0, geom.tops[0][0].y - 50)).toBe(-1);
    expect(hitStream(geom, -1, 50)).toBe(-1);
  });
});

describe('flattenedTop', () => {
  it('y = floorY - v/max*usableH（峰值贴顶、0 贴底）', () => {
    const ft = flattenedTop([0, 5, 10], [0, 1, 2], 100, 80);
    expect(ft[0].y).toBeCloseTo(100);
    expect(ft[2].y).toBeCloseTo(20);
    expect(ft[1].y).toBeCloseTo(60);
    expect(ft[1].x).toBe(1);
  });
});

describe('morphTop / morphIsolatedPath', () => {
  const stackedTop = [{ x: 0, y: 10 }, { x: 1, y: 12 }];
  const stackedBot = [{ x: 0, y: 30 }, { x: 1, y: 28 }];
  const flat = [{ x: 0, y: 90 }, { x: 1, y: 70 }];
  it('morphTop：progress 0/1/0.5', () => {
    expect(morphTop(stackedTop, flat, 0)).toEqual(stackedTop);
    expect(morphTop(stackedTop, flat, 1)).toEqual(flat);
    expect(morphTop(stackedTop, flat, 0.5)[0].y).toBeCloseTo(50);
  });
  it('morphIsolatedPath：progress=0 == 原堆叠路径', () => {
    expect(morphIsolatedPath(stackedTop, stackedBot, flat, 100, 0))
      .toBe(`${curve(stackedTop, true)} ${curve([...stackedBot].reverse(), false)} Z`);
  });
  it('morphIsolatedPath：progress=1 == 顶 flat、底 floor', () => {
    const floorBot = stackedBot.map((p) => ({ x: p.x, y: 100 }));
    expect(morphIsolatedPath(stackedTop, stackedBot, flat, 100, 1))
      .toBe(`${curve(flat, true)} ${curve([...floorBot].reverse(), false)} Z`);
  });
});
