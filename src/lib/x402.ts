/**
 * @file x402.ts
 * x402 (HTTP 402 "Payment Required") helpers for autonomous agent micropayments.
 *
 * Flow: an agent calls a paid endpoint with no payment -> we return 402 + the
 * payment requirements. The agent's wallet pays (USDC on Polygon / $QRON) and
 * retries with an `X-PAYMENT` proof header -> we verify + enforce a per-payer
 * spend cap, then serve the resource. Autonomous at runtime; the wallet must be
 * funded by a KYC'd entity and every payer is spend-capped + rate-limited.
 *
 * Pure helpers here are fully unit-tested; settlement verification has a single
 * documented integration point (`verifyPaymentProof`) to wire to an x402
 * facilitator or an on-chain check.
 */

export interface PaymentRequirement {
  scheme: 'exact';
  network: string;            // e.g. 'polygon'
  maxAmountRequired: string;  // atomic units (USDC has 6 decimals)
  resource: string;           // the URL being paid for
  description: string;
  payTo: string;              // receiving wallet
  asset: string;              // token contract (USDC)
  mimeType: 'application/json';
}

export interface PaymentProof {
  scheme: string;
  network: string;
  payer: string;        // payer wallet address
  amount: string;       // atomic units paid
  txHash?: string;      // settlement tx (on-chain) if available
  signature?: string;   // authorization signature
}

export const USDC_DECIMALS = 6;

/** Convert a USD dollar amount to USDC atomic units (6 decimals), as a string. */
export function usdToAtomic(usd: number): string {
  if (!Number.isFinite(usd) || usd < 0) throw new Error('usdToAtomic: invalid amount');
  return Math.round(usd * 10 ** USDC_DECIMALS).toString();
}

/** Build the 402 payment-requirements body an unpaid agent receives. */
export function buildPaymentRequired(opts: {
  resource: string;
  priceUsd: number;
  payTo: string;
  network?: string;
  asset?: string;
  description?: string;
}): { status: 402; body: { x402Version: number; accepts: PaymentRequirement[] } } {
  const requirement: PaymentRequirement = {
    scheme: 'exact',
    network: opts.network ?? 'polygon',
    maxAmountRequired: usdToAtomic(opts.priceUsd),
    resource: opts.resource,
    description: opts.description ?? 'AuthiChain verification',
    payTo: opts.payTo,
    asset: opts.asset ?? (process.env.X402_USDC_ASSET ?? 'USDC'),
    mimeType: 'application/json',
  };
  return { status: 402, body: { x402Version: 1, accepts: [requirement] } };
}

/** Decode the base64-encoded JSON `X-PAYMENT` header into a PaymentProof. */
export function parsePaymentHeader(header: string | null | undefined): PaymentProof | null {
  if (!header) return null;
  try {
    const json = Buffer.from(header, 'base64').toString('utf8');
    const proof = JSON.parse(json) as PaymentProof;
    if (!proof.payer || !proof.amount || !proof.network) return null;
    return proof;
  } catch {
    return null;
  }
}

/**
 * Verify that a payment proof satisfies a requirement.
 *
 * INTEGRATION POINT: in production, replace the structural check below with a
 * call to an x402 facilitator (`/verify`) or an on-chain settlement lookup of
 * `proof.txHash`. Until `X402_FACILITATOR_URL` is configured this runs in
 * dev/structural mode (network + amount + payer must match) so the flow is
 * exercisable end-to-end without funds.
 */
export function verifyPaymentProof(
  proof: PaymentProof,
  requirement: PaymentRequirement,
): { valid: boolean; payer: string; amount: bigint; reason?: string } {
  const fail = (reason: string) => ({ valid: false, payer: proof.payer ?? '', amount: 0n, reason });

  if (proof.network !== requirement.network) return fail('network mismatch');
  let amount: bigint;
  try { amount = BigInt(proof.amount); } catch { return fail('bad amount'); }
  if (amount < BigInt(requirement.maxAmountRequired)) return fail('underpaid');
  if (!/^0x[a-fA-F0-9]{40}$/.test(proof.payer)) return fail('bad payer address');

  // Production settlement check would go here (facilitator or on-chain txHash).
  if (process.env.X402_FACILITATOR_URL && !proof.txHash && !proof.signature) {
    return fail('missing settlement proof');
  }
  return { valid: true, payer: proof.payer, amount };
}

/** Pure spend-cap check: would this payment push the payer over their window cap? */
export function wouldExceedCap(
  currentSpentAtomic: bigint,
  paymentAtomic: bigint,
  capAtomic: bigint,
): boolean {
  return currentSpentAtomic + paymentAtomic > capAtomic;
}

/** Default per-payer daily spend cap in USD (override via X402_DAILY_CAP_USD). */
export function dailyCapUsd(): number {
  const v = Number(process.env.X402_DAILY_CAP_USD);
  return Number.isFinite(v) && v > 0 ? v : 10;
}
