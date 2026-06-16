async function hmacHex(secret: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const DAY = 86_400_000;

export async function signSession(secret: string, opts: { ttlMs?: number; now?: number } = {}): Promise<string> {
  const now = opts.now ?? Date.now();
  const exp = now + (opts.ttlMs ?? 7 * DAY);
  return `${exp}.${await hmacHex(secret, String(exp))}`;
}

export async function verifySession(token: string, secret: string, opts: { now?: number } = {}): Promise<boolean> {
  if (!secret) return false;
  const now = opts.now ?? Date.now();
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const expStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < now) return false;
  return timingSafeEqual(sig, await hmacHex(secret, expStr));
}

export function checkPassword(input: string, secret: string): boolean {
  if (!secret) return false;
  return timingSafeEqual(input, secret);
}

export const ADMIN_COOKIE = 'cctv_admin';
