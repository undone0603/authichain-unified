/**
 * Stripe-prepaid agent verification, deliberately separate from x402 USDC.
 * Invocation requires an explicit rail header. Never fall back to USDC for a
 * failed prepaid attempt and never call the x402 facilitator from this path.
 * This is a paid *registry evidence* lookup, not a physical-authenticity verdict.
 */
import { createHash } from "node:crypto";
import { coerceSealBody, parseSealRequest } from "./agent-verify";
import { sealBaseline } from "./seal-baseline";
import {
  readJson,
  readSeal,
  restHeaders,
  sealLookupCredentials,
  type SealLookupEnv,
} from "./paid-seal-verify";
import { X402_AGENT_PACK_PLAN_ID, x402PackReady, type X402PackEnv } from "./x402-agent-pack";

export const STRIPE_CREDIT_RAIL_HEADER = "x-authichain-payment-rail";
export const STRIPE_CREDIT_RAIL_VALUE = "stripe_credits";
export const STRIPE_CREDIT_IDEMPOTENCY_HEADER = "x-idempotency-key";

export type PrepaidVerifyEnv = SealLookupEnv & X402PackEnv;
const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": "no-store",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEMPOTENCY = /^[A-Za-z0-9_-]{16,128}$/;

export function prepaidJson(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

/** Parse everything that could be rejected before a quota mutation. */
export async function parsePrepaidRequest(request: Request): Promise<
  | { ok: true; rawKey: string; idempotencyKey: string; sealId: string }
  | { ok: false; status: number; reason: string }
> {
  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const rawKey = bearer || request.headers.get("x-api-key")?.trim() || "";
  if (!rawKey || rawKey.length > 512) {
    return { ok: false, status: 401, reason: "api_key_required" };
  }
  const idempotencyKey = request.headers.get(STRIPE_CREDIT_IDEMPOTENCY_HEADER)?.trim() || "";
  if (!IDEMPOTENCY.test(idempotencyKey)) {
    return { ok: false, status: 400, reason: "valid_idempotency_key_required" };
  }
  let body: Record<string, unknown> | undefined;
  try {
    const parsed: unknown = await request.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = coerceSealBody(parsed as Record<string, unknown>);
    }
  } catch {
    return { ok: false, status: 400, reason: "invalid_json" };
  }
  if (!body) return { ok: false, status: 400, reason: "invalid_json" };
  const seal = parseSealRequest(body);
  if (!seal.ok) return { ok: false, status: 400, reason: seal.body.error };
  if (!UUID.test(seal.sealId)) return { ok: false, status: 400, reason: "seal_id_not_uuid" };
  return { ok: true, rawKey, idempotencyKey, sealId: seal.sealId };
}

type ApiKeyRow = {
  id?: unknown;
  is_active?: unknown;
  expires_at?: unknown;
  scopes?: unknown;
};

/**
 * Fail-closed prepaid credit redemption. The Supabase RPC performs a single
 * transaction with a buyer-level advisory lock and a unique idempotency key.
 * Registry availability is checked before spending any credits.
 */
export async function verifyUsingX402StripeCredits(
  request: Request,
  env: PrepaidVerifyEnv,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  if (!x402PackReady(env)) {
    return prepaidJson(503, { error: "stripe_credit_rail_unavailable", settled: false });
  }
  const parsed = await parsePrepaidRequest(request);
  if (!parsed.ok) return prepaidJson(parsed.status, { error: parsed.reason, settled: false });

  const creds = sealLookupCredentials(env);
  if (!creds || creds.role !== "service") {
    return prepaidJson(503, { error: "verification_store_unavailable", settled: false });
  }

  // Do not log, echo or persist the raw API key.
  const keyHash = createHash("sha256").update(parsed.rawKey).digest("hex");
  const lookup = await readJson(
    fetchImpl,
    `${creds.url}/rest/v1/api_keys?key_hash=eq.${keyHash}&select=id,is_active,expires_at,scopes&limit=2`,
    creds.key
  );
  if (!lookup.ok || !Array.isArray(lookup.body)) {
    return prepaidJson(503, { error: "api_key_store_unavailable", settled: false });
  }
  const keys = lookup.body as ApiKeyRow[];
  if (keys.length !== 1 || keys[0].is_active !== true || typeof keys[0].id !== "string" || !UUID.test(keys[0].id)) {
    return prepaidJson(401, { error: "api_key_invalid", settled: false });
  }
  const scopes = Array.isArray(keys[0].scopes) ? keys[0].scopes : [];
  if (!scopes.includes("read") && !scopes.includes("verify")) {
    return prepaidJson(403, { error: "verification_scope_required", settled: false });
  }
  if (keys[0].expires_at !== null && keys[0].expires_at !== undefined) {
    const expiresAt = Date.parse(String(keys[0].expires_at));
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return prepaidJson(403, { error: "api_key_expired", settled: false });
    }
  }

  const sealResult = await readSeal(fetchImpl, creds, parsed.sealId);
  if (!sealResult.ok) {
    return prepaidJson(503, { error: "registry_unavailable", settled: false });
  }

  let decision: Record<string, unknown>;
  try {
    const response = await fetchImpl(`${creds.url}/rest/v1/rpc/consume_x402_agent_pack_credit`, {
      method: "POST",
      headers: restHeaders(creds.key, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        p_api_key_id: keys[0].id,
        p_idempotency_key: parsed.idempotencyKey,
        p_seal_id: parsed.sealId,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("rpc_rejected");
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("rpc_malformed");
    }
    decision = data as Record<string, unknown>;
  } catch {
    return prepaidJson(503, { error: "verification_ledger_unavailable", settled: false });
  }
  if (decision.allowed !== true) {
    const reason = String(decision.reason || "denied");
    const status =
      reason === "credits_exhausted" ? 402 :
      reason === "idempotency_conflict" ? 409 :
      reason === "invalid_key_or_identity" ? 403 : 503;
    return prepaidJson(status, {
      error: reason,
      settled: false,
      ...(status === 402 ? { creditPack: X402_AGENT_PACK_PLAN_ID, alternative: "x402_usdc" } : {}),
    });
  }
  const answer = sealBaseline(sealResult.seal);
  return prepaidJson(200, {
    ...answer,
    subject: parsed.sealId,
    billing: {
      rail: "stripe_prepaid",
      creditPack: X402_AGENT_PACK_PLAN_ID,
      replayed: decision.replayed === true,
      remainingCredits: typeof decision.remaining_credits === "number" ? decision.remaining_credits : null,
    },
    timestamp: new Date().toISOString(),
  });
}
