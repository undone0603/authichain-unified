// Payout pipeline — wires the pure policy (./policy.ts) to the DB and the real
// transfer rails. Flow:
//
//   prepare*  → enqueue source rows as `pending_approval` (idempotent)
//   dryRun    → preview amounts/caps, zero side effects
//   approve   → human marks a batch `approved`
//   execute   → ONLY approved rows, ONLY when PAYOUTS_ENABLED, move real funds
//
// Nothing in prepare/dryRun/approve moves money. execute is the single place a
// transfer happens, and it re-checks the kill-switch, the per-run/per-item
// caps, and per-row execution gating before every send.

import Stripe from "stripe";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { ENV } from "../_core/env";
import {
  affiliateCommissions,
  affiliates,
  payouts,
  qronRewardLedger,
  users,
} from "../../drizzle/schema";
import * as thirdweb from "../thirdweb";
import {
  deriveIdempotencyKey,
  enforceCaps,
  decideExecution,
  type PayoutIntent,
  type PayoutCaps,
} from "./policy";

function caps(): PayoutCaps {
  return { maxPerItem: ENV.payoutMaxPerItem, maxPerRun: ENV.payoutMaxPerRun };
}

// ─── Preparation: source rows → payout intents ───────────────────────────────

export async function collectAffiliateIntents(): Promise<PayoutIntent[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ commission: affiliateCommissions, affiliate: affiliates })
    .from(affiliateCommissions)
    .innerJoin(affiliates, eq(affiliateCommissions.affiliateId, affiliates.id))
    .where(eq(affiliateCommissions.status, "pending"));

  return rows.map(({ commission, affiliate }) => {
    const details = (affiliate.payoutDetails as { stripeConnectedAccountId?: string } | null) ?? null;
    return {
      rail: "stripe_connect" as const,
      amount: Number(commission.amount),
      currency: "usd",
      destination: details?.stripeConnectedAccountId ?? null,
      userId: affiliate.userId,
      referenceType: "affiliate_commission",
      referenceId: String(commission.id),
      metadata: { affiliateId: affiliate.id, payoutMethod: affiliate.payoutMethod },
    };
  });
}

export async function collectStakingIntents(): Promise<PayoutIntent[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ ledger: qronRewardLedger, user: users })
    .from(qronRewardLedger)
    .leftJoin(users, eq(qronRewardLedger.userId, users.id))
    .where(and(eq(qronRewardLedger.status, "pending"), eq(qronRewardLedger.reason, "staking_reward")));

  return rows.map(({ ledger, user }) => ({
    rail: "qron_onchain" as const,
    amount: Number(ledger.amount),
    currency: "QRON",
    destination: user?.walletAddress ?? null,
    userId: ledger.userId,
    referenceType: "staking_reward",
    referenceId: String(ledger.id),
  }));
}

async function collectAllIntents(): Promise<PayoutIntent[]> {
  const [aff, stake] = await Promise.all([collectAffiliateIntents(), collectStakingIntents()]);
  return [...aff, ...stake];
}

// ─── Enqueue (idempotent) ────────────────────────────────────────────────────

export async function enqueueIntents(intents: PayoutIntent[]): Promise<{ queued: number; skipped: number }> {
  const db = await getDb();
  if (!db) return { queued: 0, skipped: 0 };
  let queued = 0;
  let skipped = 0;
  for (const intent of intents) {
    const idempotencyKey = deriveIdempotencyKey(intent.referenceType, intent.referenceId);
    const inserted = await db
      .insert(payouts)
      .values({
        rail: intent.rail,
        amount: String(intent.amount),
        currency: intent.currency,
        destination: intent.destination,
        userId: intent.userId ?? null,
        referenceType: intent.referenceType,
        referenceId: intent.referenceId,
        idempotencyKey,
        status: "pending_approval",
        metadata: intent.metadata ?? null,
      })
      .onConflictDoNothing({ target: payouts.idempotencyKey })
      .returning({ id: payouts.id });
    if (inserted.length > 0) queued++;
    else skipped++;
  }
  return { queued, skipped };
}

/** Prepare (enqueue) all eligible payouts. Moves no funds. */
export async function preparePayouts(): Promise<{ queued: number; skipped: number; intents: number }> {
  const intents = await collectAllIntents();
  const res = await enqueueIntents(intents);
  return { ...res, intents: intents.length };
}

// ─── Dry-run preview (no writes) ─────────────────────────────────────────────

export async function dryRunReport() {
  const intents = await collectAllIntents();
  const { allowed, held } = enforceCaps(intents, caps());
  const sum = (xs: PayoutIntent[]) => xs.reduce((t, i) => t + (i.amount > 0 ? i.amount : 0), 0);
  const byRail = (xs: PayoutIntent[]) =>
    xs.reduce<Record<string, { count: number; total: number }>>((m, i) => {
      const r = (m[i.rail] ??= { count: 0, total: 0 });
      r.count++;
      r.total += i.amount;
      return m;
    }, {});
  return {
    payoutsEnabled: ENV.payoutsEnabled,
    caps: caps(),
    totalIntents: intents.length,
    allowed: { count: allowed.length, total: sum(allowed), byRail: byRail(allowed) },
    held: held.map(h => ({ ref: `${h.intent.referenceType}:${h.intent.referenceId}`, amount: h.intent.amount, reason: h.reason })),
  };
}

// ─── Listing (for the admin panel) ───────────────────────────────────────────

