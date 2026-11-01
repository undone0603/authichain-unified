import type { Mismatch, ReconInput, ReconSummary, StripeCharge } from "./types";

export function isExcluded(c: StripeCharge, allow: Set<string>): boolean {
  return allow.has(c.id) || (!!c.payment_intent && allow.has(c.payment_intent)) ||
    c.metadata?.test_payment === "owner";
}

/** Pure function: no I/O. Output holds ids + class only. */
export function reconcile(input: ReconInput): ReconSummary {
  const allow = new Set(input.allowlist);
  const mismatches: Mismatch[] = [];
  const add = (cls: Mismatch["class"], id: string) => mismatches.push({ class: cls, id });

  const live = input.charges.filter((c) => c.livemode && c.status === "succeeded");
  const excluded = live.filter((c) => isExcluded(c, allow));
  const counted = live.filter((c) => !isExcluded(c, allow));
  const excludedPis = new Set(excluded.map((c) => c.payment_intent).filter(Boolean) as string[]);

  const sessionByPi = new Map<string, string>();
  const liveSessionIds = new Set<string>();
  for (const s of input.sessions) {
    if (!s.livemode || s.status !== "complete") continue;
    liveSessionIds.add(s.id);
    if (s.payment_intent) sessionByPi.set(s.payment_intent, s.id);
  }
  const ledgerBySession = new Map(input.ledger.map((p) => [p.session_id, p]));
  const matchedSessions = new Set<string>();

  for (const c of counted) {
    const sid = c.payment_intent ? sessionByPi.get(c.payment_intent) : undefined;
    const row = sid ? ledgerBySession.get(sid) : undefined;
    if (!row) { add("MISSING_IN_LEDGER", c.id); continue; }
    matchedSessions.add(sid!);
    if (row.amount_cents !== c.amount || row.currency.toLowerCase() !== c.currency.toLowerCase())
      add("AMOUNT_MISMATCH", c.id);
    const stripeRefunded = c.refunded || c.amount_refunded > 0;
    if (stripeRefunded !== (row.status === "refunded")) add("STATUS_MISMATCH", c.id);
  }

  const excludedSessions = new Set(
    input.sessions.filter((s) => s.payment_intent && excludedPis.has(s.payment_intent)).map((s) => s.id));
  for (const p of input.ledger) {
    if (matchedSessions.has(p.session_id) || excludedSessions.has(p.session_id)) continue;
    if (p.status === "paid" || p.status === "refunded") {
      if (!liveSessionIds.has(p.session_id)) add("MISSING_IN_STRIPE", p.session_id);
    }
  }

  for (const e of input.events) if (e.status === "error") add("WEBHOOK_ERROR", e.event_id);

  const livePayouts = input.payouts.filter((p) => p.livemode);
  for (const p of livePayouts) if (p.amount !== p.balance_txn_sum) add("PAYOUT_DRIFT", p.id);

  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const chargeSum = sum(counted.map((c) => c.amount));
  const refundSum = sum(counted.map((c) => c.amount_refunded));
  return {
    window_start: input.windowStart, window_end: input.windowEnd,
    stripe_charge_count: counted.length, stripe_charge_sum_cents: chargeSum,
    stripe_refund_sum_cents: refundSum,
    stripe_payout_sum_cents: sum(livePayouts.map((p) => p.amount)),
    ledger_count: input.ledger.length,
    ledger_sum_cents: sum(input.ledger.map((p) => p.amount_cents)),
    mismatch_count: mismatches.length, mismatches,
    excluded_test_count: excluded.length,
    customer_revenue_cents: chargeSum - refundSum,
    status: mismatches.length ? "mismatch" : "ok",
  };
}
