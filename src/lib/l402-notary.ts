/**
 * @file l402-notary.ts
 * POST /api/notary: a Bitcoin-anchored notary stamp sold over Lightning (L402).
 *
 * The worker takes the payment; AgentZ signs. After a valid L402 token is
 * claimed, the worker calls AgentZ's operator endpoint (/agentz/notary) with
 * AGENT_SECRET and the Cloudflare Access service token. If AgentZ does not
 * answer, the claim is released so the same token can be retried.
 *
 * Off (503 l402_not_enabled) unless L402 is on (l402-signals.ts) and the
 * AgentZ credentials are bound. Spec: docs/strategy/LIGHTNING_L402.md.
 */
import { isL402Authorization, verifyL402 } from "./l402";
import {
  l402ChallengeFor,
  l402Resource,
  l402SignalsConfig,
  type L402Env,
} from "./l402-signals";

export const NOTARY_PRICE_USD = 0.05;
const SHA256 = /^[0-9a-f]{64}$/;
const NO_STORE = { "Cache-Control": "private, no-store" };

export type NotaryEnv = L402Env & {
  AGENTZ_API_URL?: string;
  AGENT_SECRET?: string;
  CF_ACCESS_CLIENT_ID?: string;
  CF_ACCESS_CLIENT_SECRET?: string;
};

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...NO_STORE, ...headers },
  });
}

export async function handleNotary(
  request: Request,
  env: NotaryEnv | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  const config = l402SignalsConfig(env, fetchImpl);
  const agentz = (env?.AGENTZ_API_URL ?? "").trim().replace(/\/$/, "");
  const secret = (env?.AGENT_SECRET ?? "").trim();
  if (!config || !/^https:\/\//.test(agentz) || !secret) {
    return json({ error: "l402_not_enabled", rail: "lightning" }, 503);
  }

  // Refuse a bad hash before anything is charged or any invoice is minted.
  let sha256 = "";
  try {
    sha256 = String(((await request.clone().json()) as { sha256?: unknown })?.sha256 ?? "").trim().toLowerCase();
  } catch {
    sha256 = "";
  }
  if (!SHA256.test(sha256)) return json({ error: "sha256 must be 64 hex characters" }, 400);

  const paymentRequired = async (error: string): Promise<Response> => {
    const ch = await l402ChallengeFor({
      config,
      url: request.url,
      service: "notary",
      capability: "stamp",
      priceUsd: NOTARY_PRICE_USD,
    });
    if (!ch) return json({ error: "btc_price_unavailable", rail: "lightning" }, 503);
    return json({ error, rails: ["lightning"], sats: Number(ch.sats) }, 402, {
      "WWW-Authenticate": ch.header,
    });
  };

  const authorization = request.headers.get("Authorization") ?? "";
  if (!isL402Authorization(authorization)) return paymentRequired("payment_required");
  const verdict = verifyL402(authorization, {
    rootKey: config.rootKey,
    service: "notary",
    capability: "stamp",
    resource: l402Resource(request.url),
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!verdict.ok) return paymentRequired(verdict.reason);

  const claim = await config.claims.claim(verdict.paymentHash);
  if (claim === "replay") return json({ error: "replay_rejected", rail: "lightning" }, 409);
  if (claim !== "claimed") {
    return json({ error: "l402_claims_unavailable", retry_with_same_token: true }, 503);
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    Authorization: `Bearer ${secret}`,
  };
  if (env?.CF_ACCESS_CLIENT_ID && env?.CF_ACCESS_CLIENT_SECRET) {
    headers["CF-Access-Client-Id"] = env.CF_ACCESS_CLIENT_ID;
    headers["CF-Access-Client-Secret"] = env.CF_ACCESS_CLIENT_SECRET;
  }
  let stamp: unknown = null;
  try {
    const res = await fetchImpl(`${agentz}/agentz/notary`, {
      method: "POST",
      headers,
      body: JSON.stringify({ sha256 }),
    });
    if (res.ok) stamp = await res.json();
  } catch {
    stamp = null;
  }
  if (!stamp || typeof stamp !== "object") {
    await config.claims.release(verdict.paymentHash);
    return json({ error: "notary_unavailable", retry_with_same_token: true }, 503);
  }
  await config.claims.settle(verdict.paymentHash);
  return json(
    {
      ...(stamp as Record<string, unknown>),
      payment: { rail: "lightning", paymentHash: verdict.paymentHash, amountMsat: verdict.priceMsat.toString() },
    },
    200
  );
}
