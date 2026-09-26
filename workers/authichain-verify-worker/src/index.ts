/**
 * AuthiChain Verify Worker
 * /api/verify stays the public lookup.
 * /agents + /status restore the archived consensus-engine contract as a goal.
 * Agent notes are always simulated:true until each agent has a real signal.
 */

import { AGENTS, agentNotes, scoreSeal } from "./score";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  NEXT_PUBLIC_SITE_URL: string;
  POLYGON_RPC_URL?: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const JWKS_URL = "https://authichain.com/.well-known/jwks.json";

function json(body: unknown, status = 200, extra?: Record<string, string>): Response {
  return Response.json(body, {
    status,
    headers: { ...CORS_HEADERS, ...extra },
  });
}

function isLikelyUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function normalizeProductIdentifier(value: string): string {
  return value.trim().toUpperCase();
}

function deriveInputIdentifier(input: string): string {
  const trimmed = input.trim();
  if (!isLikelyUrl(trimmed)) return normalizeProductIdentifier(trimmed);
  try {
    const parsed = new URL(trimmed);
    const idParam = parsed.searchParams.get("id");
    if (idParam) return normalizeProductIdentifier(idParam);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const lastSegment = pathParts[pathParts.length - 1];
    return normalizeProductIdentifier(lastSegment || trimmed);
  } catch {
    return normalizeProductIdentifier(trimmed);
  }
}

interface SupabaseProduct {
  id: number;
  product_identifier: string;
  is_active: boolean;
  name?: string;
  supply_chain?: unknown;
  token_id?: number;
  industry_id?: string;
  workflow?: unknown;
  story?: string;
  features?: unknown;
  confidence?: string;
  authenticity_features?: unknown;
}

async function lookupProduct(identifier: string, env: Env): Promise<SupabaseProduct | null> {
  const url = `${env.SUPABASE_URL}/rest/v1/products?product_identifier=eq.${encodeURIComponent(identifier)}&limit=1`;
  const response = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) return null;
  const rows = (await response.json()) as SupabaseProduct[];
  return rows.length > 0 ? rows[0] : null;
}

async function jwksLive(): Promise<boolean> {
  try {
    const res = await fetch(JWKS_URL, { method: "GET" });
    if (!res.ok) return false;
    const body = (await res.json()) as { keys?: unknown[] };
    return Array.isArray(body.keys) && body.keys.length > 0;
  } catch {
    return false;
  }
}

async function parseInput(request: Request, url: URL): Promise<string> {
  if (request.method === "GET") {
    return url.searchParams.get("input") || url.searchParams.get("id") || "";
  }
  try {
    const body = (await request.json()) as { input?: string; id?: string; qrCode?: string };
    return body.input || body.id || body.qrCode || "";
  } catch {
    return "__INVALID_JSON__";
  }
}

async function handleVerify(request: Request, env: Env, url: URL): Promise<Response> {
  const rawInput = await parseInput(request, url);
  if (rawInput === "__INVALID_JSON__") return json({ error: "Invalid JSON body" }, 400);
  if (!rawInput.trim()) return json({ error: "Missing input parameter" }, 400);

  const identifier = deriveInputIdentifier(rawInput);
  let product: SupabaseProduct | null = null;
  try {
    product = await lookupProduct(identifier, env);
  } catch (err) {
    console.log(JSON.stringify({ evt: "verify_lookup_error", err: String(err) }));
  }

  const keysLive = await jwksLive();
  const scored = scoreSeal({
    product,
    jwksLive: keysLive,
    jwsValid: false,
    receiptOk: false,
  });
  const agents = agentNotes(scored);

  console.log(
    JSON.stringify({
      evt: "verify",
      identifier,
      trust_score: scored.trust_score,
      authentic: scored.authentic,
      jwks_live: keysLive,
      agents_simulated: true,
    }),
  );

  return json(
    {
      result: scored.authentic ? "authentic" : product ? "inactive" : "not_found",
      authentic: scored.authentic,
      trust_score: scored.trust_score,
      confidence: scored.confidence,
      qron_id: product?.product_identifier || identifier,
      actions: scored.actions,
      goal: scored.goal,
      anchored: scored.anchored,
      jwks: { url: JWKS_URL, live: keysLive },
      agents,
      product: product
        ? {
            productIdentifier: product.product_identifier,
            isActive: product.is_active,
            name: product.name,
            industryId: product.industry_id,
            story: product.story,
            workflow: product.workflow,
            features: product.features,
            authenticityFeatures: product.authenticity_features,
          }
        : null,
      supplyChain: product?.supply_chain ?? null,
      tokenId: typeof product?.token_id === "number" ? product.token_id : null,
      success: scored.authentic,
      message: scored.message,
      verifiedAt: new Date().toISOString(),
      input: rawInput,
    },
    200,
    {
      "Cache-Control": scored.authentic ? "s-maxage=60, stale-while-revalidate=300" : "no-store",
    },
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";

    if (path === "/health" || path === "/api/health") {
      return json({ status: "ok", worker: "authichain-verify-worker", ts: Date.now(), goal: "jwks_and_receipt" });
    }

    if (path === "/agents" || path === "/api/agents") {
      return json({
        goal: "five_agent_consensus",
        simulated: true,
        threshold: 0.75,
        jwks: JWKS_URL,
        agents: AGENTS.map((a) => ({ ...a, simulated: true })),
      });
    }

    if (path === "/status" || path === "/api/status") {
      const keysLive = await jwksLive();
      return json({
        worker: "authichain-verify-worker",
        jwks_live: keysLive,
        agents_simulated: true,
        goal: "real_agent_signals",
      });
    }

    if (path === "/verify" || path === "/api/verify") {
      return handleVerify(request, env, url);
    }

    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  },
};
