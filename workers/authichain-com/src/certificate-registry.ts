/**
 * Public registry view of the canonical auth_seals table.
 *
 * The Next.js certificate route is not the live apex route on Cloudflare;
 * authichain-com intercepts this path before proxying /api/* to APP_WORKER.
 * Keep this handler read-only and use the public Supabase key so the table's
 * RLS policy remains the authority. A registry row means "registered" only;
 * it is not by itself a signature check or a physical-authenticity verdict.
 */

export type CertificateRegistryEnv = {
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
};

type SealRow = {
  id?: unknown;
  product_id?: unknown;
  batch_id?: unknown;
  brand?: unknown;
  polygon_tx?: unknown;
  created_at?: unknown;
};

const REGISTRY_PATH = "/api/authichain/certificates";
const NO_STORE = {
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...NO_STORE, ...CORS },
  });
}

function cleanFilter(raw: string | null): string | null | false {
  if (raw === null || !raw.trim()) return null;
  const value = raw.trim();
  if (
    value.length > 120 ||
    !/^[A-Za-z0-9][A-Za-z0-9 _./-]*$/.test(value)
  ) {
    return false;
  }
  return value;
}

function boundedInt(raw: string | null, fallback: number, max: number): number {
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) return fallback;
  return Math.min(Math.max(value, 0), max);
}

function normalizeRow(row: SealRow) {
  return {
    cert_id: String(row.id ?? ""),
    seal_id: String(row.id ?? ""),
    product_id: String(row.product_id ?? ""),
    batch_id: typeof row.batch_id === "string" ? row.batch_id : null,
    brand: typeof row.brand === "string" ? row.brand : null,
    issued_at: typeof row.created_at === "string" ? row.created_at : null,
    anchor_tx: typeof row.polygon_tx === "string" ? row.polygon_tx : null,
    status: "registered" as const,
  };
}

/**
 * Handles GET /api/authichain/certificates at the Worker boundary.
 * fetchImpl is injectable so the routing and failure paths can be tested
 * without contacting production Supabase.
 */
export async function tryHandleCertificateRegistry(
  request: Request,
  env: CertificateRegistryEnv = {},
  fetchImpl: typeof fetch = fetch,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname.replace(/\/+$/, "") !== REGISTRY_PATH) return null;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...NO_STORE, ...CORS } });
  }
  if (request.method === "HEAD") {
    return new Response(null, { status: 204, headers: { ...NO_STORE, ...CORS } });
  }
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...NO_STORE, ...CORS, Allow: "GET, HEAD, OPTIONS" },
    });
  }

  const baseUrl = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const anonKey = (env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (!baseUrl || !/^https:\/\//i.test(baseUrl) || !anonKey) {
    return json(503, { error: "registry_not_configured" });
  }

  const sp = url.searchParams;
  const brand = cleanFilter(sp.get("brand"));
  const productId = cleanFilter(sp.get("product_id") ?? sp.get("sku"));
  const batchId = cleanFilter(sp.get("batch_id"));
  const q = cleanFilter(sp.get("q"));
  if (brand === false || productId === false || batchId === false || q === false) {
    return json(400, { error: "invalid_filter", detail: "Filters must be 1–120 safe characters." });
  }
  // A legacy ?valid= filter is intentionally not supported: registry presence
  // cannot be upgraded into cryptographic validity or physical authenticity.
  if (sp.has("valid")) {
    return json(400, {
      error: "unsupported_filter",
      detail: "The registry reports registration only; it does not assert validity.",
    });
  }

  const limit = Math.min(Math.max(boundedInt(sp.get("limit"), 20, 100), 1), 100);
  const offset = boundedInt(sp.get("offset"), 0, 1_000_000);
  const query = new URLSearchParams({
    select: "id,product_id,batch_id,brand,polygon_tx,created_at",
    order: "created_at.desc",
    limit: String(limit),
    offset: String(offset),
  });
  if (brand) query.set("brand", `ilike.*${brand}*`);
  if (productId) query.set("product_id", `eq.${productId}`);
  if (batchId) query.set("batch_id", `eq.${batchId}`);
  if (q) query.set("or", `(product_id.ilike.*${q}*,batch_id.ilike.*${q}*)`);

  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}/rest/v1/auth_seals?${query.toString()}`, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
        Prefer: "count=exact",
        Range: `${offset}-${offset + limit - 1}`,
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return json(503, { error: "registry_unavailable" });
  }
  if (!response.ok) {
    return json(503, { error: "registry_unavailable" });
  }

  let rows: unknown;
  try {
    rows = await response.json();
  } catch {
    return json(503, { error: "registry_unavailable" });
  }
  if (!Array.isArray(rows)) {
    return json(503, { error: "registry_unavailable" });
  }

  const contentRange = response.headers.get("content-range") ?? "";
  const countMatch = contentRange.match(/\/(\d+|\*)$/);
  const total = countMatch && countMatch[1] !== "*" ? Number(countMatch[1]) : null;
  return json(200, {
    source: "auth_seals",
    semantics: "registered records only; a registry row is not a signature or physical-authenticity verdict",
    certificates: rows.map(row => normalizeRow(row as SealRow)),
    total,
    limit,
    offset,
  });
}
