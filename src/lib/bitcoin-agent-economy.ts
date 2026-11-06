/**
 * Bitcoin/Lightning economic rail for AuthiChain agents.
 *
 * This module deliberately contains NO private-key handling and NO automatic
 * transfer implementation. It defines the policy boundary between an agent
 * and a future Lightning provider. Payments become auditable AuthiChain
 * economic events only after a provider reports settlement.
 */

export const SATOSHIS_PER_BTC = 100_000_000n;

export type BitcoinRail = "bitcoin" | "lightning";

export type AgentSpendPolicy = Readonly<{
  agentId: string;
  dailySats: bigint;
  perTransactionSats: bigint;
  requireHumanApprovalAboveSats: bigint;
  allowedPurposePrefixes: readonly string[];
  enabled: boolean;
}>;

export type PaymentIntent = Readonly<{
  intentId: string;
  agentId: string;
  rail: BitcoinRail;
  amountSats: bigint;
  purpose: string;
  recipient: string;
  createdAt: string;
}>;

export type Settlement = Readonly<{
  intentId: string;
  rail: BitcoinRail;
  amountSats: bigint;
  providerReference: string;
  settledAt: string;
}>;

export function assertSpendAllowed(
  policy: AgentSpendPolicy,
  intent: Pick<PaymentIntent, "agentId" | "amountSats" | "purpose">,
): void {
  if (!policy.enabled) throw new Error("BITCOIN_AGENT_RAIL_DISABLED");
  if (intent.agentId !== policy.agentId) throw new Error("AGENT_POLICY_MISMATCH");
  if (intent.amountSats <= 0n) throw new Error("INVALID_SATOSHI_AMOUNT");
  if (intent.amountSats > policy.perTransactionSats) {
    throw new Error("PER_TRANSACTION_LIMIT_EXCEEDED");
  }
  if (
    !policy.allowedPurposePrefixes.some((prefix) =>
      intent.purpose.startsWith(prefix),
    )
  ) {
    throw new Error("PURPOSE_NOT_ALLOWED");
  }
}

export function requiresHumanApproval(
  policy: AgentSpendPolicy,
  amountSats: bigint,
): boolean {
  return amountSats > policy.requireHumanApprovalAboveSats;
}

export function btcToSats(btc: string): bigint {
  if (!/^\d+(\.\d{1,8})?$/.test(btc)) throw new Error("INVALID_BTC_AMOUNT");
  const [whole, fraction = ""] = btc.split(".");
  return BigInt(whole) * SATOSHIS_PER_BTC + BigInt(fraction.padEnd(8, "0"));
}

export function satsToBtc(sats: bigint): string {
  if (sats < 0n) throw new Error("INVALID_SATOSHI_AMOUNT");
  const whole = sats / SATOSHIS_PER_BTC;
  const fraction = (sats % SATOSHIS_PER_BTC).toString().padStart(8, "0");
  return `${whole}.${fraction}`.replace(/\.0+$/, "");
}
