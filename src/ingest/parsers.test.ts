import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseGithubMd, parseTushare, parseGovopendata } from './parsers';

const fx = (name: string) => readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

describe('parseGithubMd', () => {
  const t = parseGithubMd(fx('github-20260613.md'), '2026-06-13');
  it('sets date and source', () => {
    expect(t.date).toBe('2026-06-13');
    expect(t.source).toBe('github');
  });
  it('extracts non-trivial body text', () => {
    expect(t.text.length).toBeGreaterThan(50);
    expect(t.text).toContain('新闻联播');
  });
  it('extracts a non-empty list of headline items', () => {
    expect(t.items.length).toBeGreaterThan(0);
  });
});

describe('parseTushare', () => {
  const t = parseTushare(JSON.parse(fx('tushare-20260613.json')), '2026-06-13');
  it('uses content as text and tags source', () => {
    expect(t.source).toBe('tushare');
    expect(t.text).toContain('海峡论坛');
    expect(t.date).toBe('2026-06-13');
  });
});

describe('parseGovopendata', () => {
  const t = parseGovopendata(fx('govopendata-20260613.html'), '2026-06-13');
  it('strips HTML to text and tags source', () => {
    expect(t.source).toBe('govopendata');
    expect(t.text).not.toContain('<p>');
    expect(t.text.length).toBeGreaterThan(20);
  });
});
