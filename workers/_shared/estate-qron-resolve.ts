/**
 * Sister Living QR scan proxy.
 *
 * Brand workers do not store presentations and do not verify signatures.
 * GET and HEAD /qron/r/* forward to the canonical resolver on authichain.com.
 *
 * Keep this file free of packages/* imports (workers tsconfig ratchet).
 */

const DEFAULT_ORIGIN = "https://authichain.com";
const DECISION_CONTRACT = "AuthiChain Verification Decision v1";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
} as const;

export type EstateQronResolveEnv = {
  AUTHICHAIN_PROTOCOL_ORIGIN?: string;
};

function resolveOrigin(explicit?: string | null): string {
  const raw = typeof explicit === "string" ? explicit.trim() : "";
  return (raw || DEFAULT_ORIGIN).replace(/\/$/, "");
}

function isResolvePath(pathname: string): boolean {
  return pathname === "/qron/r" || pathname.startsWith("/qron/r/");
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/**
 * Handle sister scans of a Living QR resolve URL.
 * Returns null for every other path.
 */
export async function tryHandleEstateQronResolve(
  request: Request,
  env?: EstateQronResolveEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isResolvePath(url.pathname)) return null;

  const origin = resolveOrigin(env?.AUTHICHAIN_PROTOCOL_ORIGIN);
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json(
      {
        valid: false,
        decision: "indeterminate",
        decision_contract: DECISION_CONTRACT,
        error: "method_not_allowed",
      },
      405,
    );
  }

  const accept = request.headers.get("accept") || "application/json";
  let upstream: Response;
  try {
    upstream = await fetchImpl(`${origin}${url.pathname}${url.search}`, {
      method: "GET",
      headers: {
        accept,
        "user-agent": "authichain-suggestions-probe",
      },
    });
  } catch {
    return json(
      {
        valid: false,
        decision: "indeterminate",
        decision_contract: DECISION_CONTRACT,
        error: "qron_resolve_unreachable",
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
    upstream.headers.get("cache-control") || "no-store",
  );
  headers.set("x-qron-resolve-origin", origin);
  const body = request.method === "HEAD" ? null : await upstream.arrayBuffer();
  return new Response(body, { status: upstream.status, headers });
}
