/**
 * Per-API-key rate limits and spend caps for the verification endpoint.
 *
 * Step 1 of docs/superpowers/plans/2026-08-07-x402-agent-verification.md, and a
 * hard prerequisite for making /api/verify agent-payable. An endpoint that
 * autonomous agents can call and pay for, without a ceiling, is an unbounded
 * liability: a looping agent, a bug, or a funded attacker spends without limit.
 *
 * Everything here FAILS CLOSED. That is the opposite of src/lib/rate-limit.ts,
 * which returns `{ ok: true }` on a query error "for protocol availability".
 * That tradeoff is defensible for a free endpoint and wrong for a paid one:
 * failing open on a metered path means an outage becomes free unmetered
 * compute, and a database you cannot reach is a database that cannot tell you
 * the cap was already hit.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Price per verification, in cents.
 *
 * $0.05 flat. Deliberately one number rather than the $0.03–$0.49 tier ladder
 * in REVENUE_STRATEGY.md: tiered pricing is a negotiation, and there is no
 * leverage to negotiate with before the first customer. One published price an
 * agent developer can read off a docs page beats a table they have to model.
 *
 * Override per-deployment with VERIFICATION_PRICE_CENTS. Never inline this at a
 * call site — the price must be changeable without touching request handling.
 */
export const DEFAULT_PRICE_CENTS = 5;

export function verificationPriceCents(): number {
  const raw = process.env.VERIFICATION_PRICE_CENTS;
  if (!raw) return DEFAULT_PRICE_CENTS;
  const parsed = Number.parseInt(raw, 10);
  // A malformed override must not silently become 0 (free) or NaN (unbounded).
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_PRICE_CENTS;
  return parsed;
}

export type DenyReason =
  | 'missing_key'
  | 'invalid_key'
  | 'no_quota'
  | 'key_disabled'
  | 'rate_limited'
  | 'daily_limit_reached'
  | 'spend_cap_reached'
  | 'unavailable';

export type QuotaDecision =
  | { allowed: true; apiKeyId: string; chargedCents: number; remainingCents: number }
  | { allowed: false; reason: DenyReason };

/** Deny reasons that mean "slow down", as opposed to "you are out of budget". */
const RETRYABLE: ReadonlySet<DenyReason> = new Set<DenyReason>([
  'rate_limited',
  'unavailable',
]);

/**
 * HTTP status for a denial.
 *
 * 402 is reserved for the two budget-exhaustion cases, because that is what an
 * x402 client is built to react to — it settles a payment and retries. Emitting
 * 402 for a rate limit would send agents into a pay-and-retry loop against a
 * limit that money does not lift.
 */
export function statusForDenial(reason: DenyReason): number {
  switch (reason) {
    case 'missing_key':
    case 'invalid_key':
      return 401;
    case 'no_quota':
    case 'key_disabled':
      return 403;
    case 'rate_limited':
    case 'daily_limit_reached':
      return 429;
    case 'spend_cap_reached':
      return 402;
    case 'unavailable':
      return 503;
  }
}

export function isRetryable(reason: DenyReason): boolean {
  return RETRYABLE.has(reason);
}

/** Extract the bearer/x-api-key credential from a request's headers. */
export function readApiKey(headers: Headers): string | null {
  const auth = headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  const direct = headers.get('x-api-key')?.trim();
  return direct ? direct : null;
}

/**
 * SHA-256 of the raw key, hex encoded — matches how /api/keys stores it.
 * Keys are only ever compared as hashes; the plaintext is shown once at
 * creation and never persisted.
 */
export async function hashApiKey(rawKey: string): Promise<string> {
  const bytes = new TextEncoder().encode(rawKey);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function serviceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Authenticate a key and atomically consume one verification's worth of quota.
 *
 * The check and the write happen inside consume_verification_quota, a single
 * SQL function holding a row lock. Doing it in two steps from here would race:
 * two concurrent requests would both read a spend total below the cap and both
 * proceed, putting the account over its ceiling.
 */
export async function consumeVerificationQuota(
  headers: Headers,
  deps: { client?: SupabaseClient | null; priceCents?: number } = {},
): Promise<QuotaDecision> {
  const rawKey = readApiKey(headers);
  if (!rawKey) return { allowed: false, reason: 'missing_key' };

  const client = deps.client !== undefined ? deps.client : serviceClient();
  // No credentials configured means we cannot enforce a cap. Refuse to serve
  // rather than serve unmetered.
  if (!client) return { allowed: false, reason: 'unavailable' };

  const priceCents = deps.priceCents ?? verificationPriceCents();

  try {
    const keyHash = await hashApiKey(rawKey);

    const { data: keyRow, error: keyError } = await client
      .from('api_keys')
      .select('id, is_active')
      .eq('key_hash', keyHash)
      .maybeSingle();

    if (keyError) return { allowed: false, reason: 'unavailable' };
    if (!keyRow) return { allowed: false, reason: 'invalid_key' };
    // api_keys.is_active is nullable in the live schema. Require an explicit
    // true: a NULL is ambiguous, and ambiguity resolves to denied here, not
    // allowed. Checking `=== false` would let NULL rows through.
    if (keyRow.is_active !== true) return { allowed: false, reason: 'key_disabled' };

    const { data, error } = await client.rpc('consume_verification_quota', {
      p_api_key_id: keyRow.id,
      p_price_cents: priceCents,
    });

    if (error) return { allowed: false, reason: 'unavailable' };

    // The function returns a single row; supabase-js surfaces set-returning
    // functions as an array.
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { allowed: false, reason: 'unavailable' };

    if (!row.allowed) {
      const reason = row.reason as DenyReason;
      // An unrecognised reason must not fall through to "allowed".
      return {
        allowed: false,
        reason: statusForDenialIsKnown(reason) ? reason : 'unavailable',
      };
    }

    return {
      allowed: true,
      apiKeyId: keyRow.id,
      chargedCents: priceCents,
      remainingCents: row.remaining_cents ?? 0,
    };
  } catch {
    // Any unexpected throw is a denial, never a pass.
    return { allowed: false, reason: 'unavailable' };
  }
}

const KNOWN_REASONS: ReadonlySet<string> = new Set<DenyReason>([
  'missing_key',
  'invalid_key',
  'no_quota',
  'key_disabled',
  'rate_limited',
  'daily_limit_reached',
  'spend_cap_reached',
  'unavailable',
]);

function statusForDenialIsKnown(reason: string): reason is DenyReason {
  return KNOWN_REASONS.has(reason);
}
