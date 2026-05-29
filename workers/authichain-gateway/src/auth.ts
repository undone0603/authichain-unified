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

const CACHE_TTL = 300;

function normalizeBaseUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export async function resolveTenant(request: Request, env: Env): Promise<TenantContext | null> {
  const apiKey = extractApiKey(request);
  if (!apiKey) return null;

  const cacheKey = `tenant:${apiKey}`;
  const cached = await env.TENANT_CACHE.get(cacheKey, "json");
  if (cached) return cached as TenantContext;

  const tenant = await fetchTenantFromBackend(apiKey, env);
  if (!tenant) return null;

  await env.TENANT_CACHE.put(cacheKey, JSON.stringify(tenant), { expirationTtl: CACHE_TTL });
  return tenant;
}

function extractApiKey(request: Request): string | null {
  const apiKeyHeader = request.headers.get("X-API-Key");
  if (apiKeyHeader) return apiKeyHeader;

  const auth = request.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7).trim() || null;
  }

  try {
    const url = new URL(request.url);
    const queryKey = url.searchParams.get("api_key");
    if (queryKey) return queryKey;
  } catch {
    return null;
  }

  return null;
}

async function fetchTenantFromBackend(apiKey: string, env: Env): Promise<TenantContext | null> {
  const backendUrl = normalizeBaseUrl((env as any).BACKEND_URL);

  if (!backendUrl) {
    console.error("BACKEND_URL is missing or invalid");
    return null;
  }

  try {
    const requestUrl = new URL("/api/internal/tenant", backendUrl);
    requestUrl.searchParams.set("apiKey", apiKey);

    const res = await fetch(requestUrl.toString(), {
      headers: { "X-Internal-Secret": (env as any).INTERNAL_SECRET },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as any;
    if (!data?.id) return null;

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
  } catch (err) {
    console.error("fetchTenantFromBackend failed:", err);
    return null;
  }
}
