import { describe, it, expect } from 'vitest';
import { detectRadar, detectOrderJumps, detectSectorFlips, detectAllRadar } from './detect';

type M = { day: string; term: string; count: number };
function days(term: string, entries: [string, number][]): M[] {
  return entries.map(([day, count]) => ({ day, term, count }));
}

describe('detectRadar', () => {
  it('flags a brand-new 提法 (first ever appearance on the target day)', () => {
    const mentions: M[] = [
      ...days('老词', [['2026-03-01', 2], ['2026-05-30', 2]]),
      { day: '2026-06-01', term: '新词', count: 3 },
    ];
    const ev = detectRadar('2026-06-01', mentions);
    const nt = ev.find((e) => e.type === 'new_tifa' && e.target === '新词');
    expect(nt).toBeTruthy();
    expect(nt!.magnitude).toBe(3);
  });

  it('flags drumbeat_up when recent frequency far exceeds the baseline', () => {
    const mentions: M[] = [
      ...days('热词', [
        ['2026-01-10', 1], ['2026-02-10', 1],
        ['2026-05-25', 3], ['2026-05-30', 4], ['2026-06-01', 5],
      ]),
    ];
    const ev = detectRadar('2026-06-01', mentions);
    expect(ev.some((e) => e.type === 'drumbeat_up' && e.target === '热词')).toBe(true);
  });

  it('flags drumbeat_down when a previously-hot term goes quiet recently', () => {
    const mentions: M[] = [
      ...days('降温词', [['2026-03-05', 6], ['2026-03-20', 6], ['2026-04-05', 6]]),
    ];
    const ev = detectRadar('2026-06-01', mentions);
    expect(ev.some((e) => e.type === 'drumbeat_down' && e.target === '降温词')).toBe(true);
  });

  it('does not flag a steady term', () => {
    const mentions: M[] = days('稳定词',
      Array.from({ length: 10 }, (_, i) => [`2026-0${1 + Math.floor(i / 3)}-${10 + (i % 3)}`, 2] as [string, number]));
    const ev = detectRadar('2026-06-01', mentions);
    expect(ev.some((e) => e.target === '稳定词')).toBe(false);
  });

  it('stamps every event with the target day', () => {
    const ev = detectRadar('2026-06-01', [{ day: '2026-06-01', term: 'x', count: 9 }]);
    expect(ev.every((e) => e.day === '2026-06-01')).toBe(true);
  });
});

describe('detectOrderJumps', () => {
  type I = { day: string; ord: number; title: string; summary: string };
  it('flags a topic that jumped markedly earlier in the rundown', () => {
    const items: I[] = [
      { day: '2026-05-10', ord: 8, title: '其他', summary: '正文提到 新词A 的内容' },
      { day: '2026-05-20', ord: 9, title: '其他', summary: '又见 新词A' },
      { day: '2026-06-01', ord: 1, title: '新词A 成头条', summary: '头条强调 新词A' },
      { day: '2026-06-01', ord: 5, title: '别的', summary: '无关' },
    ];
    const mentions = [
      { day: '2026-05-10', term: '新词A', count: 1 }, { day: '2026-05-20', term: '新词A', count: 1 }, { day: '2026-06-01', term: '新词A', count: 1 },
    ];
    const ev = detectOrderJumps('2026-06-01', items, mentions);
    expect(ev.some((e) => e.type === 'order_jump' && e.target === '新词A')).toBe(true);
  });
  it('does not flag a topic at a stable position', () => {
    const items: I[] = [
      { day: '2026-05-10', ord: 3, title: '稳定 稳词', summary: '稳词' },
      { day: '2026-05-20', ord: 3, title: '稳定 稳词', summary: '稳词' },
      { day: '2026-06-01', ord: 3, title: '稳定 稳词', summary: '稳词' },
    ];
    const mentions = [
      { day: '2026-05-10', term: '稳词', count: 1 }, { day: '2026-05-20', term: '稳词', count: 1 }, { day: '2026-06-01', term: '稳词', count: 1 },
    ];
    expect(detectOrderJumps('2026-06-01', items, mentions).some((e) => e.target === '稳词')).toBe(false);
  });
});

describe('detectSectorFlips', () => {
  it('flags a sector whose dominant polarity flips bear → bull', () => {
    const sigs = [
      { day: '2026-04-01', sector: '地产', polarity: 'bear' },
      { day: '2026-04-20', sector: '地产', polarity: 'bear' },
      { day: '2026-06-01', sector: '地产', polarity: 'bull' },
    ];
    expect(detectSectorFlips('2026-06-01', sigs).find((e) => e.type === 'flip' && e.target === '地产')).toBeTruthy();
  });
  it('does not flag a sector with stable polarity', () => {
    const sigs = [
      { day: '2026-04-01', sector: '科技', polarity: 'bull' },
      { day: '2026-06-01', sector: '科技', polarity: 'bull' },
    ];
    expect(detectSectorFlips('2026-06-01', sigs).some((e) => e.target === '科技')).toBe(false);
  });
});

describe('detectAllRadar', () => {
  it('merges new_tifa/drumbeat + order_jump + flip, all stamped with the day', () => {
    const ev = detectAllRadar({
      target: '2026-06-01',
      mentions: [{ day: '2026-06-01', term: '全新词', count: 4 }],
      items: [{ day: '2026-06-01', ord: 1, title: '全新词', summary: '全新词' }],
      sectorSignals: [],
    });
    expect(ev.every((e) => e.day === '2026-06-01')).toBe(true);
    expect(ev.some((e) => e.type === 'new_tifa')).toBe(true);
  });
});
