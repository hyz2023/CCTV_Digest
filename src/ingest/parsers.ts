import type { ParsedTranscript } from './types';

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(p|div|h[1-6]|li|br)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// govopendata injects this placeholder as a section heading for unavailable
// articles, even inside an otherwise-real page — keep it out of `items`.
function isErrorArtifact(s: string): boolean {
  return /对不起|无此页面|请稍后/.test(s);
}

export function parseGithubMd(md: string, date: string): ParsedTranscript {
  const items: string[] = [];
  for (const line of md.split('\n')) {
    const h = line.match(/^###\s+(.+?)\s*$/);
    if (h) items.push(h[1].trim());
  }
  const text = stripHtml(md.replace(/^#{1,6}\s+/gm, ''))
    .replace(/\[查看原文\]\([^)]*\)/g, '')
    .trim();
  return { date, source: 'github', text, items };
}

export function parseTushare(
  row: { date?: string; title?: string; content?: string },
  date: string,
): ParsedTranscript {
  const content = (row.content ?? '').trim();
  const items = content
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { date, source: 'tushare', text: content, items };
}

export function parseGovopendata(html: string, date: string): ParsedTranscript {
  const items: string[] = [];
  // Extract only content-heading h2 elements (real site structure)
  const contentHeadingRe = /<h2[^>]*class="content-heading"[^>]*>([\s\S]*?)<\/h2>/gi;
  let m: RegExpExecArray | null;
  while ((m = contentHeadingRe.exec(html))) {
    const t = stripHtml(m[1]).trim();
    if (t && !/新闻联播\s*$/.test(t) && !isErrorArtifact(t)) items.push(t);
  }
  // Fall back to any h2/h3 if no content-heading found (representative fixture)
  if (items.length === 0) {
    const headingRe = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
    while ((m = headingRe.exec(html))) {
      const t = stripHtml(m[1]).trim();
      if (t && !/新闻联播\s*$/.test(t) && !isErrorArtifact(t)) items.push(t);
    }
  }
  const text = stripHtml(html);
  return { date, source: 'govopendata', text, items };
}
