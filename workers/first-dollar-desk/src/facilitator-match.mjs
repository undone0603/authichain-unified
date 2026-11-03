/**
 * Only an exact facilitator-provided transaction reference may associate a
 * pending x402 receipt with an on-chain transfer. Time/amount proximity is
 * not payment attribution: scheduled/self-funded transfers can look identical.
 *
 * This matcher never qualifies a receipt by itself. The caller must preserve
 * its existing signed-facilitator and owner-wallet guards.
 */
export function matchPendingFacilitatorReceipt(pending, candidates) {
  const hint = pending?.metadata?.facilitatorTxHint;
  if (typeof hint !== "string" || !/^0x[0-9a-f]{64}$/i.test(hint)) {
    return null;
  }
  const hash = hint.toLowerCase();
  return (
    candidates.find((candidate) => {
      if (typeof candidate.txHash !== "string") return false;
      if (candidate.txHash.toLowerCase() !== hash) return false;
      if (candidate.amountCents !== pending.amountCents) return false;
      if (pending.network && candidate.network !== pending.network) return false;
      if (
        pending.wallet &&
        String(candidate.wallet ?? "").toLowerCase() !== String(pending.wallet).toLowerCase()
      ) return false;
      return true;
    }) ?? null
  );
}
