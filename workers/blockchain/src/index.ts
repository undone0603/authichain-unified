/**
 * AuthiChain Blockchain Proxy Worker
 * (c) 2026 AuthiChain Inc.
 * 
 * Provides a secure, high-throughput gateway to blockchain RPC nodes.
 * Optimized for Polygon POS and Ethereum Mainnet.
 */

export interface Env {
  POLYGON_RPC_URL?: string;
  ETH_RPC_URL?: string;
  AUTHICHAIN_API_SECRET?: string;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

const DEFAULT_RPC = {
  polygon: 'https://polygon-rpc.com',
  ethereum: 'https://cloudflare-eth.com',
};

async function handleRpcProxy(request: Request, env: Env, network: 'polygon' | 'ethereum'): Promise<Response> {
  const rpcUrl = (network === 'polygon' ? env.POLYGON_RPC_URL : env.ETH_RPC_URL) || DEFAULT_RPC[network];
  
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
  }

  const body = await request.text();
  
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body,
    });
    
    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    return Response.json({ error: 'RPC connection failed', details: String(err) }, { status: 502, headers: CORS_HEADERS });
  }
}

async function handleStatus(env: Env): Promise<Response> {
  const start = Date.now();
  let polygonStatus = 'offline';
  let ethStatus = 'offline';
  
  try {
    const polyRes = await fetch(env.POLYGON_RPC_URL || DEFAULT_RPC.polygon, {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
    });
    if (polyRes.ok) polygonStatus = 'online';
  } catch {}

  try {
    const ethRes = await fetch(env.ETH_RPC_URL || DEFAULT_RPC.ethereum, {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
    });
    if (ethRes.ok) ethStatus = 'online';
  } catch {}

  return Response.json({
    status: 'operational',
    networks: {
      polygon: { status: polygonStatus, rpc: env.POLYGON_RPC_URL ? 'custom' : 'default' },
      ethereum: { status: ethStatus, rpc: env.ETH_RPC_URL ? 'custom' : 'default' },
    },
    latency: `${Date.now() - start}ms`,
    timestamp: new Date().toISOString(),
  }, { headers: CORS_HEADERS });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: CORS_HEADERS });
    }

    // Health / Status
    if (path === '/status' || path === '/health') {
      return handleStatus(env);
    }

    // RPC Proxies
    if (path === '/v1/polygon' || path === '/polygon') {
      return handleRpcProxy(request, env, 'polygon');
    }
    
    if (path === '/v1/ethereum' || path === '/ethereum') {
      return handleRpcProxy(request, env, 'ethereum');
    }

    // Default: Root info
    return Response.json({
      name: 'AuthiChain Blockchain Gateway',
      version: '1.0.0',
      endpoints: ['/polygon', '/ethereum', '/status'],
      protocol: 'AuthiChain Truth Layer',
    }, { headers: CORS_HEADERS });
  },
};
