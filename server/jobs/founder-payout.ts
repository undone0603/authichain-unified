// server/jobs/founder-payout.ts
// Pay-yourself-first (Profit First) split. Pure computation of how collected
// revenue is allocated — founder pay + tax/profit reserves come OFF THE TOP,
// the remainder is the operating budget. The actual transfer (Stripe payout to
// the founder's connected bank) is the credential-gated integration point: it
// needs a verified bank + payout config before any money moves.
import { logActivity, getRevenueAnalytics } from "../db";
import { notifyOwner } from "../_core/notification";

export interface PayoutSplit {
  founderPct: number;
  taxReservePct: number;
  profitReservePct: number;
}

export interface PayoutPlan {
  grossCents: number;
  founderCents: number;
  taxReserveCents: number;
  profitReserveCents: number;
  operatingCents: number;
}

const clampPct = (n: number, fallback: number): number =>
  Number.isFinite(n) && n >= 0 && n <= 100 ? n : fallback;

/** Split percentages, overridable via env (FOUNDER_PAY_PCT / TAX_RESERVE_PCT / PROFIT_RESERVE_PCT). */
export function defaultSplit(): PayoutSplit {
  return {
    founderPct: clampPct(Number(process.env.FOUNDER_PAY_PCT), 30),
    taxReservePct: clampPct(Number(process.env.TAX_RESERVE_PCT), 25),
    profitReservePct: clampPct(Number(process.env.PROFIT_RESERVE_PCT), 5),
  };
}

/**
 * Pure split. Founder + reserves are rounded; operating is the exact remainder
 * so cents are never lost to rounding. Throws on invalid input.
 */
export function computePayout(grossCents: number, split: PayoutSplit = defaultSplit()): PayoutPlan {
  if (!Number.isFinite(grossCents) || grossCents < 0) {
    throw new Error("computePayout: gross must be a non-negative number");
  }
  if (split.founderPct + split.taxReservePct + split.profitReservePct > 100) {
    throw new Error("computePayout: split percentages exceed 100");
  }
  const gross = Math.round(grossCents);
  const founderCents = Math.round((gross * split.founderPct) / 100);
  const taxReserveCents = Math.round((gross * split.taxReservePct) / 100);
  const profitReserveCents = Math.round((gross * split.profitReservePct) / 100);
  const operatingCents = gross - founderCents - taxReserveCents - profitReserveCents;
  return { grossCents: gross, founderCents, taxReserveCents, profitReserveCents, operatingCents };
}

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * Compute the pay-yourself-first split for a period's collected revenue, log it,
 * and notify the owner. Pass the gross collected (in cents) for the period.
 *
 * INTEGRATION POINT: trigger a Stripe payout of `plan.founderCents` to the
 * founder's connected account where indicated, once payout/bank is configured.
 */
export async function runFounderPayout(grossCents: number): Promise<PayoutPlan> {
  const plan = computePayout(grossCents);

  await logActivity({
    userId: null,
    action: "founder_payout_computed",
    entityType: "payout",
    entityId: 0,
    details: plan,
  });

  // TODO(integration): Stripe payout of plan.founderCents -> founder bank here.

  try {
    await notifyOwner({
      title: "Founder pay-yourself-first",
      content:
        `Gross ${dollars(plan.grossCents)} → Founder ${dollars(plan.founderCents)}, ` +
        `Tax reserve ${dollars(plan.taxReserveCents)}, Profit ${dollars(plan.profitReserveCents)}, ` +
        `Operating ${dollars(plan.operatingCents)}.`,
    });
  } catch {
    // A failed notification must not block the computation/logging.
  }

  return plan;
}

/** UTC date range covering the entire previous calendar month. */
export function lastMonthRange(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0) - 1);
  return { start, end };
}

/** Sum real collected revenue (revenueRecords.amount is in dollars) for a window, in cents. */
export async function collectedRevenueCents(start: Date, end: Date): Promise<number> {
  const rows = await getRevenueAnalytics(start, end);
  const dollarsTotal = (rows as Array<{ amount?: string | null }>).reduce(
    (sum, r) => sum + (parseFloat(r?.amount ?? "0") || 0),
    0,
  );
  return Math.round(dollarsTotal * 100);
}

/** Monthly entry point: read last month's collected revenue and run the split. */
export async function runMonthlyFounderPayout(now: Date = new Date()): Promise<PayoutPlan> {
  const { start, end } = lastMonthRange(now);
  const grossCents = await collectedRevenueCents(start, end);
  return runFounderPayout(grossCents);
}
