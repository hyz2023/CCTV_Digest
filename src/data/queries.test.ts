import { describe, it, expect } from 'vitest';
import { mentionsOrSample, sectorsOrSample } from './queries';
import { SAMPLE_MENTIONS, SAMPLE_SECTORS } from '@/viz/sample';

describe('mentionsOrSample', () => {
  it('returns DB rows when present', () => {
    const rows = [{ day: '2026-01-01', term: 'X', count: 1 }];
    expect(mentionsOrSample(rows)).toBe(rows);
  });
  it('falls back to sample when DB is empty', () => {
    expect(mentionsOrSample([])).toBe(SAMPLE_MENTIONS);
  });
});
describe('sectorsOrSample', () => {
  it('falls back to sample when empty', () => {
    expect(sectorsOrSample([])).toBe(SAMPLE_SECTORS);
  });
});
