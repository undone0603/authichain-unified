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

async function handleChallenge(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{ address: string }>();
  if (!body.address) {
    return Response.json({ error: 'address is required' }, { status: 400 });
  }

  const nonce = crypto.randomUUID();
  const timestamp = Date.now();
  const message = `Sign this nonce to authenticate with AuthiChain: ${nonce}`;
  const challenge: ChallengePayload = { address: body.address, nonce, timestamp };

  await env.AUTH_KV.put(`nonce:${nonce}`, JSON.stringify(challenge), {
    expirationTtl: 600,
  });

  return Response.json({ nonce, timestamp, message });
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

<<<<<<< HEAD
  const challenge: ChallengePayload = JSON.parse(stored);
  if (challenge.address !== address) {
    return Response.json({ error: 'Address does not match challenge' }, { status: 401 });
  }

  // Nonce expiry: 10 minutes
  if (Date.now() - challenge.timestamp > 600_000) {
    await env.AUTH_KV.delete(`nonce:${nonce}`);
    return Response.json({ error: 'Challenge expired' }, { status: 401 });
  }

  // Bitcoin signature verification requires secp256k1 (bitcoinjs-message WASM).
  // Until integrated, validate signature format (base64, 88 chars for Bitcoin
  // signed messages) and reject obviously invalid inputs. This is NOT a full
  // cryptographic check — deploy bitcoinjs-message WASM before production.
  const validFormat = /^[A-Za-z0-9+/=]{80,100}$/.test(signature);
  if (!validFormat) {
    return Response.json({ error: 'Invalid signature format' }, { status: 401 });
  }
=======
  // Bitcoin message signature verification requires bitcoinjs-message or WASM secp256k1.
  // Until that dependency is wired in, reject all verification attempts so this
  // endpoint cannot be exploited to claim arbitrary Bitcoin addresses.
  return Response.json({ error: 'Bitcoin signature verification not yet implemented' }, { status: 501 });
>>>>>>> origin/add-agentz-editable

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

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    let response: Response;

    if (request.method === 'GET' && url.pathname === '/health') {
      response = Response.json({ status: 'ok', service: 'bitcoin-auth', ts: Date.now() });
    } else if (request.method === 'POST' && url.pathname === '/auth/challenge') {
      response = await handleChallenge(request, env);
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
