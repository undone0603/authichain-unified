/**
 * Free daily allowance on the paid x402 seal lookup (Zac, Oct 16 2026:
 * "Add 3 free paid checks per payer per day before merging #1882").
 *
 * The first N calls (X402_FREE_DAILY_CALLS, default 3) per client per UTC day
 * are answered without payment; call N+1 gets the normal 402. The client is
 * keyed on a SHA-256 of CF-Connecting-IP (IPv6 reduced to its /64) salted with X402_FREE_IP_SALT (required;
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

/**
 * Free-tier client key. IPv4 is used as-is. IPv6 is reduced to its /64
 * prefix, because one subscriber usually holds a whole /64 and can rotate
 * the low 64 bits at will (that let a rotating client bypass the cap).
 * IPv4-mapped IPv6 (::ffff:a.b.c.d) is treated as the IPv4 address.
 */
export function freeTierClientKey(ip: string): string {
  const raw = ip.trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (!raw.includes(":")) return raw;
  const mapped = raw.match(/^(?:0*:)*:?ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  let body = raw;
  let tail: string[] = [];
  const v4 = body.match(/:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) {
    const o = v4[1].split(".").map(Number);
    tail = [((o[0] << 8) | o[1]).toString(16), ((o[2] << 8) | o[3]).toString(16)];
    body = body.slice(0, -v4[1].length) + "0";
  }
  const halves = body.split("::");
  if (halves.length > 2) return raw;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (v4) rest.length ? rest.splice(-1, 1, ...tail) : head.splice(-1, 1, ...tail);
  const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
  const groups = [...head, ...Array(Math.max(0, fill)).fill("0"), ...rest];
  if (groups.length !== 8 || groups.some(g => !/^[0-9a-f]{1,4}$/.test(g))) return raw;
  return groups.slice(0, 4).map(g => parseInt(g, 16).toString(16)).join(":") + "::/64";
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
    const key = `ip:${await hashClientIp(freeTierClientKey(ip), salt, input.now)}`;
    const r = await input.store.reserve(key, utcDayStart(input.now), input.limit, input.now);
    if (!r) return { free: false, remaining: null };
    if (!r.granted) return { free: false, remaining: 0 };
    // r.used counts this call's slot.
    return { free: true, remaining: Math.max(0, input.limit - r.used) };
  } catch {
    return { free: false, remaining: null };
  }
}
