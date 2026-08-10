/**
 * Blockchain Worker — workers/blockchain/src/index.ts
 * Implements Polygon RPC integration for on-chain verification.
 */

export interface Env {
  POLYGON_RPC_URL: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    
    if (url.pathname === '/verify-tx' && req.method === 'POST') {
      const { txHash } = await req.json<{ txHash: string }>();
      
      try {
        const response = await fetch(env.POLYGON_RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getTransactionReceipt',
            params: [txHash],
            id: 1,
          }),
        });
        
        const data = await response.json();
        return Response.json(data);
      } catch (error) {
        return Response.json({ error: 'Failed to verify transaction', details: error }, { status: 500 });
      }
    }

    return Response.json({ error: 'Not Found' }, { status: 404 });
  },
};
