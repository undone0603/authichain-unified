import { TRPCError } from "@trpc/server";
import { planByAmountCents } from "../../src/lib/plans";
import { createPaymentCheckout, getStripe } from "../stripe-service";

/**
 * Three-tier model:
 *   1. Truth is free      — certificates.verify / getPublic stay public and ungated.
 *   2. Receipt is a fee   — recording a receipt (shareable public certificate) is a one-time charge.
 *   3. Evidence is paid   — the exportable proof bundle is a one-time charge.
 *
 * Stateless: a payment is a Stripe Checkout session tagged with metadata
 * (kind, certificateNumber, user_id) and re-verified server-side on use.
 * Off by default; set CERT_FEE_GATE=on to enforce.
 */

export type FeeKind = "receipt" | "evidence";

const DEFAULT_FEE_CENTS: Record<FeeKind, number> = {
  receipt: 199,
  // Must not equal any catalogue plan price: the Stripe webhook matches
  // one-time payments to plans by amount (planByAmountCents), so a collision
  // would provision a plan for a fee payer. $29 is Starter, hence $39.
  evidence: 3900,
};

const LABEL: Record<FeeKind, string> = {
  receipt: "AuthiChain receipt recording",
  evidence: "AuthiChain evidence bundle",
};

export function isFeeGateEnabled(): boolean {
  return process.env.CERT_FEE_GATE === "on";
}

export function feeCents(kind: FeeKind): number {
  const raw = Number(process.env[`CERT_${kind.toUpperCase()}_FEE_CENTS`]);
  const ok =
    Number.isInteger(raw) && raw > 0 && planByAmountCents(raw) === undefined;
  return ok ? raw : DEFAULT_FEE_CENTS[kind];
}

export async function createFeeCheckout(params: {
  kind: FeeKind;
  certificateNumber: string;
  user: { id: number; email?: string | null; name?: string | null };
  origin: string;
}) {
  return createPaymentCheckout({
    userId: params.user.id,
    userEmail: params.user.email ?? "",
    userName: params.user.name ?? "",
    description: `${LABEL[params.kind]} — ${params.certificateNumber}`,
    amount: feeCents(params.kind),
    origin: params.origin,
    returnPath: "/certificates",
    metadata: {
      kind: params.kind,
      certificateNumber: params.certificateNumber,
    },
  });
}

/**
 * Throws PAYMENT_REQUIRED-style FORBIDDEN unless the caller presents a paid
 * session for this exact user, certificate and fee kind. No-op when the gate is off.
 */
export async function requireFeePaid(params: {
  kind: FeeKind;
  certificateNumber: string;
  userId: number;
  sessionId?: string;
}): Promise<void> {
  if (!isFeeGateEnabled()) return;

  const deny = (message: string): never => {
    throw new TRPCError({ code: "FORBIDDEN", message });
  };

  if (!params.sessionId) deny(`Payment required: ${LABEL[params.kind]}`);

  const session = await getStripe().checkout.sessions.retrieve(
    params.sessionId!
  );
  const m = session.metadata ?? {};
  if (
    session.payment_status !== "paid" ||
    m.kind !== params.kind ||
    m.certificateNumber !== params.certificateNumber ||
    m.user_id !== String(params.userId)
  ) {
    deny(`Payment required: ${LABEL[params.kind]}`);
  }
}
