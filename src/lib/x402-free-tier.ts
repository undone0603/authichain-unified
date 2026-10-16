/**
 * Free daily allowance on the paid x402 seal lookup (Zac, Oct 16 2026:
 * "Add 3 free paid checks per payer per day before merging #1882").
 *
 * The first N calls (X402_FREE_DAILY_CALLS, default 3) per client per UTC day
 * are answered without payment; call N+1 gets the normal 402. The client is
 * keyed on a SHA-256 of CF-Connecting-IP salted with X402_FREE_IP_SALT (required;
 * unset or empty means no free calls), so rotating claimed wallets
 * buys nothing. There is no claimed-payer header convention in this codebase,
 * so no wallet key is used before payment.
 *
 * Counters live in the same Supabase automation_logs ledger the paid path
 * already uses for the $10/day spend cap (workflow_name = "x402_free",
 * payload = "ip:<hash>"), counted from UTC midnight, so the window expires at
 * the end of the UTC day. authichain-com has no KV/D1 binding to use instead.
 *
 * Any store error, missing client IP or missing service-role key fails closed
 * to the paid 402.
 */
import { restHeaders, type SealLookupCredentials } from "./paid-seal-verify";

export const FREE_CALLS_HEADER = "X-Free-Calls-Remaining";
const DEFAULT_FREE_DAILY_CALLS = 3;

export function freeDailyCalls(raw?: string): number {
  const source = raw ?? process.env.X402_FREE_DAILY_CALLS;
  if (source === undefined || String(source).trim() === "") {
    return DEFAULT_FREE_DAILY_CALLS;
  }
  const n = Number(source);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_FREE_DAILY_CALLS;
  return Math.floor(n);
}

export function utcDayStart(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

/**
 * Counter store. reserve() atomically grants one free slot only while fewer
 * than `limit` slots exist for `key` since `since`. Returns null on error.
 * The Supabase store backs this with ONE Postgres RPC (x402_claim_free_call)
 * that checks and inserts under pg_advisory_xact_lock, so concurrent calls
 * cannot exceed the cap.
 */
export interface FreeTierStore {
  reserve(
    key: string,
    since: Date,
    limit: number,
    now: Date
  ): Promise<{ granted: boolean; used: number } | null>;
}

/** Daily key: same IP hashes differently each UTC day (YYYY-MM-DD). */
export async function hashClientIp(ip: string, salt: string, now: Date): Promise<string> {
  const day = utcDayStart(now).toISOString().slice(0, 10);
  const data = new TextEncoder().encode(`${salt}:${day}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export function supabaseFreeTierStore(
  creds: SealLookupCredentials,
  fetchImpl: typeof fetch = fetch
): FreeTierStore | null {
  // Anon cannot write the ledger, so the counter could never advance.
  if (creds.role !== "service") return null;
  return {
    async reserve(key, since, limit) {
      try {
        const res = await fetchImpl(`${creds.url}/rest/v1/rpc/x402_claim_free_call`, {
          method: "POST",
          headers: restHeaders(creds.key, { "Content-Type": "application/json" }),
          body: JSON.stringify({
            p_key: key,
            p_since: since.toISOString(),
            p_limit: limit,
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return null;
        const body = (await res.json()) as unknown;
        const row = (Array.isArray(body) ? body[0] : body) as
          | { granted?: unknown; used?: unknown }
          | null
          | undefined;
        if (!row || typeof row.granted !== "boolean" || typeof row.used !== "number") {
          return null;
        }
        return { granted: row.granted, used: row.used };
      } catch {
        return null;
      }
    },
  };
}

export type FreeTierDecision =
  | { free: true; remaining: number }
  | { free: false; remaining: number | null };

/**
 * Reserve one free call for this request, or say why it must pay.
 * The slot is recorded before the lookup so failures cannot be replayed free.
 */
export async function claimFreeCall(input: {
  request: Request;
  store: FreeTierStore | null;
  limit: number;
  now: Date;
  salt?: string;
}): Promise<FreeTierDecision> {
  if (input.limit <= 0) return { free: false, remaining: 0 };
  if (!input.store) return { free: false, remaining: null };
  // No public fallback salt: without X402_FREE_IP_SALT, fail closed to 402.
  const salt = (input.salt || "").trim();
  if (!salt) return { free: false, remaining: null };
  const ip = (input.request.headers.get("CF-Connecting-IP") || "").trim();
  if (!ip) return { free: false, remaining: null };
  try {
    const key = `ip:${await hashClientIp(ip, salt, input.now)}`;
    const r = await input.store.reserve(key, utcDayStart(input.now), input.limit, input.now);
    if (!r) return { free: false, remaining: null };
    if (!r.granted) return { free: false, remaining: 0 };
    // r.used counts this call's slot.
    return { free: true, remaining: Math.max(0, input.limit - r.used) };
  } catch {
    return { free: false, remaining: null };
  }
}
