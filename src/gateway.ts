import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface Env {
  GATEWAY_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  BITCOIN_GATEWAY_URL: string; // HTTP endpoint that broadcasts OP_RETURN and returns { txid }
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const json = (body: JsonValue, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

const text = (body: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...headers },
  });

function getSupabase(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// ai-catalog is loaded from an env var for production‑grade control.
// Set AI_CATALOG_JSON in Cloudflare if you want to override the default.
function getAiCatalog(env: Env): JsonValue {
  try {
    // @ts-ignore – optional env, not declared in Env interface
    const raw = (env as any).AI_CATALOG_JSON;
    if (raw) return JSON.parse(raw);
  } catch (_) {
    // fall through to default
  }

  // Default minimal catalog – safe to ship.
  return {
    version: "1.0",
    services: [
      {
        id: "authichain-gateway",
        name: "AuthiChain Verification & Anchoring",
        endpoints: [
          "/api/v1/verify",
          "/api/v1/anchor",
        ],
      },
    ],
  };
}

// llms.txt is also controlled via env for easy mutation.
function getLlmsTxt(env: Env): string {
  // @ts-ignore – optional env, not declared in Env interface
  const raw = (env as any).LLMS_TXT;
  if (raw) return raw;

  return [
    "# AuthiChain LLM usage declaration",
    "endpoint: /api/v1/verify",
    "endpoint: /api/v1/anchor",
    "owner: AuthiChain",
  ].join("\n");
}

async function authenticate(request: Request, env: Env): Promise<Response | null> {
  const header = request.headers.get("x-gateway-secret") ?? request.headers.get("authorization");
  if (!header) return json({ ok: false, error: "missing_gateway_secret" }, 401);

  const token =
    header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : header.trim();

  if (token !== env.GATEWAY_SECRET) {
    return json({ ok: false, error: "invalid_gateway_secret" }, 401);
  }

  return null;
}

// ---------- /api/v1/verify ----------

interface VerifyBody {
  id: string;
}

async function handleVerify(request: Request, env: Env): Promise<Response> {
  const authError = await authenticate(request, env);
  if (authError) return authError;

  let body: VerifyBody;
  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  if (!body.id) {
    return json({ ok: false, error: "missing_id" }, 400);
  }

  const supabase = getSupabase(env);

  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("id", body.id)
    .single();

  if (error || !data) {
    return json({ ok: false, error: "asset_not_found" }, 404);
  }

  return json({ ok: true, asset: data }, 200);
}

// ---------- /api/v1/anchor ----------

interface AnchorBody {
  asset_id?: string;
  payload: JsonValue;
}

async function handleAnchor(request: Request, env: Env): Promise<Response> {
  const authError = await authenticate(request, env);
  if (authError) return authError;

  let body: AnchorBody;
  try {
    body = (await request.json()) as AnchorBody;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  if (!body || body.payload === undefined) {
    return json({ ok: false, error: "missing_payload" }, 400);
  }

  const supabase = getSupabase(env);

  // 1) Queue into Supabase job table for n8n / worker consumption
  const { data, error } = await supabase
    .from("anchor_queue")
    .insert({
      asset_id: body.asset_id ?? null,
      payload: body.payload,
      status: "pending",
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    return json({ ok: false, error: "queue_insert_failed", detail: error }, 500);
  }

  const queueId = data.id;

  // 2) Optionally call Bitcoin gateway directly for fast anchoring
  let txid: string | null = null;
  try {
    const res = await fetch(env.BITCOIN_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.GATEWAY_SECRET}`,
      },
      body: JSON.stringify({
        op_return: body.payload,
        asset_id: body.asset_id ?? null,
        queue_id: queueId,
      }),
    });

    if (res.ok) {
      const jsonRes = (await res.json()) as { txid?: string };
      txid = jsonRes.txid ?? null;

      if (txid) {
        await supabase
          .from("anchor_queue")
          .update({ status: "anchored", txid })
          .eq("id", queueId);
      }
    } else {
      await supabase
        .from("anchor_queue")
        .update({ status: "error", error_message: `HTTP ${res.status}` })
        .eq("id", queueId);
    }
  } catch (e: any) {
    await supabase
      .from("anchor_queue")
      .update({ status: "error", error_message: String(e?.message ?? e) })
      .eq("id", queueId);
  }

  return json(
    {
      ok: true,
      queue_id: queueId,
      txid,
    },
    202,
  );
}

// ---------- /.well-known/ai-catalog.json ----------

async function handleAiCatalog(_request: Request, env: Env): Promise<Response> {
  const catalog = getAiCatalog(env);
  return json(catalog, 200);
}

// ---------- /llms.txt ----------

async function handleLlmsTxt(_request: Request, env: Env): Promise<Response> {
  const body = getLlmsTxt(env);
  return text(body, 200);
}

// ---------- Router ----------

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Well‑known AI catalog
    if (request.method === "GET" && url.pathname === "/.well-known/ai-catalog.json") {
      return handleAiCatalog(request, env);
    }

    // LLMs declaration
    if (request.method === "GET" && url.pathname === "/llms.txt") {
      return handleLlmsTxt(request, env);
    }

    // Verify endpoint
    if (url.pathname === "/api/v1/verify" && request.method === "POST") {
      return handleVerify(request, env);
    }

    // Anchor endpoint
    if (url.pathname === "/api/v1/anchor" && request.method === "POST") {
      return handleAnchor(request, env);
    }

    // Optional health check
    if (url.pathname === "/api/v1/health" && request.method === "GET") {
      return json({ ok: true, service: "authichain-gateway" }, 200);
    }

    return json({ ok: false, error: "not_found" }, 404);
  },
};
