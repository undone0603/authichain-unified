type Bindings = {
  JWT_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RAPIDAPI_KEY: string;
};

// Self-contained worker — no framework/library imports, so it bundles with no
// node_modules resolution. The workers here are not a pnpm workspace and the
// deploy installs only root deps, so `hono` (a root pnpm override, not an
// installed dependency) and `@tsndr/cloudflare-worker-jwt` could not resolve.
// Routing, CORS, and JWT verification are therefore handled directly below.

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '600',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// --- Self-contained HS256 JWT verification via Web Crypto ---
// Mirrors the default behaviour we relied on: HS256 only, signature check plus
// exp/nbf claim validation, returning a boolean.
function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyJwtHS256(token: string, secret: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [headerB64, payloadB64, sigB64] = parts;

  let header: { alg?: string };
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(headerB64)));
  } catch {
    return false;
  }
  if (header?.alg !== 'HS256') return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const signed = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const validSig = await crypto.subtle.verify('HMAC', key, b64urlToBytes(sigB64), signed);
  if (!validSig) return false;

  let payload: { exp?: number; nbf?: number };
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
  } catch {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload?.exp === 'number' && now >= payload.exp) return false;
  if (typeof payload?.nbf === 'number' && now < payload.nbf) return false;
  return true;
}

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight (0 subrequests)
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Health check — instant response (0 subrequests)
    if (method === 'GET' && path === '/health') {
      return json({ status: 'ok', limits: '10ms-safe' });
    }

    // Main auth + bridge endpoint (max 1 subrequest)
    if (method === 'POST' && path === '/bridge') {
      const start = Date.now();

      // 1. Ultra-fast JWT validation (CPU < 1 ms)
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return json({ error: 'Unauthorized', details: 'Missing or malformed Authorization header' }, 401);
      }
      const token = authHeader.split(' ')[1];
      const secret = env.JWT_SECRET;
      if (!secret) {
        console.error('JWT_SECRET not configured');
        return json({ error: 'Internal Server Error', details: 'JWT_SECRET not configured' }, 500);
      }
      try {
        const verified = await verifyJwtHS256(token, secret);
        if (!verified) {
          return json({ error: 'Unauthorized', details: 'Invalid token' }, 401);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return json({ error: 'Unauthorized', details: 'Token verification failed: ' + msg }, 401);
      }

      // 2. Single subrequest: Supabase bridge (QronSpace/StrainChain data)
      const supabaseUrl = env.SUPABASE_URL;
      const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseKey) {
        console.error('Supabase credentials not configured');
        return json({ error: 'Internal Server Error', details: 'Supabase credentials not configured' }, 500);
      }
      try {
        const bridgePayload = await request.json().catch(() => ({}));
        const res = await fetch(`${supabaseUrl}/functions/v1/strain-bridge`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bridgePayload),
        });
        const data = await res.json();
        const duration = Date.now() - start;
        console.log(`Worker CPU: ${duration}ms`);
        return json({ success: true, data, cpuMs: duration });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Bridge failure:', msg);
        return json({ error: 'Bridge failure', details: msg }, 500);
      }
    }

    // RapidAPI passthrough (optional, 1 subrequest max)
    if (method === 'GET' && path.startsWith('/rapid/')) {
      const endpoint = path.slice('/rapid/'.length);
      const rapidKey = env.RAPIDAPI_KEY;
      if (!rapidKey) {
        return json({ error: 'Internal Server Error', details: 'RAPIDAPI_KEY not configured' }, 500);
      }
      try {
        const rapidRes = await fetch(`https://api.rapidapi.com/${endpoint}`, {
          headers: { 'X-RapidAPI-Key': rapidKey },
        });
        return json(await rapidRes.json());
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return json({ error: 'RapidAPI failure', details: msg }, 500);
      }
    }

    return json({ error: 'Not Found' }, 404);
  },
};
