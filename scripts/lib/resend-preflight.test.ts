import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkSender, __resetSenderCache } from './resend-preflight.ts';

const originalKey = process.env.RESEND_API_KEY;

function mockResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  __resetSenderCache();
  process.env.RESEND_API_KEY = 're_test_key';
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalKey;
});

describe('checkSender', () => {
  it('passes when Resend accepts the probe', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mockResponse(200, { id: 'abc' })));
    const result = await checkSender('hello@strainchain.io');
    expect(result.ok).toBe(true);
    expect(result.from).toBe('hello@strainchain.io');
  });

  it('reports a revoked key as invalid_key', async () => {
    // Exactly what the 2026-08-10 scheduled run received on every send.
    vi.stubGlobal('fetch', vi.fn(async () => mockResponse(401, { message: 'API key is invalid' })));
    const result = await checkSender('hello@authichain.com');
    expect(result.ok).toBe(false);
    expect(result.kind).toBe('invalid_key');
    expect(result.reason).toBe('API key is invalid');
  });

  it('reports an unverified sending domain distinctly from a bad key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      mockResponse(403, { message: 'The authichain.com domain is not verified' }),
    ));
    const result = await checkSender('hello@authichain.com');
    expect(result.ok).toBe(false);
    expect(result.kind).toBe('unverified_sender');
  });

  it('fails without a key and never calls the network', async () => {
    delete process.env.RESEND_API_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await checkSender('hello@strainchain.io');
    expect(result.ok).toBe(false);
    expect(result.kind).toBe('invalid_key');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('treats a network failure as unreachable rather than a credential problem', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ETIMEDOUT'); }));
    const result = await checkSender('hello@strainchain.io');
    expect(result.ok).toBe(false);
    expect(result.kind).toBe('unreachable');
  });

  it('probes each distinct sender once', async () => {
    const fetchSpy = vi.fn(async () => mockResponse(200, { id: 'abc' }));
    vi.stubGlobal('fetch', fetchSpy);

    await checkSender('a@strainchain.io');
    await checkSender('a@strainchain.io');
    await checkSender('b@strainchain.io');

    // Segments share senders; without caching a full run would send one probe
    // per segment on every invocation.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
