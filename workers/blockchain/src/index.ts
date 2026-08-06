/**
 * blockchain — AuthiChain Polygon RPC integration worker
 * Read-only endpoints: verify transactions, read block data, look up anchored hashes.
 */

export interface Env {
  POLYGON_RPC_URL: string;
  AUTHICHAIN_CONTRACT_ADDRESS: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const ANCHORED_HASHES_SELECTOR = '0x184da86d';
const ANCHOR_METADATA_SELECTOR = '0xe0dcc8b6';

async function rpcCall(env: Env, method: string, params: unknown[]): Promise<unknown> {
  const rpcUrl = env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });

  if (!res.ok) {
    throw new Error(`RPC request failed: ${res.status}`);
  }

  const json = await res.json<{ result?: unknown; error?: { message: string; code: number } }>();
  if (json.error) {
    throw new Error(`RPC error: ${json.error.message}`);
  }

  return json.result;
}

function padUint256(num: string): string {
  const n = BigInt(num);
  return n.toString(16).padStart(64, '0');
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

async function handleGetTransaction(txHash: string, env: Env): Promise<Response> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return jsonResponse({ error: 'Invalid transaction hash' }, 400);
  }

  const [tx, receipt] = await Promise.all([
    rpcCall(env, 'eth_getTransactionByHash', [txHash]),
    rpcCall(env, 'eth_getTransactionReceipt', [txHash]),
  ]);

  if (!tx) {
    return jsonResponse({ error: 'Transaction not found' }, 404);
  }

  const txData = tx as Record<string, string>;
  const receiptData = receipt as Record<string, string> | null;

  return jsonResponse({
    hash: txData.hash,
    from: txData.from,
    to: txData.to,
    value: txData.value,
    blockNumber: txData.blockNumber ? parseInt(txData.blockNumber, 16) : null,
    status: receiptData ? (receiptData.status === '0x1' ? 'success' : 'reverted') : 'pending',
    gasUsed: receiptData?.gasUsed ? parseInt(receiptData.gasUsed as string, 16) : null,
  });
}

async function handleGetBlock(blockParam: string, env: Env): Promise<Response> {
  let blockId: string;
  if (blockParam === 'latest' || blockParam === 'earliest' || blockParam === 'pending') {
    blockId = blockParam;
  } else {
    const num = parseInt(blockParam, 10);
    if (isNaN(num) || num < 0) {
      return jsonResponse({ error: 'Invalid block number' }, 400);
    }
    blockId = '0x' + num.toString(16);
  }

  const block = await rpcCall(env, 'eth_getBlockByNumber', [blockId, false]);

  if (!block) {
    return jsonResponse({ error: 'Block not found' }, 404);
  }

  const b = block as Record<string, string | string[]>;

  return jsonResponse({
    number: parseInt(b.number as string, 16),
    hash: b.hash,
    parentHash: b.parentHash,
    timestamp: parseInt(b.timestamp as string, 16),
    transactionCount: (b.transactions as string[]).length,
    gasUsed: parseInt(b.gasUsed as string, 16),
    gasLimit: parseInt(b.gasLimit as string, 16),
  });
}

async function handleGetAnchor(anchorId: string, env: Env): Promise<Response> {
  const id = parseInt(anchorId, 10);
  if (isNaN(id) || id < 0) {
    return jsonResponse({ error: 'Invalid anchor ID' }, 400);
  }

  if (!env.AUTHICHAIN_CONTRACT_ADDRESS) {
    return jsonResponse({ error: 'Contract address not configured' }, 503);
  }

  const paddedId = padUint256(String(id));

  const [hashResult, metadataResult] = await Promise.all([
    rpcCall(env, 'eth_call', [
      { to: env.AUTHICHAIN_CONTRACT_ADDRESS, data: ANCHORED_HASHES_SELECTOR + paddedId },
      'latest',
    ]),
    rpcCall(env, 'eth_call', [
      { to: env.AUTHICHAIN_CONTRACT_ADDRESS, data: ANCHOR_METADATA_SELECTOR + paddedId },
      'latest',
    ]),
  ]);

  const edgeHash = hashResult as string;
  const isEmptyHash = !edgeHash || edgeHash === '0x' + '0'.repeat(64);

  if (isEmptyHash) {
    return jsonResponse({ error: 'Anchor not found' }, 404);
  }

  let metadata = '';
  if (metadataResult && typeof metadataResult === 'string' && metadataResult.length > 2) {
    try {
      const hex = metadataResult.slice(2);
      if (hex.length >= 128) {
        const length = parseInt(hex.slice(64, 128), 16);
        const dataHex = hex.slice(128, 128 + length * 2);
        metadata = decodeHexString(dataHex);
      }
    } catch {
      metadata = '';
    }
  }

  return jsonResponse({ anchorId: id, edgeHash, metadata });
}

function decodeHexString(hex: string): string {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16);
    if (code === 0) break;
    str += String.fromCharCode(code);
  }
  return str;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean);

    try {
      if (segments[0] === 'tx' && segments[1]) {
        return await handleGetTransaction(segments[1], env);
      }

      if (segments[0] === 'block' && segments[1]) {
        return await handleGetBlock(segments[1], env);
      }

      if (segments[0] === 'anchor' && segments[1]) {
        return await handleGetAnchor(segments[1], env);
      }

      if (segments[0] === 'health' || segments.length === 0) {
        return jsonResponse({ status: 'ok', chain: 'polygon' });
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      return jsonResponse({ error: message }, 502);
    }
  },
};
