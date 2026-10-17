import { Hono } from 'hono';
import { createPublicClient, http, parseAbiItem, type Address } from 'viem';
import { polygon } from 'viem/chains';
import { DEPLOYED_BLOCK, HISTORY_DISCLAIMER, ROLE_IDS, compareHistory, logFromBlock } from './window';

const CONTRACT = '0x4da4D2675e52374639C9c954f4f653887A9972BE' as const;
const PUBLIC_RPC = 'https://polygon-bor-rpc.publicnode.com';

const ROLE_GRANTED = parseAbiItem(
  'event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)'
);
const ROLE_REVOKED = parseAbiItem(
  'event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)'
);
const MANUFACTURER_VERIFIED = parseAbiItem(
  'event ManufacturerVerified(address indexed manufacturer, uint256 timestamp)'
);
const MANUFACTURER_REVOKED = parseAbiItem(
  'event ManufacturerRevoked(address indexed manufacturer, uint256 timestamp)'
);

const ROLE_ABI = [
  {
    type: 'function',
    name: 'hasRole',
    stateMutability: 'view',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'isManufacturerVerified',
    stateMutability: 'view',
    inputs: [{ name: 'manufacturer', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const app = new Hono();

async function readCurrent(client: ReturnType<typeof createPublicClient>, address: Address) {
  const has = (role: string) =>
    client.readContract({
      address: CONTRACT,
      abi: ROLE_ABI,
      functionName: 'hasRole',
      args: [role as `0x${string}`, address],
    });
  const [admin, minter, updater, pauser, manufacturerVerified] = await Promise.all([
    has(ROLE_IDS.admin),
    has(ROLE_IDS.minter),
    has(ROLE_IDS.updater),
    has(ROLE_IDS.pauser),
    client.readContract({
      address: CONTRACT,
      abi: ROLE_ABI,
      functionName: 'isManufacturerVerified',
      args: [address],
    }),
  ]);
  return { admin, minter, updater, pauser, manufacturerVerified };
}

function isValidAddress(addr: string): addr is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

app.get('/:address/history', async (c) => {
  const address = c.req.param('address');
  if (!isValidAddress(address)) {
    return c.json({ error: 'invalid address' }, 400);
  }

  const client = createPublicClient({
    chain: polygon,
    transport: http(PUBLIC_RPC),
  });

  let current;
  try {
    current = await readCurrent(client, address);
  } catch {
    return c.json(
      { error: 'log_query_failed', address, contract: CONTRACT },
      502
    );
  }

  try {
    const currentBlock = await client.getBlockNumber();
    const fromBlock = logFromBlock(currentBlock, DEPLOYED_BLOCK);
    const [granted, revoked, verified, unverified] = await Promise.all([
      client.getLogs({
        address: CONTRACT,
        event: ROLE_GRANTED,
        args: { account: address },
        fromBlock,
        toBlock: currentBlock,
      }),
      client.getLogs({
        address: CONTRACT,
        event: ROLE_REVOKED,
        args: { account: address },
        fromBlock,
        toBlock: currentBlock,
      }),
      client.getLogs({
        address: CONTRACT,
        event: MANUFACTURER_VERIFIED,
        args: { manufacturer: address },
        fromBlock,
        toBlock: currentBlock,
      }),
      client.getLogs({
        address: CONTRACT,
        event: MANUFACTURER_REVOKED,
        args: { manufacturer: address },
        fromBlock,
        toBlock: currentBlock,
      }),
    ]);

    const blockOf = (value: bigint | null | undefined) => value?.toString() ?? 'unknown';
    const indexOf = (value: bigint | null | undefined) => value?.toString() ?? '';
    const history = [
      ...granted.map((log) => ({
        type: 'granted' as const,
        block: blockOf(log.blockNumber),
        logIndex: indexOf(log.logIndex),
        tx: log.transactionHash ?? '',
        role: log.args.role ?? '',
        sender: log.args.sender ?? '',
        timestamp: null as string | null,
      })),
      ...revoked.map((log) => ({
        type: 'revoked' as const,
        block: blockOf(log.blockNumber),
        logIndex: indexOf(log.logIndex),
        tx: log.transactionHash ?? '',
        role: log.args.role ?? '',
        sender: log.args.sender ?? '',
        timestamp: null,
      })),
      ...verified.map((log) => ({
        type: 'manufacturer_verified' as const,
        block: blockOf(log.blockNumber),
        logIndex: indexOf(log.logIndex),
        tx: log.transactionHash ?? '',
        role: '',
        sender: '',
        timestamp: log.args.timestamp?.toString() ?? null,
      })),
      ...unverified.map((log) => ({
        type: 'manufacturer_revoked' as const,
        block: blockOf(log.blockNumber),
        logIndex: indexOf(log.logIndex),
        tx: log.transactionHash ?? '',
        role: '',
        sender: '',
        timestamp: log.args.timestamp?.toString() ?? null,
      })),
    ].sort(compareHistory);

    return c.json({
      address,
      contract: CONTRACT,
      chainId: 137,
      currentBlock: currentBlock.toString(),
      fromBlock: fromBlock.toString(),
      history,
      current,
      polygonscan: {
        contract: `https://polygonscan.com/address/${CONTRACT}`,
        address: `https://polygonscan.com/address/${address}`,
        logs: `https://polygonscan.com/address/${CONTRACT}#events`,
      },
      disclaimer: HISTORY_DISCLAIMER,
      source: 'live eth_call and eth_getLogs on Polygon (public RPC, no cache, no off-chain authority)',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const historyError = /10000|range|archive/i.test(message)
      ? 'log_range_rejected'
      : 'log_query_failed';
    return c.json({
      address,
      contract: CONTRACT,
      chainId: 137,
      currentBlock: null,
      fromBlock: null,
      history: [],
      historyError,
      current,
      polygonscan: {
        contract: `https://polygonscan.com/address/${CONTRACT}`,
        address: `https://polygonscan.com/address/${address}`,
        logs: `https://polygonscan.com/address/${CONTRACT}#events`,
      },
      disclaimer: HISTORY_DISCLAIMER,
      source: 'live eth_call on Polygon; eth_getLogs for this window did not return events',
    });
  }
});

export default app;
