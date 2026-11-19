/**
 * @file x402-tiers.ts
 * Priced "signal" tiers on the existing x402 agent rail (Base USDC).
 *
 *   ping      $0.01  registry existence only
 *   verify    $0.05  signature/validity baseline (the original, default call)
 *   evidence  $0.10  baseline + a digest of exactly what was returned
 *
 * The tier is chosen by `?tier=` on the paid resource, so the 402 quote, the
 * payment check, the settlement and the spend ledger all bind to one URL. No
 * `tier` means `verify`: behavior, price and ledger are unchanged for every
 * existing caller. No tier makes a stronger claim than the baseline: nothing
 * here asserts real-world authenticity (see sealBaseline's `unknowns`).
 *
 * Pure helpers only; payTo, asset and facilitator stay in x402.ts.
 */
import { createHash } from "node:crypto";
import { usdToAtomic } from "./x402";

export type SignalTier = "ping" | "verify" | "evidence";

export const SIGNAL_TIER_NAMES: readonly SignalTier[] = [
  "ping",
  "verify",
  "evidence",
];

/** Fixed prices for the cheap and premium tiers. `verify` follows X402_PRICE_USD. */
export const PING_PRICE_USD = 0.01;
export const EVIDENCE_PRICE_USD = 0.1;

/** automation_logs.workflow_name per tier. `verify` keeps the legacy name. */
export const SIGNAL_LEDGER: Record<SignalTier, string> = {
  ping: "x402_spend_ping",
  verify: "x402_spend",
  evidence: "x402_spend_evidence",
};

export function tierPriceUsd(tier: SignalTier, verifyUsd: number): number {
  if (tier === "ping") return PING_PRICE_USD;
  if (tier === "evidence") return EVIDENCE_PRICE_USD;
  return verifyUsd;
}

/** Ledger names to read when summing a payer's spend across every tier. */
export const SIGNAL_LEDGER_NAMES: readonly string[] = SIGNAL_TIER_NAMES.map(
  t => SIGNAL_LEDGER[t]
);

/**
 * Atomic-USDC spend for a set of ledger rows: each row costs its own tier's
 * price (legacy `x402_spend` rows are the verify tier). A row that cannot be
 * priced counts at the highest tier so it can never lower the total.
 */
export function spendAtomicFromRows(
  rows: ReadonlyArray<{ workflow_name?: unknown }>,
  verifyUsd: number
): bigint {
  const price = new Map<string, bigint>(
    SIGNAL_TIER_NAMES.map(t => [
      SIGNAL_LEDGER[t],
      BigInt(usdToAtomic(tierPriceUsd(t, verifyUsd))),
    ])
  );
  const worst = BigInt(usdToAtomic(tierPriceUsd("evidence", verifyUsd)));
  let total = 0n;
  for (const row of rows) {
    total += price.get(String(row?.workflow_name)) ?? worst;
  }
  return total;
}

export type TierRequest =
  | { ok: true; tier: SignalTier; priceUsd: number }
  | { ok: false; status: 400; body: { error: string; tiers: string[] } };

/**
 * Resolve the tier and its price from a resource URL (or a bare tier value).
 * Unknown tiers are 400 before any quote or payment so no agent is charged
 * for a tier that does not exist.
 */
export function resolveTierRequest(
  resourceOrTier: string | null | undefined,
  verifyUsd: number
): TierRequest {
  let raw: string | null = null;
  const input = (resourceOrTier ?? "").trim();
  if (input.includes("://") || input.startsWith("/")) {
    try {
      raw = new URL(input, "https://x402.invalid").searchParams.get("tier");
    } catch {
      raw = null;
    }
  } else if (input) {
    raw = input;
  }
  if (raw === null || raw === "") {
    return { ok: true, tier: "verify", priceUsd: verifyUsd };
  }
  const tier = raw.toLowerCase();
  if ((SIGNAL_TIER_NAMES as readonly string[]).includes(tier)) {
    const t = tier as SignalTier;
    return { ok: true, tier: t, priceUsd: tierPriceUsd(t, verifyUsd) };
  }
  return {
    ok: false,
    status: 400,
    body: { error: "unknown_tier", tiers: [...SIGNAL_TIER_NAMES] },
  };
}

/** Deterministic JSON (sorted keys) so a digest can be recomputed by the buyer. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

type Baseline = Record<string, unknown> & {
  registered?: unknown;
  status?: unknown;
  baseline?: unknown;
};

/**
 * Shape the paid answer for a tier. `verify` returns the baseline untouched.
 * `ping` reveals registry existence only. `evidence` adds a SHA-256 over the
 * canonical baseline so the buyer can prove what they were sold.
 */
export function shapeTierAnswer(
  tier: SignalTier,
  answer: Baseline,
  checkedAt = new Date().toISOString()
): Record<string, unknown> {
  if (tier === "verify") return answer;
  if (tier === "ping") {
    return {
      tier: "ping",
      registered: answer.registered === true,
      status: answer.status ?? null,
      scope: "registry-existence",
      checkedAt,
    };
  }
  return {
    ...answer,
    tier: "evidence",
    evidence: {
      algorithm: "sha256",
      digest: createHash("sha256").update(stableStringify(answer)).digest("hex"),
      over: "canonical JSON of the baseline answer returned in this response",
      checkedAt,
    },
  };
}
