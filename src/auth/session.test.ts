import { describe, it, expect } from 'vitest';
import { signSession, verifySession, checkPassword } from './session';

const SECRET = 'top-secret-value';
const NOW = 1_750_000_000_000;

describe('session signing', () => {
  it('a freshly-signed token verifies', async () => {
    const token = await signSession(SECRET, { ttlMs: 1000, now: NOW });
    expect(await verifySession(token, SECRET, { now: NOW + 500 })).toBe(true);
  });
  it('rejects an expired token', async () => {
    const token = await signSession(SECRET, { ttlMs: 1000, now: NOW });
    expect(await verifySession(token, SECRET, { now: NOW + 2000 })).toBe(false);
  });
  it('rejects a tampered expiry', async () => {
    const token = await signSession(SECRET, { ttlMs: 1000, now: NOW });
    const [, sig] = token.split('.');
    const forged = `${NOW + 999999}.${sig}`;
    expect(await verifySession(forged, SECRET, { now: NOW + 500 })).toBe(false);
  });
  it('rejects a token signed with a different secret', async () => {
    const token = await signSession('other', { ttlMs: 1000, now: NOW });
    expect(await verifySession(token, SECRET, { now: NOW + 500 })).toBe(false);
  });
  it('rejects empty/garbage', async () => {
    expect(await verifySession('', SECRET)).toBe(false);
    expect(await verifySession('garbage', SECRET)).toBe(false);
  });
  it('rejects (fails closed) when the verifying secret is empty', async () => {
    const token = await signSession(SECRET, { ttlMs: 1000, now: NOW });
    expect(await verifySession(token, '', { now: NOW + 500 })).toBe(false);
  });
});

describe('checkPassword', () => {
  it('true on exact match', () => { expect(checkPassword('abc', 'abc')).toBe(true); });
  it('false on mismatch / empty secret', () => {
    expect(checkPassword('abc', 'abd')).toBe(false);
    expect(checkPassword('abc', '')).toBe(false);
    expect(checkPassword('', '')).toBe(false);
  });
});
