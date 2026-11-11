export type MismatchClass =
  | "MISSING_IN_LEDGER" | "MISSING_IN_STRIPE" | "AMOUNT_MISMATCH"
  | "STATUS_MISMATCH" | "WEBHOOK_ERROR" | "PAYOUT_DRIFT";

/** Ids and class only. Never PII. */
export interface Mismatch { class: MismatchClass; id: string }

export interface StripeCharge {
  id: string; payment_intent: string | null; amount: number; amount_refunded: number;
  currency: string; status: string; refunded: boolean; livemode: boolean;
  metadata?: Record<string, string>;
}
export interface StripeSession { id: string; payment_intent: string | null; livemode: boolean; status: string }
export interface StripePayout { id: string; amount: number; livemode: boolean; balance_txn_sum: number }
export interface LedgerPayment { session_id: string; amount_cents: number; currency: string; status: string }
export interface StripeEventRow { event_id: string; event_type: string; status?: string | null }

export interface ReconInput {
  windowStart: string; windowEnd: string;
  charges: StripeCharge[]; sessions: StripeSession[]; payouts: StripePayout[];
  ledger: LedgerPayment[]; events: StripeEventRow[]; allowlist: string[];
}
export interface ReconSummary {
  window_start: string; window_end: string;
  stripe_charge_count: number; stripe_charge_sum_cents: number;
  stripe_refund_sum_cents: number; stripe_payout_sum_cents: number;
  ledger_count: number; ledger_sum_cents: number;
  mismatch_count: number; mismatches: Mismatch[];
  excluded_test_count: number; customer_revenue_cents: number;
  status: "ok" | "mismatch" | "error";
}
