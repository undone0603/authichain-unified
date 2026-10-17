import { Hono } from 'hono';
import { createPublicClient, http, parseAbiItem, type Address } from 'viem';
import { polygon } from 'viem/chains';

const CONTRACT = '0x4da4D2675e52374639C9c954f4f653887A9972BE' as const;
const PUBLIC_RPC = 'https://polygon-rpc.com';

const ROLE_GRANTED = parseAbiItem(
  'event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)'
);
const ROLE_REVOKED = parseAbiItem(
  'event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)'
);

const app = new Hono();

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

  const fromBlock = 77_535_676n;

  try {
    const [granted, revoked] = await Promise.all([
      client.getLogs({
        address: CONTRACT,
        event: ROLE_GRANTED,
        args: { account: address },
        fromBlock,
        toBlock: 'latest',
      }),
      client.getLogs({
        address: CONTRACT,
        event: ROLE_REVOKED,
        args: { account: address },
        fromBlock,
        toBlock: 'latest',
      }),
    ]);

    const history = [
      ...granted.map((log) => ({
        type: 'granted' as const,
        block: log.blockNumber?.toString() ?? 'unknown',
        tx: log.transactionHash,
        role: log.args.role,
        sender: log.args.sender,
      })),
      ...revoked.map((log) => ({
        type: 'revoked' as const,
        block: log.blockNumber?.toString() ?? 'unknown',
        tx: log.transactionHash,
        role: log.args.role,
        sender: log.args.sender,
      })),
    ].sort((a, b) => Number(b.block) - Number(a.block));

    const currentBlock = await client.getBlockNumber();

    return c.json({
      address,
      contract: CONTRACT,
      chainId: 137,
      currentBlock: currentBlock.toString(),
      history,
      polygonscan: {
        contract: `https://polygonscan.com/address/${CONTRACT}`,
        address: `https://polygonscan.com/address/${address}`,
        logs: `https://polygonscan.com/address/${CONTRACT}#events`,
      },
      disclaimer:
        'Full on-chain RoleGranted / RoleRevoked history from AccessControl. ' +
        'Latest event of the relevant role determines current status. ' +
        'This does not prove physical product authenticity, regulatory status, ' +
        'or that any specific item is genuine. Public product registry remains in development. ' +
        'Verify certificates yourself at https://authichain.com/protocol.',
      source: 'live eth_getLogs on Polygon (public RPC, no cache, no off-chain authority)',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message, address, contract: CONTRACT }, 500);
  }
});

export default app;
