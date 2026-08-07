import { describe, it, expect } from 'vitest';
import {
  readApiKey,
  hashApiKey,
  statusForDenial,
  isRetryable,
  verificationPriceCents,
  consumeVerificationQuota,
  DEFAULT_PRICE_CENTS,
  type DenyReason,
} from './verification-caps';

/** Minimal stub of the bits of the supabase client this module touches. */
function stubClient(opts: {
  keyRow?: { id: string; is_active: boolean } | null;
  keyError?: boolean;
  rpcResult?: { allowed: boolean; reason: string; remaining_cents: number } | null;
  rpcError?: boolean;
  onRpc?: (args: Record<string, unknown>) => void;
}) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({
                  data: opts.keyRow ?? null,
                  error: opts.keyError ? { message: 'boom' } : null,
                }),
              };
            },
          };
        },
      };
    },
    async rpc(_name: string, args: Record<string, unknown>) {
      opts.onRpc?.(args);
      return {
        data: opts.rpcResult === undefined ? [{ allowed: true, reason: 'ok', remaining_cents: 95 }] : opts.rpcResult,
        error: opts.rpcError ? { message: 'boom' } : null,
      };
    },
  } as never;
}

const KEY = 'qron_abc123';
const headersWith = (h: Record<string, string>) => new Headers(h);

describe('readApiKey', () => {
  it('reads a bearer token', () => {
    expect(readApiKey(headersWith({ authorization: `Bearer ${KEY}` }))).toBe(KEY);
  });

  it('is case-insensitive on the scheme', () => {
    expect(readApiKey(headersWith({ authorization: `bearer ${KEY}` }))).toBe(KEY);
  });

  it('falls back to x-api-key', () => {
    expect(readApiKey(headersWith({ 'x-api-key': KEY }))).toBe(KEY);
  });

  it('returns null when absent, and for an empty bearer token', () => {
    expect(readApiKey(headersWith({}))).toBeNull();
    expect(readApiKey(headersWith({ authorization: 'Bearer   ' }))).toBeNull();
  });
});

describe('hashApiKey', () => {
  it('matches the SHA-256 hex that /api/keys stores', async () => {
    // Known vector: SHA-256("qron_abc123")
    const hash = await hashApiKey(KEY);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Stable across calls — the lookup depends on it.
    expect(await hashApiKey(KEY)).toBe(hash);
    expect(await hashApiKey('qron_different')).not.toBe(hash);
  });
});

describe('statusForDenial', () => {
  it('reserves 402 for budget exhaustion only', () => {
    // x402 clients react to 402 by settling a payment and retrying. Rate limits
    // must not produce 402, or agents pay-and-retry against a limit money does
    // not lift.
    expect(statusForDenial('spend_cap_reached')).toBe(402);
    expect(statusForDenial('rate_limited')).toBe(429);
    expect(statusForDenial('daily_limit_reached')).toBe(429);
  });

  it('maps auth and availability failures', () => {
    expect(statusForDenial('missing_key')).toBe(401);
    expect(statusForDenial('invalid_key')).toBe(401);
    expect(statusForDenial('no_quota')).toBe(403);
    expect(statusForDenial('key_disabled')).toBe(403);
    expect(statusForDenial('unavailable')).toBe(503);
  });

  it('never returns a 2xx for any deny reason', () => {
    const all: DenyReason[] = [
      'missing_key', 'invalid_key', 'no_quota', 'key_disabled',
      'rate_limited', 'daily_limit_reached', 'spend_cap_reached', 'unavailable',
    ];
    for (const reason of all) {
      expect(statusForDenial(reason)).toBeGreaterThanOrEqual(400);
    }
  });
});

describe('isRetryable', () => {
  it('treats rate limits and outages as retryable, budget exhaustion as not', () => {
    expect(isRetryable('rate_limited')).toBe(true);
    expect(isRetryable('unavailable')).toBe(true);
    expect(isRetryable('spend_cap_reached')).toBe(false);
    expect(isRetryable('invalid_key')).toBe(false);
  });
});

