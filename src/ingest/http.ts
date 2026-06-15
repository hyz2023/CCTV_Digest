export const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

export interface FetchOptions {
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
  maxRetries?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function fetchWithRetry(url: string, opts: FetchOptions = {}): Promise<string> {
  const {
    fetchImpl = fetch,
    headers = {},
    maxRetries = 3,
    baseDelayMs = 500,
    sleep = defaultSleep,
  } = opts;
  const merged = { ...BROWSER_HEADERS, ...headers };

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const r = await fetchImpl(url, { headers: merged });
      if (r.ok) return await r.text();
      if (r.status === 429 || r.status >= 500) {
        lastErr = new Error(`HTTP ${r.status} for ${url}`);
      } else {
        throw new Error(`HTTP ${r.status} for ${url}`); // non-retryable (403/404/...)
      }
    } catch (e) {
      lastErr = e;
      if (e instanceof Error && /^HTTP 4\d\d/.test(e.message) && !/HTTP 429/.test(e.message)) {
        throw e;
      }
    }
    if (attempt < maxRetries) await sleep(baseDelayMs * 2 ** attempt);
  }
  throw lastErr instanceof Error ? lastErr : new Error(`fetch failed: ${url}`);
}
