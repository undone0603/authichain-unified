/**
 * AuthiChain Verify Worker — draft branch feat/verify-evaluate-wire
 * Public contract: { decision, vector, reasons, unknowns, depthUsed }
 * No trust_score. Fixtures are labeled source=fixture (not a live mint).
 */

import { evaluate } from "./evaluate";
import { libraryPageFor, lookupFixture } from "./fixtures";

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
const POLYGON_CONTRACT = "0x4da4D2675e52374639C9c954f4f653887A9972BE";

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
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
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

function kernelEnvelope(
  identifier: string,
  rawInput: string,
  keysLive: boolean,
  kernel: ReturnType<typeof evaluate>,
  extra: Record<string, unknown> = {},
) {
  return {
    decision: kernel.decision,
    vector: kernel.vector,
    reasons: kernel.reasons,
    unknowns: kernel.unknowns,
    depthUsed: kernel.depthUsed,
    qron_id: identifier,
    anchored: false,
    polygon: { contract: POLYGON_CONTRACT, queried: false, status: "in_development" },
    jwks: { url: JWKS_URL, live: keysLive },
    verifiedAt: new Date().toISOString(),
    input: rawInput,
    ...extra,
  };
}

async function handleVerify(request: Request, env: Env, url: URL): Promise<Response> {
  const rawInput = await parseInput(request, url);
  if (rawInput === "__INVALID_JSON__") return json({ error: "Invalid JSON body" }, 400);
  if (!rawInput.trim()) return json({ error: "Missing input parameter" }, 400);

  const identifier = deriveInputIdentifier(rawInput);
  const keysLive = await jwksLive();

  const fixture = lookupFixture(identifier);
  if (fixture) {
    const kernel = evaluate(fixture.input);
    console.log(JSON.stringify({ evt: "verify", identifier, decision: kernel.decision, source: "fixture" }));
    return json(
      kernelEnvelope(identifier, rawInput, keysLive, kernel, {
        source: "fixture",
        label: fixture.label,
        product: null,
      }),
      200,
      { "Cache-Control": "no-store" },
    );
  }

  const library = libraryPageFor(identifier);
  if (library) {
    const kernel = evaluate({});
    kernel.reasons.push("library_page_is_not_a_seal");
    return json(
      kernelEnvelope(identifier, rawInput, keysLive, kernel, {
        source: "library",
        page: library,
        product: null,
      }),
      200,
      { "Cache-Control": "no-store" },
    );
  }

  let product: SupabaseProduct | null = null;
  try {
    product = await lookupProduct(identifier, env);
  } catch (err) {
    console.log(JSON.stringify({ evt: "verify_lookup_error", err: String(err) }));
  }

  const kernel = evaluate(
    product
      ? {
          objectFound: true,
          objectId: product.product_identifier,
          identity: { serial: product.product_identifier },
          depth: "lookup",
          crypto: {
            signatureValid: undefined,
            issuerTrusted: undefined,
            identityValid: true,
            evidenceIntact: undefined,
            statusActive: product.is_active !== false,
          },
          attestation: {
            objectId: product.product_identifier,
            status: product.is_active === false ? "inactive" : "registered",
            issuer: "supabase-products",
          },
        }
      : {},
  );

  console.log(JSON.stringify({ evt: "verify", identifier, decision: kernel.decision, source: product ? "supabase" : "none" }));

  return json(
    kernelEnvelope(identifier, rawInput, keysLive, kernel, {
      source: product ? "supabase" : "none",
      product: product
        ? {
            productIdentifier: product.product_identifier,
            isActive: product.is_active,
            name: product.name,
            industryId: product.industry_id,
          }
        : null,
      tokenId: typeof product?.token_id === "number" ? product.token_id : null,
    }),
    200,
    { "Cache-Control": "no-store" },
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
      return json({
        status: "ok",
        worker: "authichain-verify-worker",
        ts: Date.now(),
        contract: "evaluate",
        draft: true,
      });
    }

    if (path === "/verify" || path === "/api/verify") {
      return handleVerify(request, env, url);
    }

    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  },
};