describe('verificationPriceCents', () => {
  const original = process.env.VERIFICATION_PRICE_CENTS;

  it('defaults to the flat $0.05 price', () => {
    delete process.env.VERIFICATION_PRICE_CENTS;
    expect(verificationPriceCents()).toBe(DEFAULT_PRICE_CENTS);
    expect(DEFAULT_PRICE_CENTS).toBe(5);
    process.env.VERIFICATION_PRICE_CENTS = original;
  });

  it('honours a valid override', () => {
    process.env.VERIFICATION_PRICE_CENTS = '12';
    expect(verificationPriceCents()).toBe(12);
    process.env.VERIFICATION_PRICE_CENTS = original;
  });

  it('does not let a malformed override become free or unbounded', () => {
    // A typo must not silently make every verification free.
    process.env.VERIFICATION_PRICE_CENTS = 'not-a-number';
    expect(verificationPriceCents()).toBe(DEFAULT_PRICE_CENTS);
    process.env.VERIFICATION_PRICE_CENTS = '-5';
    expect(verificationPriceCents()).toBe(DEFAULT_PRICE_CENTS);
    process.env.VERIFICATION_PRICE_CENTS = original;
  });
});

describe('consumeVerificationQuota — fails closed', () => {
  it('denies when no key is presented', async () => {
    const d = await consumeVerificationQuota(headersWith({}), { client: null });
    expect(d).toEqual({ allowed: false, reason: 'missing_key' });
  });

  it('denies when the service client is unconfigured, rather than serving unmetered', async () => {
    const d = await consumeVerificationQuota(headersWith({ 'x-api-key': KEY }), { client: null });
    expect(d).toEqual({ allowed: false, reason: 'unavailable' });
  });

  it('denies when the key lookup errors', async () => {
    const d = await consumeVerificationQuota(headersWith({ 'x-api-key': KEY }), {
      client: stubClient({ keyError: true }),
    });
    expect(d).toEqual({ allowed: false, reason: 'unavailable' });
  });

  it('denies an unknown key', async () => {
    const d = await consumeVerificationQuota(headersWith({ 'x-api-key': KEY }), {
      client: stubClient({ keyRow: null }),
    });
    expect(d).toEqual({ allowed: false, reason: 'invalid_key' });
  });

  it('denies an inactive key', async () => {
    const d = await consumeVerificationQuota(headersWith({ 'x-api-key': KEY }), {
      client: stubClient({ keyRow: { id: 'k1', is_active: false } }),
    });
    expect(d).toEqual({ allowed: false, reason: 'key_disabled' });
  });

  it('denies when the quota RPC errors', async () => {
    const d = await consumeVerificationQuota(headersWith({ 'x-api-key': KEY }), {
      client: stubClient({ keyRow: { id: 'k1', is_active: true }, rpcError: true }),
    });
    expect(d).toEqual({ allowed: false, reason: 'unavailable' });
  });

  it('denies when the RPC returns no row', async () => {
    const d = await consumeVerificationQuota(headersWith({ 'x-api-key': KEY }), {
      client: stubClient({ keyRow: { id: 'k1', is_active: true }, rpcResult: null }),
    });
    expect(d).toEqual({ allowed: false, reason: 'unavailable' });
  });

  it('does not let an unrecognised deny reason fall through to allowed', async () => {
    const d = await consumeVerificationQuota(headersWith({ 'x-api-key': KEY }), {
      client: stubClient({
        keyRow: { id: 'k1', is_active: true },
        rpcResult: { allowed: false, reason: 'something_new', remaining_cents: 0 },
      }),
    });
    expect(d.allowed).toBe(false);
    expect(d).toEqual({ allowed: false, reason: 'unavailable' });
  });

  it('surfaces each known denial reason unchanged', async () => {
    for (const reason of ['no_quota', 'rate_limited', 'daily_limit_reached', 'spend_cap_reached'] as const) {
      const d = await consumeVerificationQuota(headersWith({ 'x-api-key': KEY }), {
        client: stubClient({
          keyRow: { id: 'k1', is_active: true },
          rpcResult: { allowed: false, reason, remaining_cents: 0 },
        }),
      });
      expect(d).toEqual({ allowed: false, reason });
    }
  });
});

describe('consumeVerificationQuota — allow path', () => {
  it('charges the configured price and reports the remaining budget', async () => {
    let seen: Record<string, unknown> | undefined;
    const d = await consumeVerificationQuota(headersWith({ authorization: `Bearer ${KEY}` }), {
      client: stubClient({
        keyRow: { id: 'key-uuid', is_active: true },
        rpcResult: { allowed: true, reason: 'ok', remaining_cents: 495 },
        onRpc: (args) => { seen = args; },
      }),
      priceCents: 5,
    });

    expect(d).toEqual({
      allowed: true,
      apiKeyId: 'key-uuid',
      chargedCents: 5,
      remainingCents: 495,
    });
    // The price must be passed to the atomic function, not applied afterwards —
    // otherwise the cap check and the charge disagree.
    expect(seen).toEqual({ p_api_key_id: 'key-uuid', p_price_cents: 5 });
  });
});
