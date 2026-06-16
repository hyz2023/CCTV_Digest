import { describe, it, expect } from 'vitest';
import { isAuthorizedCron } from './cron-auth';

describe('isAuthorizedCron', () => {
  it('authorizes a matching Bearer secret', () => {
    expect(isAuthorizedCron({ authorization: 'Bearer s3cret' }, { CRON_SECRET: 's3cret' })).toBe(true);
  });
  it('rejects a wrong secret', () => {
    expect(isAuthorizedCron({ authorization: 'Bearer nope' }, { CRON_SECRET: 's3cret' })).toBe(false);
  });
  it('rejects when no authorization header', () => {
    expect(isAuthorizedCron({}, { CRON_SECRET: 's3cret' })).toBe(false);
  });
  it('rejects (fails closed) when CRON_SECRET is not configured', () => {
    expect(isAuthorizedCron({ authorization: 'Bearer anything' }, {})).toBe(false);
  });
});
