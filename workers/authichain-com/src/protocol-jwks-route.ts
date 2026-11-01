/**
 * Public JWKS and issuer.json on the landing worker.
 *
 * WSL cannot complete the 8.8 MiB authichain-edge-router versions POST
 * (41299746700 HTTP/2 0-byte timeout, 41297825503 part gzip eval'd as JS,
 * 41298894966 HTTP gzip NextPart EOF). These three paths have more-specific
 * Cloudflare routes on edge-router today; after those routes are deleted,
 * authichain.com/* lands here. Intercept before APP_PREFIXES so /protocol
 * is not proxied to the stale one-key edge-router. Public keys only. The
 * private signing key stays on edge-router. Omit the Oct 9 compromised
 * key (lue84wJN) from JWKS.
 */
import {
  PRODUCTION_ISSUER_KID,
  RETIRED_OCT31_ISSUER_KID,
} from "./mcp-routes";

const CURRENT_X = "MCKE_tTFsmcYVr2PTJgo8X2F3gJTXXrwZev_1UtE5Nk";
const RETIRED_OCT31_X = "T36jnq2kRJRxGBhtyGG3PSboG_Vb6f-l8TixLr95vG0";

const JWKS_PATHS = new Set([
  "/.well-known/jwks.json",
  "/protocol/jwks.json",
]);
const ISSUER_PATH = "/protocol/issuer.json";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET",
  "X-Content-Type-Options": "nosniff",
  Allow: "GET, HEAD",
};

function okp(kid: string, x: string) {
  return {
    kty: "OKP",
    crv: "Ed25519",
    x,
    kid,
    use: "sig",
    alg: "EdDSA",
  };
}

export const PROTOCOL_JWKS_KEYS = [
  okp(PRODUCTION_ISSUER_KID, CURRENT_X),
  okp(RETIRED_OCT31_ISSUER_KID, RETIRED_OCT31_X),
];

export const PROTOCOL_ISSUER = {
  contract: "AuthiChain Attestation Contract v0.1",
  alg: "EdDSA",
  crv: "Ed25519",
  kid: PRODUCTION_ISSUER_KID,
  issuer: "https://authichain.com",
  jwks: "https://authichain.com/protocol/jwks.json",
  ready: true,
  // Signing stays on authichain-edge-router (private key is not copied here).
  signing: true,
};

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "");
  }
  return pathname;
}

function jsonResponse(
  body: unknown,
  headers: Record<string, string>,
  method: string
): Response {
  const h = {
    "Content-Type": "application/json; charset=utf-8",
    ...CORS,
    ...headers,
  };
  if (method === "HEAD") return new Response(null, { status: 200, headers: h });
  return new Response(JSON.stringify(body), { status: 200, headers: h });
}

export function tryHandleProtocolJwks(request: Request): Response | null {
  const path = normalizePath(new URL(request.url).pathname);
  const isJwks = JWKS_PATHS.has(path);
  const isIssuer = path === ISSUER_PATH;
  if (!isJwks && !isIssuer) return null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...CORS,
      },
    });
  }
  if (isIssuer) {
    return jsonResponse(
      PROTOCOL_ISSUER,
      { "Cache-Control": "private, no-store" },
      request.method
    );
  }
  const cache =
    path === "/protocol/jwks.json"
      ? "private, no-store"
      : "public, max-age=300, stale-while-revalidate=86400";
  return jsonResponse(
    { keys: PROTOCOL_JWKS_KEYS },
    { "Cache-Control": cache },
    request.method
  );
}
