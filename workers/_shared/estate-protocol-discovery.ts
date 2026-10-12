/**
 * Read-only discovery proxy for sister apexes.
 *
 * Brand workers must not issue a second JWKS. These paths forward GET/HEAD
 * to the canonical AuthiChain issuer on authichain.com.
 *
 * Keep this file free of packages/* imports (workers tsconfig ratchet).
 */

const DISCOVERY_PATHS = new Set([
  "/protocol/issuer.json",
  "/protocol/jwks.json",
  "/.well-known/jwks.json",
]);

const DEFAULT_PROTOCOL_ORIGIN = "https://authichain.com";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
} as const;

export type EstateProtocolDiscoveryEnv = {
  AUTHICHAIN_PROTOCOL_ORIGIN?: string;
};

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function resolveOrigin(explicit?: string | null): string {
  const raw = typeof explicit === "string" ? explicit.trim() : "";
  const origin = raw || DEFAULT_PROTOCOL_ORIGIN;
  return origin.replace(/\/$/, "");
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/**
 * Handle sister GET/HEAD of issuer and JWKS documents.
 * Returns null for every other path.
 */
export async function tryHandleEstateProtocolDiscovery(
  request: Request,
  env?: EstateProtocolDiscoveryEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = normalizePath(url.pathname);
  if (!DISCOVERY_PATHS.has(path)) return null;

  if (request.method !== "GET" && request.method !== "HEAD") {
    return json(
      {
        error: "method_not_allowed",
        protocol_origin: resolveOrigin(env?.AUTHICHAIN_PROTOCOL_ORIGIN),
      },
      405,
    );
  }

  const origin = resolveOrigin(env?.AUTHICHAIN_PROTOCOL_ORIGIN);
  let upstream: Response;
  try {
    upstream = await fetchImpl(`${origin}${path}`, {
      method: "GET",
      headers: { accept: "application/json" },
    });
  } catch {
    return json(
      {
        error: "protocol_origin_unreachable",
        protocol_origin: origin,
      },
      502,
    );
  }

  const headers = new Headers();
  headers.set(
    "content-type",
    upstream.headers.get("content-type") || "application/json; charset=utf-8",
  );
  headers.set(
    "cache-control",
    upstream.headers.get("cache-control") || "public, max-age=300",
  );
  headers.set("x-protocol-origin", origin);

  const body = request.method === "HEAD" ? null : await upstream.arrayBuffer();
  return new Response(body, { status: upstream.status, headers });
}
