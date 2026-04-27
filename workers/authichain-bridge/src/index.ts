import { Hono } from 'hono';
import { cors } from 'hono/cors';
import jwt from '@tsndr/cloudflare-worker-jwt';

type Bindings = {
  JWT_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RAPIDAPI_KEY: string;
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
    const verified = await jwt.verify(token, secret);
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
