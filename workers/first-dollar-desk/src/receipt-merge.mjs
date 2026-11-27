/**
 * The same Base USDC transfer can be observed by the on-chain scanner and by
 * an x402 facilitator. Preserve the facilitator attribution and its status
 * rather than allowing a later raw scan to erase it.
 *
 * This is an in-process KV reconciliation guard, NOT distributed idempotency,
 * proof of payment response delivery, or proof of buyer independence.
 */
const TX_HASH = /^0x[0-9a-f]{64}$/i;

const normalizedTx = row => {
  const value = row?.txHash;
  return typeof value === 'string' && TX_HASH.test(value) ? value.toLowerCase() : null;
};
const isX402 = row => Boolean(row?.metadata?.x402);

export function sameReceiptIdentity(existing, incoming) {
  if (!existing || !incoming) return false;
  if (incoming.stripeChargeId && existing.stripeChargeId === incoming.stripeChargeId) return true;
  if (incoming.stripePaymentIntentId && existing.stripePaymentIntentId === incoming.stripePaymentIntentId) return true;
  if (incoming.stripeCheckoutSessionId && existing.stripeCheckoutSessionId === incoming.stripeCheckoutSessionId) return true;
  if (incoming.id && existing.id === incoming.id) return true;
  const oldTx = normalizedTx(existing);
  const newTx = normalizedTx(incoming);
  if (!oldTx || oldTx !== newTx) return false;
  if (existing.network && incoming.network && existing.network !== incoming.network) return false;
  return true;
}

export function mergeReceiptEvidence(existing, incoming) {
  if (!existing || !incoming) return incoming ?? existing;
  const oldTx = normalizedTx(existing);
  const newTx = normalizedTx(incoming);
  const sameTx = oldTx !== null && oldTx === newTx &&
    (!existing.network || !incoming.network || existing.network === incoming.network);

  if (sameTx) {
    const oldX402 = isX402(existing);
    const newX402 = isX402(incoming);
    // A chain scan must never demote an attributed facilitator receipt.
    if (oldX402 && !newX402) return existing;
    // Preserve the exact x402 receipt and prefer it over a raw chain scan.
    if (!oldX402 && newX402) return incoming;
    // Replays from a different receipt id cannot overwrite the first owner.
    if (oldX402 && newX402 && existing.id !== incoming.id) return existing;
    // A retry with a pending facilitator result cannot retract a settled one.
    if (oldX402 && newX402 && existing.status === 'qualified' && incoming.status === 'pending') return existing;
  }
  return { ...existing, ...incoming };
}

export function upsertLedgerReceipt(receipts, incoming) {
  const next = Array.isArray(receipts) ? [...receipts] : [];
  const index = next.findIndex(item => sameReceiptIdentity(item, incoming));
  if (index >= 0) {
    next[index] = mergeReceiptEvidence(next[index], incoming);
  } else {
    next.unshift(incoming);
  }
  return next;
}
