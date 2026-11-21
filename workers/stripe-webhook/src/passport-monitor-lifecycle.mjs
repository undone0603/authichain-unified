/**
 * Passport Monitor $79/month -- deterministic, storage-independent lifecycle.
 * DORMANT: do not attach to live webhook or verification routes until an atomic,
 * durable event ledger and an authenticated quota-consumption API are reviewed.
 * Storage must transactionally compare version and persist event ID with state.
 */
export const PASSPORT_MONITOR_PRICE_ID = 'price_1USJytGqTruSqV8TpbDuW6bH';
export const PASSPORT_MONITOR_INCLUDED = 300;

const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{3,128}$/.test(value);
const validTime = value => Number.isInteger(value) && value >= 0;
const empty = () => ({ status: 'inactive', customerId: null, subscriptionId: null, periodStart: null, periodEnd: null, used: 0, lastInvoiceId: null });

/** Pure transition; event IDs must be claimed atomically by the durable adapter. */
export function transition(current, event) {
  if (!event || !validId(event.id) || !validId(event.customerId) || !validId(event.subscriptionId)) return { ok: false, reason: 'invalid_identity' };
  if (event.priceId !== PASSPORT_MONITOR_PRICE_ID) return { ok: false, reason: 'unmapped_price' };
  const state = current ? { ...current } : empty();
  if (state.customerId && state.customerId !== event.customerId) return { ok: false, reason: 'customer_mismatch' };
  if (state.subscriptionId && state.subscriptionId !== event.subscriptionId) return { ok: false, reason: 'subscription_mismatch' };

  if (event.type === 'invoice.paid') {
    if (!validId(event.invoiceId) || !Number.isInteger(event.amountPaid) || event.amountPaid <= 0 ||
        event.currency !== 'usd' || !validTime(event.periodStart) || !validTime(event.periodEnd) || event.periodEnd <= event.periodStart) {
      return { ok: false, reason: 'unsettled_or_invalid_invoice' };
    }
    if (state.status === 'cancelled') return { ok: false, reason: 'cancelled_terminal' };
    if (state.lastInvoiceId === event.invoiceId) return { ok: true, action: 'unchanged', state };
    if (state.periodStart !== null && event.periodStart < state.periodStart) return { ok: false, reason: 'stale_invoice' };
    if (state.periodStart !== null && event.periodStart === state.periodStart) {
      // A successfully paid retry in the SAME period may restore access after
      // past_due, but must not reset already consumed verifications. Only an
      // authenticated, durable webhook adapter may call this transition.
      if (state.status === 'past_due') return { ok: true, action: 'restored', state: { ...state, status: 'active', lastInvoiceId: event.invoiceId } };
      return { ok: true, action: 'unchanged', state };
    }
    return { ok: true, action: 'activated', state: {
      status: 'active', customerId: event.customerId, subscriptionId: event.subscriptionId,
      periodStart: event.periodStart, periodEnd: event.periodEnd, used: 0, lastInvoiceId: event.invoiceId,
    }};
  }
  if (!state.subscriptionId) return { ok: false, reason: 'subscription_not_active' };
  if (event.type === 'invoice.payment_failed') {
    if (state.status === 'cancelled') return { ok: true, action: 'unchanged', state };
    return { ok: true, action: 'suspended', state: { ...state, status: 'past_due' } };
  }
  if (event.type === 'customer.subscription.deleted') {
    return { ok: true, action: 'cancelled', state: { ...state, status: 'cancelled' } };
  }
  return { ok: false, reason: 'unsupported_event' };
}

/** Deny without fresh subscription, valid period, and remaining quota. */
export function canVerify(state, nowSeconds) {
  if (!state || state.status !== 'active' || !validTime(nowSeconds) ||
      !validTime(state.periodStart) || !validTime(state.periodEnd) ||
      nowSeconds < state.periodStart || nowSeconds >= state.periodEnd) return false;
  return Number.isInteger(state.used) && state.used >= 0 && state.used < PASSPORT_MONITOR_INCLUDED;
}

/** A pure candidate for an atomic authenticated consumption transaction. */
export function consumeOne(state, nowSeconds) {
  if (!canVerify(state, nowSeconds)) return { ok: false, reason: 'quota_or_status_denied' };
  return { ok: true, state: { ...state, used: state.used + 1 } };
}
