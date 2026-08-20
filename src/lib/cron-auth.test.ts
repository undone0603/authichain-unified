import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { isCronAuthorized } from './cron-auth';

function makeRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest('https://example.com/api/cron/test', { headers });
}

function bearer(token: string): string {
  return ['Bearer', token].join(' ');
}

describe('isCronAuthorized', () => {
  const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

  afterEach(() => {
    if (ORIGINAL_CRON_SECRET === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
  });

  it('fails closed when CRON_SECRET is not configured', () => {
    delete process.env.CRON_SECRET;
    expect(isCronAuthorized(makeRequest({}))).toBe(false);
  });

  it('rejects malformed or non-bearer authorization headers', () => {
    process.env.CRON_SECRET = 'test-token-123';

    expect(isCronAuthorized(makeRequest({ authorization: 'test-token-123' }))).toBe(false);
    expect(isCronAuthorized(makeRequest({ authorization: 'Basic test-token-123' }))).toBe(false);
    expect(isCronAuthorized(makeRequest({ authorization: 'Bearer' }))).toBe(false);
    expect(isCronAuthorized(makeRequest({ authorization: 'Bearer ' }))).toBe(false);
    expect(isCronAuthorized(makeRequest({ authorization: ['Bearer', 'one', 'two'].join(' ') }))).toBe(false);
  });

  it('returns true only for a valid matching bearer token', () => {
    process.env.CRON_SECRET = 'test-token-123';
    expect(isCronAuthorized(makeRequest({ authorization: bearer('test-token-123') }))).toBe(true);
    expect(isCronAuthorized(makeRequest({ authorization: bearer('wrong-token-456') }))).toBe(false);
  });
});
