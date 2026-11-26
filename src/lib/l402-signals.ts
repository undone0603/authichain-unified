/**
 * @file l402-signals.ts
 * L402 beside x402 on the paid signal tiers (/api/x402?tier=ping|verify|evidence).
 *
 * Off unless all three are present: L402_ROOT_KEY (hex, 32+ bytes), a live
 * Lightning backend, and a BTC/USD price. No live backend exists yet: the
 * owner has not chosen one (docs/strategy/LIGHTNING_L402.md, "Owner gates"),
 * so production behaviour is unchanged. x402 requests never reach this file.
 *
 * Prices stay in USD (x402-tiers.ts). Each challenge converts at the live
 * BTC price, whole sats, 1-sat minimum, valid for 10 minutes.
 *
 * A Lightning payment is final when the preimage is shown, so the paid path
 * has no settlement step: verify the token, claim its payment hash, read the
 * registry, answer. If the registry read fails the claim is released so the
 * payer can retry with the same token.
 *
 * The claim must be atomic: with no settlement afterwards, nothing else would
 * stop ten simultaneous requests with one token from all being served. It is
 * the L402Claims Durable Object (worker-app/l402-claims.ts), one instance per
 * payment hash; KV's separate read and write could not guarantee it. Without
 * the L402_CLAIMS binding, L402 stays off.
 */
import {
  createL402Challenge,
  l402ReplayKey,
  l402RootKey,
  testLightningBackend,
  verifyL402,
  type L402Challenge,
  type L402Service,
  type LightningBackend,
} from "./l402";
import {
  readSeal,
  sealLookupCredentials,
  type PaidSealDecision,
  type SealLookupEnv,
} from "./paid-seal-verify";
import { coerceSealBody, listedSealId, parseSealRequest } from "./agent-verify";
import { isDiscoveryExampleSealId, usdToAtomic } from "./x402";
import { sealBaseline } from "./seal-baseline";
import { shapeTierAnswer, type SignalTier } from "./x402-tiers";

export const L402_LOCATION = "authichain.com";
const BTC_USD_MIN_CENTS = 100_000; // $1,000
const BTC_USD_MAX_CENTS = 1_000_000_000; // $10,000,000

/** Structural view of a Durable Object namespace (keeps this file Node-importable). */
export type ClaimNamespace = {
  idFromName(name: string): unknown;
  get(id: never): { fetch(input: string, init?: RequestInit): Promise<Response> };
};

export type L402ClaimResult = "claimed" | "replay" | "unavailable";

export interface L402ClaimStore {
  claim(paymentHash: string): Promise<L402ClaimResult>;
  release(paymentHash: string): Promise<void>;
  settle(paymentHash: string): Promise<void>;
}

