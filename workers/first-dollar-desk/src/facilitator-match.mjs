/**
 * Only an exact facilitator-provided transaction reference may associate a
 * pending x402 receipt with an on-chain transfer. Time/amount proximity is
 * not payment attribution: scheduled/self-funded transfers can look identical.
 *
 * A verified transaction hash may be reserved for at most one x402 receipt
 * during a reconciliation pass; existing x402 receipt hashes are reserved
 * up front. This is fail-closed matching, not proof of buyer independence,
 * paid HTTP fulfillment, or cross-worker atomic idempotency.
 */
const TX_HASH = /^0x[0-9a-f]{64}$/i;

export function reservedFacilitatorTxHashes(receipts) {
  const reserved = new Set();
  if (!Array.isArray(receipts)) return reserved;
  for (const receipt of receipts) {
    if (receipt?.metadata?.x402 &&
        typeof receipt.txHash === 'string' && TX_HASH.test(receipt.txHash)) {
      reserved.add(receipt.txHash.toLowerCase());
    }
  }
  return reserved;
}

export function matchPendingFacilitatorReceipt(pending, candidates, reservedTxHashes = new Set()) {
  const hint = pending?.metadata?.facilitatorTxHint;
  if (typeof hint !== 'string' || !TX_HASH.test(hint)) return null;
  if (!(reservedTxHashes instanceof Set) || !Array.isArray(candidates)) return null;
  const hash = hint.toLowerCase();
  if (reservedTxHashes.has(hash)) return null;
  const match = candidates.find(candidate => {
    if (typeof candidate?.txHash !== 'string') return false;
    if (candidate.txHash.toLowerCase() !== hash) return false;
    if (candidate.amountCents !== pending.amountCents) return false;
    if (pending.network && candidate.network !== pending.network) return false;
    if (pending.wallet &&
        String(candidate.wallet ?? '').toLowerCase() !== String(pending.wallet).toLowerCase()) return false;
    return true;
  }) ?? null;
  if (match) reservedTxHashes.add(hash);
  return match;
}
