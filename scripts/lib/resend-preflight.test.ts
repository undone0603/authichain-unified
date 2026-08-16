import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkSender, __resetSenderCache } from './resend-preflight.ts';

const originalKey = process.env.RESEND_API_KEY;
const originalKey2 = process.env.RESEND_API_KEY2;

function mockResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

/** Resend's real 403 body for a domain that isn't on the calling account. */
const notOnAccount = (domain: string) =>
  mockResponse(403, {
    message: `The ${domain} domain is not verified. Please, add and verify your domain on https://resend.com/domains`,
  });

/** Routes each probe by which bearer token the request carried. */
function fetchByKey(handler: (key: string, from: string) => Response) {
  return vi.fn(async (_url: string, init: any) => {
    const key = String(init.headers.Authorization).replace('Bearer ', '');
    return handler(key, JSON.parse(init.body).from);
  });
}

beforeEach(() => {
  __resetSenderCache();
  process.env.RESEND_API_KEY = 're_key_one';
  process.env.RESEND_API_KEY2 = 're_key_two';
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const [name, val] of [['RESEND_API_KEY', originalKey], ['RESEND_API_KEY2', originalKey2]] as const) {
    if (val === undefined) delete process.env[name];
    else process.env[name] = val;
  }
});

describe('checkSender', () => {
  it('passes on the first credential and reports which one', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => mockResponse(200, { id: 'abc' })));
    const result = await checkSender('hello@strainchain.io');
    expect(result.ok).toBe(true);
    expect(result.from).toBe('hello@strainchain.io');
    expect(result.credential).toBe('RESEND_API_KEY');
  });

  it('falls through to the second account for a domain the first does not own', async () => {
    // The measured 2026-08-16 reality: strainchain.io lives on account one,
    // authichain.com on account two.
    vi.stubGlobal('fetch', fetchByKey((key, from) => {
      const domain = from.split('@')[1];
      const owns = key === 're_key_one' ? 'strainchain.io' : 'authichain.com';
      return domain === owns ? mockResponse(200, { id: 'abc' }) : notOnAccount(domain);
    }));

    const authichain = await checkSender('proposals@authichain.com');
    expect(authichain.ok).toBe(true);
    expect(authichain.credential).toBe('RESEND_API_KEY2');

    const strainchain = await checkSender('hello@strainchain.io');
    expect(strainchain.ok).toBe(true);
    expect(strainchain.credential).toBe('RESEND_API_KEY');
  });

  it('reports unverified_sender when no account owns the domain', async () => {
    vi.stubGlobal('fetch', fetchByKey((_key, from) => notOnAccount(from.split('@')[1])));
    const result = await checkSender('hello@mail.authichain.com');
    expect(result.ok).toBe(false);
    expect(result.kind).toBe('unverified_sender');
  });

  it('prefers the unverified_sender diagnosis over a missing second secret', async () => {
    // Key one recognises the caller but rejects the domain; key two is absent.
    // "Add the domain" is actionable, "RESEND_API_KEY2 is not set" is noise.
    delete process.env.RESEND_API_KEY2;
    vi.stubGlobal('fetch', vi.fn(async () => notOnAccount('authichain.com')));
    const result = await checkSender('hello@authichain.com');
    expect(result.ok).toBe(false);
    expect(result.kind).toBe('unverified_sender');
  });

  it('reports a revoked key as invalid_key', async () => {
    // Exactly what the 2026-08-10 scheduled run received on every send.
    vi.stubGlobal('fetch', vi.fn(async () => mockResponse(401, { message: 'API key is invalid' })));
    const result = await checkSender('hello@authichain.com');
    expect(result.ok).toBe(false);
    expect(result.kind).toBe('invalid_key');
    expect(result.reason).toBe('API key is invalid');
  });

  it('fails without any key and never calls the network', async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY2;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await checkSender('hello@strainchain.io');
    expect(result.ok).toBe(false);
    expect(result.kind).toBe('invalid_key');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('treats a network failure as unreachable and stops probing', async () => {
    const fetchSpy = vi.fn(async () => { throw new Error('ETIMEDOUT'); });
    vi.stubGlobal('fetch', fetchSpy);
    const result = await checkSender('hello@strainchain.io');
    expect(result.ok).toBe(false);
    expect(result.kind).toBe('unreachable');
    // Retrying the second credential through a broken network just doubles the wait.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
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
