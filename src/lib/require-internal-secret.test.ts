import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { requireInternalSecret } from './require-internal-secret';

function makeRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest('https://example.com/api/guardrail/check', { headers });
}

describe('requireInternalSecret', () => {
  const ORIGINAL = process.env.INTERNAL_API_SECRET;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.INTERNAL_API_SECRET;
    else process.env.INTERNAL_API_SECRET = ORIGINAL;
  });

  it('denies with 503 when no secret is configured', async () => {
    delete process.env.INTERNAL_API_SECRET;
    const res = requireInternalSecret(makeRequest({}));
    expect(res?.status).toBe(503);
  });

  it('denies with 401 when the header secret is wrong', async () => {
    process.env.INTERNAL_API_SECRET = 'correct-secret';
    const res = requireInternalSecret(makeRequest({ 'x-internal-secret': 'wrong' }));
    expect(res?.status).toBe(401);
  });

  it('allows when x-internal-secret matches', () => {
    process.env.INTERNAL_API_SECRET = 'correct-secret';
    const res = requireInternalSecret(makeRequest({ 'x-internal-secret': 'correct-secret' }));
    expect(res).toBeNull();
  });

  it('allows when Authorization Bearer matches', () => {
    process.env.INTERNAL_API_SECRET = 'correct-secret';
    const res = requireInternalSecret(makeRequest({ authorization: 'Bearer correct-secret' }));
    expect(res).toBeNull();
  });
});
