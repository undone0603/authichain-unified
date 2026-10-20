/** Deployment block of AuthiChainNFT on Polygon. */
export const DEPLOYED_BLOCK = 77_535_676n;

/**
 * Recent eth_getLogs of this width succeed on polygon-bor-rpc.publicnode.com.
 * polygon.drpc.org rejects a distance above 100 blocks. Older ranges on
 * publicnode return an archive error, so this is not history back to deployment.
 */
export const FREE_RPC_SPAN = 10_000n;

/** keccak256 of the AccessControl role name. DEFAULT_ADMIN_ROLE is the zero word. */
export const ROLE_IDS = {
  admin: "0x0000000000000000000000000000000000000000000000000000000000000000",
  minter: "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6",
  updater: "0x73e573f9566d61418a34d5de3ff49360f9c51fec37f7486551670290f6285dab",
  pauser: "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a",
} as const;

/** A 20-byte account, lowercased. A topic or any other string is not an account. */
export function senderAddress(value: string | undefined): string {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) return "";
  return value.toLowerCase();
}

/** Last 20 bytes of an indexed address topic. Anything else is not an address. */
export function addressFromTopic(topic: string | undefined): string {
  if (!topic || !/^0x[0-9a-fA-F]{64}$/.test(topic)) return "";
  return "0x" + topic.slice(-40).toLowerCase();
}

/** AccessControl topic to a role name. An unrecognized topic stays "unknown". */
export function roleName(topic: string): string {
  const normalized = topic.toLowerCase();
  for (const [name, id] of Object.entries(ROLE_IDS)) {
    if (id === normalized) return name;
  }
  return "unknown";
}

/** keccak256 of the contract event signatures. Not function selectors. */
export const EVENT_TOPICS = {
  roleGranted:
    "0x2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d",
  roleRevoked:
    "0xf6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b",
  manufacturerVerified:
    "0x50d2f63d0768a218414c666031d609d1b298f9801478a36d0bfcfb6abfd63a64",
  manufacturerRevoked:
    "0xe8d2a3ac660549a08f637582b6cbe854156af7ef2042247240ffc1fd34db7bcd",
} as const;

export const HISTORY_DISCLAIMER =
  "Current role flags are hasRole and isManufacturerVerified on the contract. " +
  "manufacturerVerified is an admin-set contract flag, not a certificate. " +
  "RoleGranted, RoleRevoked, ManufacturerVerified, and ManufacturerRevoked events " +
  "are limited to the latest 10,000 Polygon blocks. " +
  "That window is not the full history since deployment. " +
  "A current role or an event in that window is not proof of physical product authenticity, " +
  "regulatory status, or that any specific item is genuine. " +
  "Verify certificates at https://authichain.com/protocol.";

/** First 32-byte word of event data, as a decimal string. Not a clock we set. */
export function timestampWord(data: string | undefined): string | null {
  if (!data || !/^0x[0-9a-fA-F]{64}$/.test(data)) return null;
  return BigInt(data).toString();
}

export function compareHistory(
  a: { block: string; logIndex: string },
  b: { block: string; logIndex: string }
): number {
  const asInt = (value: string) => (/^\d+$/.test(value) ? BigInt(value) : -1n);
  const leftBlock = asInt(a.block);
  const rightBlock = asInt(b.block);
  if (leftBlock !== rightBlock) return rightBlock > leftBlock ? 1 : -1;
  const leftIndex = asInt(a.logIndex);
  const rightIndex = asInt(b.logIndex);
  if (leftIndex === rightIndex) return 0;
  return rightIndex > leftIndex ? 1 : -1;
}

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
