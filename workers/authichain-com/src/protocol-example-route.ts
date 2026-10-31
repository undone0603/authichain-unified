/**
 * Serve the one published demonstration record at the URL named in the
 * credential. /protocol is an APP_PREFIXES proxy, so this must run first.
 * The files are the public example. They are not a product passport.
 */
import anchor from "../../../protocol/examples/polygon-anchor-1.anchor.json" with { type: "json" };
import record from "../../../protocol/examples/polygon-anchor-1.record.json" with { type: "json" };

const RECORD_PATHS = new Set([
  "/protocol/examples/polygon-anchor-1",
  "/protocol/examples/polygon-anchor-1.record.json",
]);
const ANCHOR_PATH = "/protocol/examples/polygon-anchor-1.anchor.json";

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "");
  }
  return pathname;
}

export function tryHandleProtocolExample(request: Request): Response | null {
  const path = normalizePath(new URL(request.url).pathname);
  const isRecord = RECORD_PATHS.has(path);
  const isAnchor = path === ANCHOR_PATH;
  if (!isRecord && !isAnchor) return null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
    Allow: "GET, HEAD",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers,
    });
  }
  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }
  return new Response(JSON.stringify(isAnchor ? anchor : record), {
    status: 200,
    headers,
  });
}
