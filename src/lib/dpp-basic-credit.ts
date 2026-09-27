/**
 * $299 DPP Readiness → AuthiChain Basic first-invoice credit.
 * Idempotent ledger helpers. Hook from existing POST /api/stripe/webhook.
 * Does not create a Stripe Coupon or start Basic by itself.
 */
import { DPP_BASIC_CREDIT_USD } from "./entitlements";

export type CreditStatus = "open" | "applied" | "void";

export type DppBasicCredit = {
  id: string;
  email: string;
  source_plan: "dpp_readiness";
  source_session_id: string;
  amount_usd: number;
  status: CreditStatus;
  created_at: string;
  applied_session_id?: string;
};

export function creditIdempotencyKey(sessionId: string): string {
  return `dpp_basic_credit:${sessionId}`;
}

export function openCreditFromDppSession(opts: {
  email: string;
  sessionId: string;
  now?: Date;
}): DppBasicCredit {
  const sessionId = opts.sessionId.trim();
  const email = opts.email.trim().toLowerCase();
  if (!sessionId) throw new Error("session_id required");
  if (!email || !email.includes("@")) throw new Error("work email required");
  return {
    id: creditIdempotencyKey(sessionId),
    email,
    source_plan: "dpp_readiness",
    source_session_id: sessionId,
    amount_usd: DPP_BASIC_CREDIT_USD,
    status: "open",
    created_at: (opts.now ?? new Date()).toISOString(),
  };
}

export function applyCreditToBasic(opts: {
  credit: DppBasicCredit;
  basicSessionId: string;
}): DppBasicCredit {
  if (opts.credit.status === "applied") return opts.credit;
  if (opts.credit.status === "void") {
    throw new Error("credit_void");
  }
  return {
    ...opts.credit,
    status: "applied",
    applied_session_id: opts.basicSessionId,
  };
}
