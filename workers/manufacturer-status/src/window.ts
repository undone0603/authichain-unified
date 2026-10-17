/** Deployment block of AuthiChainNFT on Polygon. */
export const DEPLOYED_BLOCK = 77_535_676n;

/**
 * polygon.drpc.org's free plan rejects eth_getLogs ranges over 10,000 blocks.
 * polygon-rpc.com answers 401 without a key.
 */
export const FREE_RPC_SPAN = 10_000n;

export function logFromBlock(
  current: bigint,
  deployed: bigint = DEPLOYED_BLOCK,
  span: bigint = FREE_RPC_SPAN
): bigint {
  if (current <= 0n) return 0n;
  const earliest = current > span ? current - span : 0n;
  if (current <= deployed) return earliest;
  return earliest > deployed ? earliest : deployed;
}
