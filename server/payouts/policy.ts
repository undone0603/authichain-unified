// Pure payout policy — no DB, no network. All the safety-critical decisions
// (idempotency, amount caps, what is allowed to execute) live here so they can
// be unit-tested exhaustively. server/payouts/service.ts wires these to the DB
// and the actual transfer rails.

export type PayoutRail = "stripe_connect" | "qron_onchain" | "buyback_burn";

export type PayoutStatus =
  | "pending_approval"
  | "approved"
  | "processing"
  | "paid"
  | "failed"
  | "rejected"
  | "held";

export interface PayoutIntent {
  rail: PayoutRail;
  amount: number;              // USD for fiat; token units for on-chain
  currency: string;
  destination: string | null;  // connected acct / wallet (null only for burn)
  userId?: number | null;
  referenceType: string;
  referenceId: string;
  metadata?: Record<string, unknown>;
}

export interface PayoutCaps {
  maxPerItem: number;
  maxPerRun: number;
}

/**
 * Deterministic idempotency key for a payout. The DB column is UNIQUE on this,
 * so two preparation runs over the same source row collide and the second is a
 * no-op — the core defense against double-paying.
 */
export function deriveIdempotencyKey(referenceType: string, referenceId: string): string {
  return `${referenceType}:${referenceId}`;
}

export interface CapDecision {
  allowed: PayoutIntent[];
  held: Array<{ intent: PayoutIntent; reason: string }>;
}

/**
 * Split intents into those that may proceed and those held for manual review.
 * A single item over maxPerItem is held. Once the cumulative approved total
 * would exceed maxPerRun, every subsequent item is held too (we do not
 * cherry-pick smaller items past the cap — the run stops spending).
 */
export function enforceCaps(intents: PayoutIntent[], caps: PayoutCaps): CapDecision {
  const allowed: PayoutIntent[] = [];
  const held: Array<{ intent: PayoutIntent; reason: string }> = [];
  let runningTotal = 0;
  let capReached = false;

  for (const intent of intents) {
    if (!(intent.amount > 0)) {
      held.push({ intent, reason: "non-positive amount" });
      continue;
    }
    if (intent.amount > caps.maxPerItem) {
      held.push({ intent, reason: `exceeds per-item cap (${caps.maxPerItem})` });
      continue;
    }
    if (capReached || runningTotal + intent.amount > caps.maxPerRun) {
      capReached = true;
      held.push({ intent, reason: `would exceed per-run cap (${caps.maxPerRun})` });
      continue;
    }
    runningTotal += intent.amount;
    allowed.push(intent);
  }

  return { allowed, held };
}

export interface ExecuteGate {
  payoutsEnabled: boolean;
}

export type ExecuteDecision =
  | { execute: true }
  | { execute: false; reason: string };

/**
 * Decide whether a single queued payout may actually move funds. Requires the
 * global kill-switch on, an approved status, and a destination for non-burn
 * rails. This is the last gate before a real transfer.
 */
export function decideExecution(
  payout: { status: PayoutStatus; rail: PayoutRail; destination: string | null; amount: number },
  gate: ExecuteGate,
): ExecuteDecision {
  if (!gate.payoutsEnabled) {
    return { execute: false, reason: "PAYOUTS_ENABLED is not true" };
  }
  if (payout.status !== "approved") {
    return { execute: false, reason: `status is ${payout.status}, not approved` };
  }
  if (!(payout.amount > 0)) {
    return { execute: false, reason: "non-positive amount" };
  }
  if (payout.rail !== "buyback_burn" && !payout.destination) {
    return { execute: false, reason: "missing destination" };
  }
  return { execute: true };
}
