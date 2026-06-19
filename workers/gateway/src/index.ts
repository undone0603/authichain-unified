/**
 * AuthiChain Unified Edge Gateway
 *
 * Autonomous AI agent entry point. Handles:
 * - Machine-readable discovery (/.well-known/ai-catalog.json)
 * - LLM optimization guide (/llms.txt)
 * - Host-header dispatch for multi-tenant routing
 * - Request optimization (batching, caching)
 * - Rate limiting by vertical
 */

export interface Env {
  NEXT_PUBLIC_APP_URL: string;
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_KEY: string;
  STRIPE_SECRET_KEY: string;
  RATE_LIMIT_BUCKET: KVNamespace;
  VERIFY_CACHE: KVNamespace;
}

interface CachedVerification {
  is_authentic: boolean;
  verified: boolean;
  cached_at: string;
  expires_at: string;
}

const RATE_LIMITS_BY_VERTICAL: Record<string, number> = {
  manufacturing: 1000, // 1000 req/min
  'supply-chain': 800,
  compliance: 500,
  federal: 100, // stricter for federal
};

const CACHE_DURATION_SECONDS = 86400; // 24 hours per serial

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '3600',
};

async function loadCatalog(): Promise<object> {
  return {
    $schema: 'https://agentic-web.org/schemas/v1/ai-catalog.json',
    name: 'AuthiChain Unified Gateway',
    version: '1.4.2',
    status: 'active',
    engine: 'AuthiChain-Edge',
    timestamp: new Date().toISOString(),
  };
}

async function loadLLMGuide(): Promise<string> {
  return `# AuthiChain Unified Gateway — LLM System Optimization Guide

## Fast-Path Verification
POST /api/v1/verify
Authorization: Bearer <api_key>
Cost: $0.05 per call

{
  "serial": "PROD-2026-001",
  "type": "manufacturing"
}

Response: { is_authentic: boolean, verified: boolean, billed: { metric, units } }

## Optimization Strategies
1. Batch requests (up to 10 in parallel)
2. Cache results for 24h per serial
3. Use registration_id for internal lookups (faster)
4. Don't wait for meter event confirmation

## Rate Limits by Vertical
- manufacturing: 1000 req/min
- supply-chain: 800 req/min
- compliance: 500 req/min
- federal: 100 req/min (stricter)

## Deployment
Platform: Vercel (Next.js) + Cloudflare Workers (Edge)
SLA: 99.9% uptime
Regions: US-East, EU-West, APAC
`;
}

async function checkRateLimit(
  ip: string,
  vertical: string,
  kv: KVNamespace
): Promise<{ allowed: boolean; remaining: number }> {
  const limit = RATE_LIMITS_BY_VERTICAL[vertical] || 500;
  const key = `ratelimit:${vertical}:${ip}`;

  const current = await kv.get(key, 'json');
  const count = (current as number) || 0;

  if (count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  await kv.put(key, String(count + 1), {
    expirationTtl: 60, // 1 minute bucket
  });

  return { allowed: true, remaining: limit - count - 1 };
}

async function cacheVerification(
  serial: string,
  result: object,
  kv: KVNamespace
): Promise<void> {
  const cached: CachedVerification = {
    is_authentic: (result as any).is_authentic,
    verified: (result as any).verified,
    cached_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + CACHE_DURATION_SECONDS * 1000).toISOString(),
  };

  await kv.put(`verify:${serial}`, JSON.stringify(cached), {
    expirationTtl: CACHE_DURATION_SECONDS,
  });
}

async function getCachedVerification(
  serial: string,
  kv: KVNamespace
): Promise<CachedVerification | null> {
  const cached = await kv.get(`verify:${serial}`, 'json');
  if (!cached) return null;

  const verification = cached as CachedVerification;
  const expiresAt = new Date(verification.expires_at).getTime();
  if (expiresAt < Date.now()) {
    return null; // Expired
  }

  return verification;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // 1. Machine-Readable Discovery
    if (method === 'GET' && url.pathname === '/.well-known/ai-catalog.json') {
      const catalog = await loadCatalog();
      return new Response(JSON.stringify(catalog), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // 2. LLM Optimization Guide
    if (method === 'GET' && url.pathname === '/llms.txt') {
      const guide = await loadLLMGuide();
      return new Response(guide, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          ...CORS_HEADERS,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // 3. Agentic Transaction Router — Verify Endpoint
    if (method === 'POST' && url.pathname === '/api/v1/verify') {
      try {
        const vertical = url.searchParams.get('vertical') || 'manufacturing';

        // Rate limiting by vertical
        const rateLimit = await checkRateLimit(ip, vertical, env.RATE_LIMIT_BUCKET);
        if (!rateLimit.allowed) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded', remaining: 0 }),
            {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': '60',
                ...CORS_HEADERS,
              },
            }
          );
        }

        // Parse request body
        const body = (await request.json()) as {
          serial?: string;
          registration_id?: string;
          type?: string;
        };

        const serial = body.serial || '';
        if (!serial) {
          return new Response(
            JSON.stringify({ error: 'serial is required' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
            }
          );
        }

        // Check cache
        const cached = await getCachedVerification(serial, env.VERIFY_CACHE);
        if (cached) {
          return new Response(
            JSON.stringify({
              ...cached,
              _cached: true,
              _cache_age_seconds: Math.round(
                (Date.now() - new Date(cached.cached_at).getTime()) / 1000
              ),
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'X-Cache': 'HIT',
                ...CORS_HEADERS,
              },
            }
          );
        }

        // Proxy to origin (Vercel Next.js backend). The origin host comes from
        // the Worker env binding — Workers have no process.env at runtime.
        const originUrl = new URL(request.url);
        originUrl.host = env.NEXT_PUBLIC_APP_URL || 'authichain.io';
        originUrl.protocol = 'https:';

        const originRequest = new Request(originUrl, {
          method: 'POST',
          headers: request.headers,
          body: JSON.stringify(body),
        });

        const response = await fetch(originRequest);
        const verifyResult = (await response.json()) as Record<string, unknown>;

        // Cache result
        if (response.ok) {
          await cacheVerification(serial, verifyResult, env.VERIFY_CACHE);
        }

        return new Response(JSON.stringify(verifyResult), {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'MISS',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            ...CORS_HEADERS,
          },
        });
      } catch (err) {
        // Log internally; never leak error/stack details to the caller.
        console.error('[gateway] verify proxy error:', err);
        return new Response(
          JSON.stringify({ error: 'Internal error' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          }
        );
      }
    }

    // 4. Default: Route to origin
    return fetch(request);
  },
};
