/**
 * Explicit owner/self-test payment exclusion.
 *
 * Revenue, watchdogs, and first-sale logic must not treat house smoke charges
 * as customer sales. Identification is only:
 *   1. Stripe metadata flags (test_payment=owner, is_self_test, purpose)
 *   2. Allowlisted charge / payment_intent / customer / visit ids in
 *      ops/reconcile/excluded-test-payments.json
 *
 * Do not match personal emails or addresses here.
 */

import allowlistFile from "../../../ops/reconcile/excluded-test-payments.json";

type ExcludedTestPaymentsFile = {
  ids?: readonly string[];
  customer_ids?: readonly string[];
  visit_ids?: readonly string[];
};

const file = allowlistFile as ExcludedTestPaymentsFile;

function collectIds(values: readonly string[] | undefined): string[] {
  return (values ?? []).map(id => id.trim()).filter(Boolean);
}

export const EXCLUDED_TEST_PAYMENT_IDS: readonly string[] = [
  ...collectIds(file.ids),
  ...collectIds(file.customer_ids),
  ...collectIds(file.visit_ids),
];

const ID_SET = new Set(EXCLUDED_TEST_PAYMENT_IDS);

/** Stripe metadata values are strings; boolean true is kept for in-app flags. */
export function isTrueFlag(value: unknown): boolean {
  return value === true || value === "true";
}

export function isOwnerTestMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const m = metadata as Record<string, unknown>;
  if (
    isTrueFlag(m.is_demo) ||
    isTrueFlag(m.demo) ||
    isTrueFlag(m.is_self_test)
  ) {
    return true;
  }
  if (m.test_payment === "owner") return true;
  if (m.purpose === "paid_smoke_10") return true;
  return false;
}

export function isExcludedTestId(id: unknown): boolean {
  return typeof id === "string" && ID_SET.has(id.trim());
}

export type OwnerTestChargeLike = {
  id?: string | null;
  payment_intent?: string | null;
  customer?: string | null;
  customer_id?: string | null;
  prospect_id?: string | null;
  client_reference_id?: string | null;
  metadata?: unknown;
};

function stripeId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const nested = (value as { id?: unknown }).id;
    return typeof nested === "string" ? nested : null;
  }
  return null;
}

function idsFrom(charge: OwnerTestChargeLike): Array<string | null> {
  const meta =
    charge.metadata && typeof charge.metadata === "object"
      ? (charge.metadata as Record<string, unknown>)
      : {};
  return [
    stripeId(charge.id),
    stripeId(charge.payment_intent),
    stripeId(charge.customer),
    stripeId(charge.customer_id),
    stripeId(charge.prospect_id),
    stripeId(charge.client_reference_id),
    stripeId(meta.charge),
    stripeId(meta.charge_id),
    stripeId(meta.payment_intent),
    stripeId(meta.customer),
    stripeId(meta.customer_id),
    stripeId(meta.visit_id),
    stripeId(meta.prospect_id),
    stripeId(meta.stripe_charge_id),
  ];
}

export function isOwnerTestCharge(charge: OwnerTestChargeLike): boolean {
  if (idsFrom(charge).some(isExcludedTestId)) return true;
  return isOwnerTestMetadata(charge.metadata);
}
