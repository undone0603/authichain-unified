/**
 * Free daily allowance on the paid x402 seal lookup (Zac, Oct 16 2026:
 * "Add 3 free paid checks per payer per day before merging #1882").
 *
 * The first N calls (X402_FREE_DAILY_CALLS, default 3) per client per UTC day
 * are answered without payment; call N+1 gets the normal 402. The client is
 * keyed on a salted SHA-256 of CF-Connecting-IP, so rotating claimed wallets
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
import { readJson, restHeaders, type SealLookupCredentials } from "./paid-seal-verify";

export const FREE_CALLS_HEADER = "X-Free-Calls-Remaining";
const DEFAULT_FREE_DAILY_CALLS = 3;
const DEFAULT_SALT = "authichain-x402-free-v1";

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

/** Counter store. count() returns null on error; record() returns false. */
export interface FreeTierStore {
  count(key: string, since: Date): Promise<number | null>;
  record(key: string, now: Date): Promise<boolean>;
}

export async function hashClientIp(ip: string, salt?: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt || DEFAULT_SALT}:${ip}`);
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
    async count(key, since) {
      const query = [
        "automation_logs?select=id",
        "workflow_name=eq.x402_free",
        `payload=eq.${encodeURIComponent(key)}`,
        `created_at=gte.${encodeURIComponent(since.toISOString())}`,
        "limit=1000",
      ].join("&");
      const read = await readJson(fetchImpl, `${creds.url}/rest/v1/${query}`, creds.key);
      if (!read.ok || !Array.isArray(read.body)) return null;
      return read.body.length;
    },
    async record(key) {
      try {
        const res = await fetchImpl(`${creds.url}/rest/v1/automation_logs`, {
          method: "POST",
          headers: restHeaders(creds.key, {
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          }),
          body: JSON.stringify({
            workflow_name: "x402_free",
            trigger_type: "event",
            status: "success",
            payload: key,
          }),
          signal: AbortSignal.timeout(8000),
        });
        return res.ok;
      } catch {
        return false;
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
  const ip = (input.request.headers.get("CF-Connecting-IP") || "").trim();
  if (!ip) return { free: false, remaining: null };
  try {
    const key = `ip:${await hashClientIp(ip, input.salt)}`;
    const used = await input.store.count(key, utcDayStart(input.now));
    if (used === null) return { free: false, remaining: null };
    if (used >= input.limit) return { free: false, remaining: 0 };
    const ok = await input.store.record(key, input.now);
    if (!ok) return { free: false, remaining: null };
    return { free: true, remaining: Math.max(0, input.limit - used - 1) };
  } catch {
    return { free: false, remaining: null };
  }
}
