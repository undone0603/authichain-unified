import { handleMcp } from "./mcp-server";
import { resolveTenant, type TenantContext } from "./auth";
import { checkRateLimit } from "./rate-limiter";
import { recordUsage, flushUsageBuffer } from "./metering";

export interface Env {
  RATE_LIMITS: KVNamespace;
  TENANT_CACHE: KVNamespace;
  USAGE_BUFFER: KVNamespace;
  BACKEND_URL: string;
  INTERNAL_SECRET: string;
  WORKER_VERSION: string;
}

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", ...headers },
  });
}

function corsHeaders(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      "Access-Control-Max-Age": "86400",
    },
  });
}

async function handleAuthedRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  tenant: TenantContext,
  path: string,
): Promise<Response> {
  // Rate limit check
  const rateResult = await checkRateLimit(env, tenant.id, tenant.rateLimit);
  if (!rateResult.allowed) {
    return json(
      { error: "Rate limit exceeded", retryAfter: rateResult.retryAfter },
      429,
      { "Retry-After": String(rateResult.retryAfter || 60) },
    );
  }

  // Determine endpoint name for metering
  const endpoint = path.split("/").filter(Boolean)[0] || "unknown";

  // Proxy to backend
  const backendUrl = `${env.BACKEND_URL}/api/internal${path}`;
  const backendRes = await fetch(backendUrl, {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": env.INTERNAL_SECRET,
    },
    body: request.method !== "GET" ? await request.text() : undefined,
  });

  // Record usage asynchronously
  ctx.waitUntil(recordUsage(env, tenant.id, endpoint));

  const data = await backendRes.json();
  return json(data, backendRes.status, {
    "X-RateLimit-Remaining": String(rateResult.remaining),
    "X-RateLimit-Reset": String(rateResult.resetAt),
    "X-Tenant-ID": String(tenant.id),
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") return corsHeaders();

    // Health check (public)
    if (url.pathname === "/health") {
      return json({ status: "ok", version: env.WORKER_VERSION, timestamp: new Date().toISOString() });
    }

    // Pricing info (public)
    if (url.pathname === "/api/v2/pricing") {
      return json({
        tiers: {
          free: { base: 0, verify: 0, limit: "10/day" },
          starter: { base: 49, verify: 0.02, qr: 0.05, ai: 0.10, rpmLimit: 30 },
          professional: { base: 199, verify: 0.008, qr: 0.03, ai: 0.05, rpmLimit: 60 },
          enterprise: { base: 799, verify: 0.003, qr: 0.01, ai: 0.02, rpmLimit: 200 },
        },
      });
    }

    // MCP endpoint (ChatGPT Apps SDK)
    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      return handleMcp(request, env, ctx);
    }

    // All other routes require authentication
    const tenant = await resolveTenant(request, env);
    if (!tenant) {
      return json({ error: "Unauthorized. Provide X-API-Key header or Bearer token." }, 401);
    }
    if (tenant.status !== "active") {
      return json({ error: "Account suspended. Contact support@authichain.com" }, 403);
    }

    // GPT Actions API
    if (url.pathname.startsWith("/gpt/")) {
      const internalPath = url.pathname.replace("/gpt", "");
      return handleAuthedRequest(request, env, ctx, tenant, internalPath);
    }

    // REST API v2
    if (url.pathname.startsWith("/api/v2/")) {
      const internalPath = url.pathname.replace("/api/v2", "");
      return handleAuthedRequest(request, env, ctx, tenant, internalPath);
    }

    return json({ error: "Not Found" }, 404);
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(flushUsageBuffer(env));
  },
};
