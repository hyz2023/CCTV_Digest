import { fetchWithRetry } from './http';
import { parseGithubMd, parseGovopendata, parseTushare } from './parsers';
import type { ParsedTranscript } from './types';

const ymd = (date: string) => date.replace(/-/g, '');

const MIN_TEXT_LEN = 200;
/** Reject a parsed transcript that is too short to be real (e.g. govopendata's
 *  200-with-error-body for a missing day), so the fallback chain continues. */
export function validateTranscript(t: ParsedTranscript): ParsedTranscript {
  const len = t.text.trim().length;
  if (len < MIN_TEXT_LEN) {
    throw new Error(`transcript too short for ${t.date} from ${t.source} (${len} chars) — likely missing/error page`);
  }
  return t;
}

export async function fromGovopendata(date: string): Promise<ParsedTranscript> {
  const html = await fetchWithRetry(`https://cn.govopendata.com/xinwenlianbo/${ymd(date)}/`);
  return validateTranscript(parseGovopendata(html, date));
}

export async function fromGithub(date: string): Promise<ParsedTranscript> {
  const md = await fetchWithRetry(
    `https://raw.githubusercontent.com/DuckBurnIncense/xin-wen-lian-bo/master/news/${ymd(date)}.md`,
  );
  return validateTranscript(parseGithubMd(md, date));
}

export async function fromTushare(date: string): Promise<ParsedTranscript> {
  const token = process.env.TUSHARE_TOKEN;
  if (!token) throw new Error('TUSHARE_TOKEN not set');
  const raw = await fetchWithRetry('https://api.tushare.pro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_name: 'cctv_news', token, params: { date: ymd(date) }, fields: 'date,title,content' }),
  });
  const json = JSON.parse(raw) as { data?: { items?: unknown[][]; fields?: string[] } };
  const rows = json.data?.items ?? [];
  const fields = json.data?.fields ?? [];
  const ci = fields.indexOf('content');
  // cctv_news may return one row per segment — join all rows into the full transcript.
  const content =
    ci >= 0 ? rows.map((r) => String(r[ci] ?? '').trim()).filter(Boolean).join('\n') : '';
  return validateTranscript(parseTushare({ date: ymd(date), content }, date));
}

export interface SourceDeps {
  govopendata: (date: string) => Promise<ParsedTranscript>;
  tushare: (date: string) => Promise<ParsedTranscript>;
  github: (date: string) => Promise<ParsedTranscript>;
}

const DEFAULT_DEPS: SourceDeps = { govopendata: fromGovopendata, tushare: fromTushare, github: fromGithub };

export async function fetchTranscript(date: string, deps: SourceDeps = DEFAULT_DEPS): Promise<ParsedTranscript> {
  const order: (keyof SourceDeps)[] = ['govopendata', 'tushare', 'github'];
  const errors: string[] = [];
  for (const key of order) {
    try {
      return await deps[key](date);
    } catch (e) {
      errors.push(`${key}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(`all sources failed for ${date} — ${errors.join('; ')}`);
}