/** Atomic claims backed by the L402Claims Durable Object, one instance per payment hash. */
export function durableClaimStore(ns: ClaimNamespace): L402ClaimStore {
  const call = async (paymentHash: string, op: string): Promise<string | null> => {
    try {
      const stub = ns.get(ns.idFromName(l402ReplayKey(paymentHash)) as never);
      const res = await stub.fetch("https://l402-claims.internal/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op }),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { result?: unknown };
      return typeof body?.result === "string" ? body.result : null;
    } catch {
      return null;
    }
  };
  return {
    async claim(paymentHash) {
      const result = await call(paymentHash, "claim");
      if (result === "claimed") return "claimed";
      if (result === "replay") return "replay";
      return "unavailable";
    },
    async release(paymentHash) {
      await call(paymentHash, "release");
    },
    async settle(paymentHash) {
      await call(paymentHash, "settle");
    },
  };
}

export type L402Env = {
  /** L402Claims Durable Object namespace. Unbound = L402 off (fail closed). */
  L402_CLAIMS?: ClaimNamespace;
  L402_ROOT_KEY?: string;
  /** Backend name. Only "test" exists, and only when NODE_ENV=test. */
  L402_BACKEND?: string;
  /** Fixed BTC/USD in cents, for tests. Production uses the live price. */
  L402_BTC_USD_CENTS?: string;
  NODE_ENV?: string;
};

export type L402SignalsConfig = {
  rootKey: Buffer;
  claims: L402ClaimStore;
  backend: LightningBackend;
  allowTestBackend: boolean;
  btcUsdCents: () => Promise<number | null>;
};

let sharedTestBackend: ReturnType<typeof testLightningBackend> | null = null;

/** The in-memory test backend used when L402_BACKEND=test under NODE_ENV=test. */
export function l402TestBackend(): ReturnType<typeof testLightningBackend> {
  sharedTestBackend ??= testLightningBackend();
  return sharedTestBackend;
}

/** Null (L402 off) unless the root key, the claims store, a backend and a price are all available. */
export function l402SignalsConfig(
  env: L402Env | undefined,
  fetchImpl: typeof fetch = fetch
): L402SignalsConfig | null {
  const rootKey = l402RootKey(env?.L402_ROOT_KEY);
  if (!rootKey) return null;
  const namespace = env?.L402_CLAIMS;
  if (!namespace || typeof namespace.idFromName !== "function") return null;
  const name = (env?.L402_BACKEND ?? "").trim();
  // Live adapters land once the owner chooses a provider; until then only
  // the test backend resolves, and only in a test runtime.
  if (name !== "test" || env?.NODE_ENV !== "test") return null;
  const fixed = Number(env?.L402_BTC_USD_CENTS);
  return {
    rootKey,
    claims: durableClaimStore(namespace),
    backend: l402TestBackend(),
    allowTestBackend: true,
    btcUsdCents: Number.isInteger(fixed) && fixed > 0
      ? async () => fixed
      : () => liveBtcUsdCents(fetchImpl),
  };
}

/**
 * BTC/USD in cents from Coinbase's public spot price, cached for 60 s.
 * Null when unreachable or outside $1,000-$10,000,000, so no challenge is
 * priced from a bad quote.
 */
let priceCache: { cents: number; at: number } | null = null;
export async function liveBtcUsdCents(
  fetchImpl: typeof fetch = fetch,
  nowMs: number = Date.now()
): Promise<number | null> {
  if (priceCache && nowMs - priceCache.at < 60_000) return priceCache.cents;
  try {
    const res = await fetchImpl("https://api.coinbase.com/v2/prices/BTC-USD/spot", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { amount?: unknown; currency?: unknown } };
    if (body?.data?.currency !== "USD") return null;
    const cents = Math.round(Number(body.data.amount) * 100);
    if (!Number.isFinite(cents) || cents < BTC_USD_MIN_CENTS || cents > BTC_USD_MAX_CENTS) {
      return null;
    }
    priceCache = { cents, at: nowMs };
    return cents;
  } catch {
    return null;
  }
}

export function resetL402PriceCacheForTests(): void {
  priceCache = null;
}

/** Path + query the token is bound to; host-agnostic. */
export function l402Resource(url: string): string {
  const u = new URL(url, `https://${L402_LOCATION}`);
  return u.pathname + u.search;
}

/** A challenge for one paid call, or null when L402 is off or unpriced. */
export async function l402ChallengeFor(input: {
  config: L402SignalsConfig | null;
  url: string;
  service: L402Service;
  capability: string;
  priceUsd: number;
  nowSeconds?: number;
}): Promise<L402Challenge | null> {
  const cfg = input.config;
  if (!cfg) return null;
  const cents = await cfg.btcUsdCents();
  if (!cents) return null;
  return createL402Challenge({
    rootKey: cfg.rootKey,
    backend: cfg.backend,
    allowTestBackend: cfg.allowTestBackend,
    location: L402_LOCATION,
    service: input.service,
    capability: input.capability,
    resource: l402Resource(input.url),
    priceAtomicUsd: usdToAtomic(input.priceUsd),
    btcUsdCents: cents,
    nowSeconds: input.nowSeconds ?? Math.floor(Date.now() / 1000),
  });
}

export function l402SignalChallenge(input: {
  config: L402SignalsConfig | null;
  url: string;
  tier: SignalTier;
  priceUsd: number;
  nowSeconds?: number;
}): Promise<L402Challenge | null> {
  return l402ChallengeFor({ ...input, service: "signals", capability: input.tier });
}

/** Paid signal call over L402. Mirrors resolvePaidSealVerify minus settlement. */
export async function resolveL402PaidSealVerify(input: {
  authorization: string;
  config: L402SignalsConfig;
  url: string;
  tier: SignalTier;
  bodyText: string;
  env?: SealLookupEnv;
  fetchImpl?: typeof fetch;
  nowSeconds?: number;
}): Promise<PaidSealDecision> {
  const verdict = verifyL402(input.authorization, {
    rootKey: input.config.rootKey,
    service: "signals",
    capability: input.tier,
    resource: l402Resource(input.url),
    nowSeconds: input.nowSeconds ?? Math.floor(Date.now() / 1000),
  });
  if (!verdict.ok) {
    return { action: "answer", status: 402, body: { error: verdict.reason, rail: "lightning" } };
  }
  const creds = sealLookupCredentials(input.env);
  if (!creds) {
    return {
      action: "answer",
      status: 503,
      body: { error: "l402_registry_not_bound", settled: true, rail: "lightning" },
    };
  }

  let parsedBody: Record<string, unknown> = {};
  if (input.bodyText.trim()) {
    try {
      const value = JSON.parse(input.bodyText) as unknown;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        parsedBody = coerceSealBody(value as Record<string, unknown>);
      }
    } catch {
      parsedBody = {};
    }
  }
  const parsed = parseSealRequest(parsedBody);
  const listed = listedSealId(parsedBody);
  const discoveryAlias = Boolean(listed) && isDiscoveryExampleSealId(listed);
  // Same rule as x402: a non-UUID seal is refused before the token is spent.
  if (!parsed.ok && listed && !discoveryAlias) {
    return { action: "answer", status: parsed.status, body: parsed.body };
  }
  const sealId = parsed.ok ? parsed.sealId : null;

  const claims = input.config.claims;
  const claim = await claims.claim(verdict.paymentHash);
  if (claim === "replay") {
    return { action: "answer", status: 409, body: { error: "replay_rejected", rail: "lightning" } };
  }
  if (claim !== "claimed") {
    return {
      action: "answer",
      status: 503,
      body: { error: "l402_claims_unavailable", settled: true, retry_with_same_token: true },
    };
  }

  let seal: Record<string, unknown> | null = null;
  if (sealId) {
    const lookup = await readSeal(input.fetchImpl ?? fetch, creds, sealId);
    if (!lookup.ok) {
      await claims.release(verdict.paymentHash);
      return {
        action: "answer",
        status: 503,
        body: { error: "registry_unavailable", settled: true, retry_with_same_token: true },
      };
    }
    seal = lookup.seal;
  }
  await claims.settle(verdict.paymentHash);
  return {
    action: "answer",
    status: 200,
    body: {
      ...shapeTierAnswer(input.tier, sealBaseline(seal)),
      subject: sealId ?? (discoveryAlias ? listed : null),
      settlement: {
        rail: "lightning",
        paymentHash: verdict.paymentHash,
        amountMsat: verdict.priceMsat.toString(),
      },
      timestamp: new Date().toISOString(),
    },
  };
}
