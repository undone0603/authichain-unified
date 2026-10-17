import { Hono } from 'hono';
import { createPublicClient, http, parseAbiItem, type Address } from 'viem';
import { polygon } from 'viem/chains';
import { DEPLOYED_BLOCK, logFromBlock } from './window';

const CONTRACT = '0x4da4D2675e52374639C9c954f4f653887A9972BE' as const;
const PUBLIC_RPC = 'https://polygon.drpc.org';

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

  try {
    const currentBlock = await client.getBlockNumber();
    const fromBlock = logFromBlock(currentBlock, DEPLOYED_BLOCK);
    const [granted, revoked] = await Promise.all([
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

    return c.json({
      address,
      contract: CONTRACT,
      chainId: 137,
      currentBlock: currentBlock.toString(),
      fromBlock: fromBlock.toString(),
      history,
      polygonscan: {
        contract: `https://polygonscan.com/address/${CONTRACT}`,
        address: `https://polygonscan.com/address/${address}`,
        logs: `https://polygonscan.com/address/${CONTRACT}#events`,
      },
      disclaimer:
        'RoleGranted / RoleRevoked events in the latest 10,000 Polygon blocks. ' +
        'The free public RPC rejects longer ranges, so this is not the full history since deployment. ' +
        'Latest event of the relevant role inside that window is not proof of physical product authenticity, regulatory status, ' +
        'or that any specific item is genuine. ' +
        'Verify certificates yourself at https://authichain.com/protocol.',
      source: 'live eth_getLogs on Polygon (public RPC, no cache, no off-chain authority)',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const rangeRejected = /10000|range|archive/i.test(message);
    return c.json(
      {
        error: rangeRejected ? "log_range_rejected" : "log_query_failed",
        address,
        contract: CONTRACT,
      },
      502
    );
  }
});

export default app;
