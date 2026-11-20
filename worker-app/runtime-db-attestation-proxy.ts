/**
 * Narrow, credential-isolated route from the public edge to the private Next Worker.
 * The Next route performs its own Bearer authentication and compares two database
 * identities. Never proxy unrelated /api/internal routes or browser headers.
 */
export const RUNTIME_ATTESTATION_PATH = "/api/internal/runtime-db-attestation";
const UPSTREAM = "https://app.authichain.com" + RUNTIME_ATTESTATION_PATH;
const MAX_BODY = 8192;

type AttestationBinding = { fetch(request: Request): Promise<Response> };

function responseHeaders(): Headers {
  return new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store, max-age=0, must-revalidate",
    "CDN-Cache-Control": "no-store",
    "Cloudflare-CDN-Cache-Control": "no-store",
    "Vary": "Authorization",
    "X-Content-Type-Options": "nosniff",
  });
}

function reject(status: number, error: string): Response {
  const headers = responseHeaders();
  if (status === 405) headers.set("Allow", "GET");
  return new Response(JSON.stringify({ verified: false, error }), {
    status,
    headers,
  });
}

export async function proxyRuntimeDbAttestation(
  request: Request,
  verifyApp?: AttestationBinding,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname !== RUNTIME_ATTESTATION_PATH || url.search) {
    return reject(404, "not_found");
  }
  if (request.method !== "GET") return reject(405, "method_not_allowed");
  const authorization = request.headers.get("authorization") || "";
  // Syntax check only; the Next route verifies the actual secret in constant time.
  if (!/^Bearer [^\s]{32,512}$/.test(authorization)) {
    return reject(401, "unauthorized");
  }
  if (!verifyApp) return reject(503, "attestation_unavailable");
  try {
    const upstreamRequest = new Request(UPSTREAM, {
      method: "GET",
      headers: { Authorization: authorization, Accept: "application/json" },
      redirect: "manual",
    });
    const upstreamResponse = await verifyApp.fetch(upstreamRequest);
    if (
      ![200, 401, 503].includes(upstreamResponse.status) ||
      !/^application\/json(?:\s*;|\s*$)/i.test(
        upstreamResponse.headers.get("content-type") || "",
      )
    ) {
      return reject(503, "attestation_unavailable");
    }
    const raw = await upstreamResponse.text();
    if (raw.length > MAX_BODY) return reject(503, "attestation_unavailable");
    const body: unknown = JSON.parse(raw);
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      (body as { verified?: unknown }).verified !==
        (upstreamResponse.status === 200)
    ) {
      return reject(503, "attestation_unavailable");
    }
    return new Response(JSON.stringify(body), {
      status: upstreamResponse.status,
      headers: responseHeaders(),
    });
  } catch {
    // No internal failure detail, upstream headers, cookies, or credentials leak.
    return reject(503, "attestation_unavailable");
  }
}
