import type { Env } from "./index";

export interface TenantContext {
  id: number;
  companyName: string;
  apiKey: string;
  status: "active" | "suspended" | "cancelled";
  plan: string;
  rateLimit: { rpm: number; rpd: number };
  features: {
    verticals: string[];
    canVerify: boolean;
    canGenerateQr: boolean;
    canMintNft: boolean;
    canAccessCannabis: boolean;
  };
}

const CACHE_TTL = 300; // 5 minutes

/**
 * Resolve tenant from API key or Bearer token.
 * Check KV cache first (5min TTL), fallback to backend lookup.
 */
export async function resolveTenant(request: Request, env: Env): Promise<TenantContext | null> {
  const apiKey = extractApiKey(request);
  if (!apiKey) return null;

  // Check KV cache
  const cacheKey = `tenant:${apiKey}`;
  const cached = await env.TENANT_CACHE.get(cacheKey, "json");
  if (cached) return cached as TenantContext;

  // Fetch from backend
  const tenant = await fetchTenantFromBackend(apiKey, env);
  if (!tenant) return null;

  // Cache the result
  await env.TENANT_CACHE.put(cacheKey, JSON.stringify(tenant), { expirationTtl: CACHE_TTL });

  return tenant;
}

function extractApiKey(request: Request): string | null {
  // Check X-API-Key header
  const apiKeyHeader = request.headers.get("X-API-Key");
  if (apiKeyHeader) return apiKeyHeader;

  // Check Authorization: Bearer <token>
  const auth = request.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7);
  }

  // Check query parameter (for OpenAPI/GPT Actions compatibility)
  const url = new URL(request.url);
  const queryKey = url.searchParams.get("api_key");
  if (queryKey) return queryKey;

  return null;
}

async function fetchTenantFromBackend(apiKey: string, env: Env): Promise<TenantContext | null> {
  try {
    const res = await fetch(`${env.BACKEND_URL}/api/internal/tenant?apiKey=${encodeURIComponent(apiKey)}`, {
      headers: { "X-Internal-Secret": env.INTERNAL_SECRET },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as any;
    if (!data.id) return null;

    const features = data.features || {};
    const plan = features.pricing_tier || "free";

    const RATE_LIMITS: Record<string, { rpm: number; rpd: number }> = {
      free: { rpm: 5, rpd: 10 },
      starter: { rpm: 30, rpd: 5000 },
      professional: { rpm: 60, rpd: 20000 },
      enterprise: { rpm: 200, rpd: 100000 },
    };

    return {
      id: data.id,
      companyName: data.companyName || "Unknown",
      apiKey,
      status: data.status || "active",
      plan,
      rateLimit: RATE_LIMITS[plan] || RATE_LIMITS.free,
      features: {
        verticals: features.verticals || ["authichain"],
        canVerify: features.canVerify !== false,
        canGenerateQr: features.canGenerateQr || false,
        canMintNft: features.canMintNft || false,
        canAccessCannabis: features.canAccessCannabis || false,
      },
    };
  } catch {
    return null;
  }
}
