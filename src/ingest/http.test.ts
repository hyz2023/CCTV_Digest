import { describe, it, expect, vi } from 'vitest';
import { fetchWithRetry, BROWSER_HEADERS } from './http';

function res(status: number, body = 'ok'): Response {
  return new Response(body, { status });
}
const noSleep = async () => {};

describe('fetchWithRetry', () => {
  it('returns body text and sends browser headers on success', async () => {
    const fetchImpl = vi.fn(async () => res(200, 'hello'));
    const out = await fetchWithRetry('https://x/', { fetchImpl: fetchImpl as typeof fetch, sleep: noSleep });
    expect(out).toBe('hello');
    const sentHeaders = ((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]).headers as Record<string, string>;
    expect(sentHeaders['User-Agent']).toBe(BROWSER_HEADERS['User-Agent']);
    expect(sentHeaders['Accept-Language']).toContain('zh');
  });

  it('retries on 503 then succeeds', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(200, 'recovered'));
    const out = await fetchWithRetry('https://x/', { fetchImpl, sleep: noSleep, maxRetries: 3 });
    expect(out).toBe('recovered');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry a 403 (bot block) — throws immediately', async () => {
    const fetchImpl = vi.fn(async () => res(403));
    await expect(fetchWithRetry('https://x/', { fetchImpl, sleep: noSleep })).rejects.toThrow(/403/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting retries on persistent 500', async () => {
    const fetchImpl = vi.fn(async () => res(500));
    await expect(fetchWithRetry('https://x/', { fetchImpl, sleep: noSleep, maxRetries: 2 }))
      .rejects.toThrow(/500/);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('backs off with increasing delays', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(res(500))
      .mockResolvedValueOnce(res(500))
      .mockResolvedValueOnce(res(200, 'ok'));
    const sleeps: number[] = [];
    const sleep = async (ms: number) => { sleeps.push(ms); };
    await fetchWithRetry('https://x/', { fetchImpl, sleep, maxRetries: 3, baseDelayMs: 100 });
    expect(sleeps).toEqual([100, 200]);
  });

  it('passes method and body to fetchImpl for POST requests', async () => {
    const fetchImpl = vi.fn(async () => res(200, 'posted'));
    const out = await fetchWithRetry('https://x/', {
      fetchImpl: fetchImpl as typeof fetch,
      sleep: noSleep,
      method: 'POST',
      body: '{"a":1}',
    });
    expect(out).toBe('posted');
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
  });
});
