import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  JWT_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RAPIDAPI_KEY: string;
}

// Self-contained HS256 JWT verification via Web Crypto — no external dependency
// (workers here are kept self-contained; the package was never declared, which
// broke the deploy). Mirrors the default behaviour we relied on: HS256 only,
// signature check plus exp/nbf claim validation, returning a boolean.
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

const app = new Hono<{ Bindings: Bindings }>();

// CORS + security headers (negligible CPU)
app.use('*', cors({
  origin: '*', // Allow all origins for the bridge, or specify your domain
  allowHeaders: ['Authorization', 'Content-Type'],
  maxAge: 600,
}));

// Health check – instant response (0 subrequests)
app.get('/health', (c) => c.json({ status: 'ok', limits: '10ms-safe' }));

// Main auth + bridge endpoint (max 2 subrequests total)
app.post('/bridge', async (c) => {
  const start = Date.now();

  // 1. Ultra-fast JWT validation (CPU < 1 ms)
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized', details: 'Missing or malformed Authorization header' }, 401);
  }
  
  const token = authHeader.split(' ')[1];
  const secret = c.env.JWT_SECRET;
  
  if (!secret) {
    console.error('JWT_SECRET not configured');
    return c.json({ error: 'Internal Server Error', details: 'JWT_SECRET not configured' }, 500);
  }

  try {
    const verified = await verifyJwtHS256(token, secret);
    if (!verified) {
      return c.json({ error: 'Unauthorized', details: 'Invalid token' }, 401);
    }
  } catch (err: any) {
    return c.json({ error: 'Unauthorized', details: 'Token verification failed: ' + err.message }, 401);
  }

  // 2. Single subrequest: Supabase bridge (QronSpace/StrainChain data)
  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials not configured');
    return c.json({ error: 'Internal Server Error', details: 'Supabase credentials not configured' }, 500);
  }

  try {
    const bridgePayload = await c.req.json().catch(() => ({})); 

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

    return c.json({ success: true, data, cpuMs: duration });
  } catch (err: any) {
    console.error('Bridge failure:', err.message);
    return c.json({ error: 'Bridge failure', details: err.message }, 500);
  }
});

// RapidAPI passthrough (optional, 1 subrequest max – only if needed)
app.get('/rapid/:endpoint', async (c) => {
  const endpoint = c.req.param('endpoint');
  const rapidKey = c.env.RAPIDAPI_KEY;

  if (!rapidKey) {
    return c.json({ error: 'Internal Server Error', details: 'RAPIDAPI_KEY not configured' }, 500);
  }

  try {
    const rapidRes = await fetch(`https://api.rapidapi.com/${endpoint}`, {
      headers: { 'X-RapidAPI-Key': rapidKey },
    });
    return c.json(await rapidRes.json());
  } catch (err: any) {
    return c.json({ error: 'RapidAPI failure', details: err.message }, 500);
  }
});

export default app;
