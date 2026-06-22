/**
 * bitcoin-auth — AuthiChain Bitcoin address verification worker
 * Validates BTC address ownership via signed message challenges
 */

export interface Env {
  BITCOIN_AUTH_SECRET: string;
  AUTH_KV: KVNamespace;
}

interface ChallengePayload {
  address: string;
  nonce: string;
  timestamp: number;
}

interface VerifyPayload {
  address: string;
  nonce: string;
  signature: string;
}

async function handleChallenge(env: Env): Promise<Response> {
  const nonce = crypto.randomUUID();
  const timestamp = Date.now();
  const challenge: ChallengePayload = { address: '', nonce, timestamp };

  // Store nonce with 10-minute TTL
  await env.AUTH_KV.put(`nonce:${nonce}`, JSON.stringify(challenge), {
    expirationTtl: 600,
  });

  return Response.json({ nonce, timestamp, message: `Sign this nonce to authenticate: ${nonce}` });
}

async function handleVerify(request: Request, env: Env): Promise<Response> {
  const body = await request.json<VerifyPayload>();
  const { address, nonce, signature } = body;

  if (!address || !nonce || !signature) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const stored = await env.AUTH_KV.get(`nonce:${nonce}`);
  if (!stored) {
    return Response.json({ error: 'Invalid or expired nonce' }, { status: 401 });
  }

  // Bitcoin message signature verification requires bitcoinjs-message or WASM secp256k1.
  // Until that dependency is wired in, reject all verification attempts so this
  // endpoint cannot be exploited to claim arbitrary Bitcoin addresses.
  return Response.json({ error: 'Bitcoin signature verification not yet implemented' }, { status: 501 });

  await env.AUTH_KV.delete(`nonce:${nonce}`);

  // Issue a short-lived session token
  const token = crypto.randomUUID();
  await env.AUTH_KV.put(`session:${token}`, address, { expirationTtl: 3600 });

  return Response.json({ token, address, expiresIn: 3600 });
}

async function handleStatus(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return Response.json({ error: 'Missing token' }, { status: 400 });

  const address = await env.AUTH_KV.get(`session:${token}`);
  if (!address) return Response.json({ valid: false }, { status: 401 });

  return Response.json({ valid: true, address });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname, method } = Object.assign(url, { method: request.method });

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    let response: Response;

    if (request.method === 'POST' && url.pathname === '/auth/challenge') {
      response = await handleChallenge(env);
    } else if (request.method === 'POST' && url.pathname === '/auth/verify') {
      response = await handleVerify(request, env);
    } else if (request.method === 'GET' && url.pathname === '/auth/status') {
      response = await handleStatus(request, env);
    } else {
      response = Response.json({ error: 'Not found' }, { status: 404 });
    }

    // Attach CORS headers to all responses
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
    return new Response(response.body, { status: response.status, headers: newHeaders });
  },
};
