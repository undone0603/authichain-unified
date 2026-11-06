/**
 * Resume on-chain scanning from the last successfully examined block.
 * A bounded catch-up pass MUST NOT jump to the newest chain tip if it
 * stopped before reaching that tip, or incoming transfers may be skipped.
 * This only controls scanning; it never marks a payment qualified.
 */
export function nextOnchainScanFrom(latestBlock, scannedThrough, overlapBlocks = 250n) {
  const decimal = value =>
    typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : null;
  const latest = decimal(latestBlock);
  const through = decimal(scannedThrough);
  let overlap;
  try {
    overlap = BigInt(overlapBlocks);
  } catch {
    return null;
  }
  if (latest === null || through === null || through > latest || overlap < 0n) {
    return null;
  }
  if (through < latest) return (through + 1n).toString();
  return (latest > overlap ? latest - overlap : 0n).toString();
}
