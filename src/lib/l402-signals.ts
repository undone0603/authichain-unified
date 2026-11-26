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
 * has no settlement step: verify the token, claim its payment hash in the
 * replay store, read the registry, answer. If the registry read fails the
 * claim is released so the payer can retry with the same token.
 */
import {
  createL402Challenge,
  l402ReplayKey,
  l402RootKey,
  testLightningBackend,
  verifyL402,
  type L402Challenge,
  type LightningBackend,
} from "./l402";
import {
  claimReplay,
  readSeal,
  releaseReplay,
  rememberSettledProof,
  sealLookupCredentials,
  type PaidSealDecision,
  type ReplayStore,
  type SealLookupEnv,
} from "./paid-seal-verify";
import { coerceSealBody, listedSealId, parseSealRequest } from "./agent-verify";
import { isDiscoveryExampleSealId, usdToAtomic } from "./x402";
import { sealBaseline } from "./seal-baseline";
import { shapeTierAnswer, type SignalTier } from "./x402-tiers";

export const L402_LOCATION = "authichain.com";
const BTC_USD_MIN_CENTS = 100_000; // $1,000
const BTC_USD_MAX_CENTS = 1_000_000_000; // $10,000,000

export type L402Env = {
  L402_ROOT_KEY?: string;
  /** Backend name. Only "test" exists, and only when NODE_ENV=test. */
  L402_BACKEND?: string;
  /** Fixed BTC/USD in cents, for tests. Production uses the live price. */
  L402_BTC_USD_CENTS?: string;
  NODE_ENV?: string;
};

export type L402SignalsConfig = {
  rootKey: Buffer;
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

/** Null (L402 off) unless the root key, a backend and a price are all available. */
export function l402SignalsConfig(
  env: L402Env | undefined,
  fetchImpl: typeof fetch = fetch
): L402SignalsConfig | null {
  const rootKey = l402RootKey(env?.L402_ROOT_KEY);
  if (!rootKey) return null;
  const name = (env?.L402_BACKEND ?? "").trim();
  // Live adapters land once the owner chooses a provider; until then only
  // the test backend resolves, and only in a test runtime.
  if (name !== "test" || env?.NODE_ENV !== "test") return null;
  const fixed = Number(env?.L402_BTC_USD_CENTS);
  return {
    rootKey,
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

/** A challenge for one signal call, or null when L402 is off or unpriced. */
export async function l402SignalChallenge(input: {
  config: L402SignalsConfig | null;
  url: string;
  tier: SignalTier;
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
    service: "signals",
    capability: input.tier,
    resource: l402Resource(input.url),
    priceAtomicUsd: usdToAtomic(input.priceUsd),
    btcUsdCents: cents,
    nowSeconds: input.nowSeconds ?? Math.floor(Date.now() / 1000),
  });
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
  replayStore?: ReplayStore | null;
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

  const keys = [l402ReplayKey(verdict.paymentHash)];
  const replayStore = input.replayStore ?? null;
  const claim = await claimReplay(replayStore, keys);
  if (claim) return { action: "answer", ...claim };

  let seal: Record<string, unknown> | null = null;
  if (sealId) {
    const lookup = await readSeal(input.fetchImpl ?? fetch, creds, sealId);
    if (!lookup.ok) {
      await releaseReplay(replayStore, keys);
      return {
        action: "answer",
        status: 503,
        body: { error: "registry_unavailable", settled: true, retry_with_same_token: true },
      };
    }
    seal = lookup.seal;
  }
  await rememberSettledProof(replayStore, keys, { sealId, txHash: null });
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
