/** Deployment block of AuthiChainNFT on Polygon. */
export const DEPLOYED_BLOCK = 77_535_676n;

/**
 * Recent eth_getLogs of this width succeed on polygon-bor-rpc.publicnode.com.
 * polygon.drpc.org rejects a distance above 100 blocks. Older ranges on
 * publicnode return an archive error, so this is not history back to deployment.
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