export async function listPayouts(opts: { statuses?: string[]; limit?: number } = {}) {
  const db = await getDb();
  if (!db) return [];
  const limit = Math.min(opts.limit ?? 100, 500);
  const base = db.select().from(payouts);
  const rows = opts.statuses && opts.statuses.length > 0
    ? await base.where(inArray(payouts.status, opts.statuses)).limit(limit)
    : await base.limit(limit);
  return rows.sort((a, b) => b.id - a.id);
}

// ─── Approval ────────────────────────────────────────────────────────────────

export async function approvePayouts(ids: number[], approverUserId: number): Promise<number> {
  const db = await getDb();
  if (!db || ids.length === 0) return 0;
  const updated = await db
    .update(payouts)
    .set({ status: "approved", approvedBy: approverUserId, approvedAt: new Date(), updatedAt: new Date() })
    .where(and(inArray(payouts.id, ids), eq(payouts.status, "pending_approval")))
    .returning({ id: payouts.id });
  return updated.length;
}

// ─── Execution (the only place funds move) ───────────────────────────────────

let _stripe: Stripe | null = null;
function stripeClient(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
    _stripe = new Stripe(key, { apiVersion: "2025-03-31.basil" as any });
  }
  return _stripe;
}

export interface ExecuteSummary {
  attempted: number;
  paid: number;
  failed: number;
  held: number;
  skipped?: string;
}

export async function executeApprovedPayouts(): Promise<ExecuteSummary> {
  if (!ENV.payoutsEnabled) {
    return { attempted: 0, paid: 0, failed: 0, held: 0, skipped: "PAYOUTS_ENABLED is not true" };
  }
  const db = await getDb();
  if (!db) return { attempted: 0, paid: 0, failed: 0, held: 0, skipped: "no database" };

  const approved = await db.select().from(payouts).where(eq(payouts.status, "approved"));

  // Re-apply caps across this run as a circuit breaker, even on approved rows.
  const intents: PayoutIntent[] = approved.map(p => ({
    rail: p.rail as PayoutIntent["rail"],
    amount: Number(p.amount),
    currency: p.currency ?? "usd",
    destination: p.destination,
    referenceType: p.referenceType ?? "",
    referenceId: p.referenceId ?? String(p.id),
  }));
  const { allowed } = enforceCaps(intents, caps());
  const allowedKeys = new Set(allowed.map(i => deriveIdempotencyKey(i.referenceType, i.referenceId)));

  let paid = 0;
  let failed = 0;
  let held = 0;
  let attempted = 0;

  for (const p of approved) {
    const key = deriveIdempotencyKey(p.referenceType ?? "", p.referenceId ?? String(p.id));
    if (!allowedKeys.has(key)) {
      await db.update(payouts).set({ status: "held", failureReason: "exceeds run/item cap", updatedAt: new Date() }).where(eq(payouts.id, p.id));
      held++;
      continue;
    }

    const decision = decideExecution(
      { status: "approved", rail: p.rail as PayoutIntent["rail"], destination: p.destination, amount: Number(p.amount) },
      { payoutsEnabled: ENV.payoutsEnabled },
    );
    if (!decision.execute) {
      await db.update(payouts).set({ status: "held", failureReason: decision.reason, updatedAt: new Date() }).where(eq(payouts.id, p.id));
      held++;
      continue;
    }

    // Claim the row (approved → processing) to avoid a concurrent executor
    // double-sending. Only proceed if we actually flipped it.
    const claimed = await db
      .update(payouts)
      .set({ status: "processing", updatedAt: new Date() })
      .where(and(eq(payouts.id, p.id), eq(payouts.status, "approved")))
      .returning({ id: payouts.id });
    if (claimed.length === 0) continue;

    attempted++;
    try {
      const txRef = await executeOne(p);
      await db.update(payouts).set({ status: "paid", txRef, updatedAt: new Date() }).where(eq(payouts.id, p.id));
      await markSourcePaid(db, p.referenceType, p.referenceId);
      paid++;
    } catch (err: any) {
      await db.update(payouts).set({ status: "failed", failureReason: String(err?.message ?? err).slice(0, 500), updatedAt: new Date() }).where(eq(payouts.id, p.id));
      failed++;
    }
  }

  return { attempted, paid, failed, held };
}

/** Perform the actual transfer for one payout. Returns a tx reference. */
async function executeOne(p: typeof payouts.$inferSelect): Promise<string> {
  switch (p.rail) {
    case "stripe_connect": {
      if (!p.destination) throw new Error("missing connected account");
      const transfer = await stripeClient().transfers.create(
        {
          amount: Math.round(Number(p.amount) * 100),
          currency: (p.currency ?? "usd").toLowerCase(),
          destination: p.destination,
          transfer_group: `payout_${p.id}`,
        },
        { idempotencyKey: p.idempotencyKey ?? undefined },
      );
      return transfer.id;
    }
    case "qron_onchain": {
      if (!p.destination) throw new Error("missing wallet address");
      const res = await thirdweb.transferErc20({ to: p.destination, amount: Number(p.amount) });
      return res.transactionHash;
    }
    case "buyback_burn": {
      const res = await thirdweb.burnErc20({ amount: Number(p.amount) });
      return res.transactionHash;
    }
    default:
      throw new Error(`unknown rail: ${p.rail}`);
  }
}

async function markSourcePaid(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  referenceType: string | null,
  referenceId: string | null,
): Promise<void> {
  if (!referenceId) return;
  const id = parseInt(referenceId, 10);
  if (isNaN(id)) return;
  if (referenceType === "affiliate_commission") {
    await db.update(affiliateCommissions).set({ status: "paid", paidAt: new Date() }).where(eq(affiliateCommissions.id, id));
  } else if (referenceType === "staking_reward") {
    await db.update(qronRewardLedger).set({ status: "paid" }).where(eq(qronRewardLedger.id, id));
  }
}
