import { describe, it, expect } from 'vitest';
import { detectRadar } from './detect';

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
