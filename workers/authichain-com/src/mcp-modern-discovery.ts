/**
 * Read-only MCP 2026-07-28 discovery adapter.
 *
 * Deliberately DOES NOT dispatch tools/call, payment, verification or any
 * other tool: modern execution remains unavailable until separately reviewed.
 * Existing 2025-era clients are handled by mcp-routes.ts unchanged.
 */
export const MCP_MODERN_VERSION = "2026-07-28";
const LEGACY = new Set(["2025-06-18", "2025-03-26", "2024-11-05"]);
const MAX_BODY_BYTES = 65_536;

type RpcBody = {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
};
type JsonObject = Record<string, unknown>;

function object(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function send(
  status: number,
  id: unknown,
  error: { code: number; message: string; data?: unknown } | null,
  result?: unknown
): Response {
  const payload = error
    ? { jsonrpc: "2.0", id: id ?? null, error }
    : { jsonrpc: "2.0", id: id ?? null, result };
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "CDN-Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "MCP-Protocol-Version": MCP_MODERN_VERSION,
      "Vary": "Origin",
    },
  });
}

function claimsModern(request: Request, body: RpcBody): boolean {
  const version = request.headers.get("MCP-Protocol-Version");
  const meta = object(body.params) && object(body.params._meta)
    ? body.params._meta
    : null;
  const declared = meta?.["io.modelcontextprotocol/protocolVersion"];
  if (request.headers.has("Mcp-Method")) return true;
  if (typeof version === "string" && version.length > 0 && !LEGACY.has(version)) {
    return true;
  }
  return typeof declared === "string" && declared.length > 0 && !LEGACY.has(declared);
}

/**
 * Return null only when the request is definitely legacy. Modern malformed
 * requests fail closed here; never flow through to legacy tools/call.
 */
export function handleModernMcpDiscovery(
  request: Request,
  rawBody: unknown,
  getTools: () => unknown
): Response | null {
  const body: RpcBody = object(rawBody) ? rawBody : {};
  if (!claimsModern(request, body)) return null;

  const id = Object.prototype.hasOwnProperty.call(body, "id") ? body.id : null;

  const origin = request.headers.get("Origin");
  if (origin) {
    let allowed = false;
    try { allowed = new URL(origin).origin === new URL(request.url).origin; }
    catch { /* Invalid Origin must not be trusted. */ }
    if (!allowed) return send(403, id, { code: -32600, message: "Origin not allowed" });
  }

  if (JSON.stringify(rawBody).length > MAX_BODY_BYTES) {
    return send(413, id, { code: -32600, message: "Request too large" });
  }
  if (
    body.jsonrpc !== "2.0" ||
    typeof body.method !== "string" ||
    !Object.prototype.hasOwnProperty.call(body, "id") ||
    !(typeof id === "string" || typeof id === "number")
  ) {
    return send(400, id, { code: -32600, message: "Invalid JSON-RPC request" });
  }

  const meta = object(body.params) && object(body.params._meta) ? body.params._meta : null;
  const declaredVersion = meta?.["io.modelcontextprotocol/protocolVersion"];
  const versionHeader = request.headers.get("MCP-Protocol-Version");
  const methodHeader = request.headers.get("Mcp-Method");
  if (
    typeof declaredVersion !== "string" ||
    !versionHeader ||
    declaredVersion !== versionHeader ||
    methodHeader !== body.method
  ) {
    return send(400, id, { code: -32020, message: "HeaderMismatch: modern request headers must match body" });
  }

  if (declaredVersion !== MCP_MODERN_VERSION) {
    return send(400, id, {
      code: -32022,
      message: "UnsupportedProtocolVersionError",
      data: { supported: [MCP_MODERN_VERSION], requested: declaredVersion },
    });
  }

  const capabilities = meta?.["io.modelcontextprotocol/clientCapabilities"];
  if (!object(capabilities)) {
    return send(400, id, { code: -32602, message: "Missing modern client capabilities" });
  }

  // This isolated adapter intentionally does not execute paid or free tools.
  if (body.method !== "tools/list") {
    return send(404, id, { code: -32601, message: "Method not available in read-only modern discovery" });
  }

  return send(200, id, null, {
    // Required by MCP 2026-07-28 ListToolsResult. Keep results private and
    // immediately stale; authentication/policy can influence the tool list.
    resultType: "complete",
    ttlMs: 0,
    cacheScope: "private",
    tools: getTools(),
    _meta: {
      "io.modelcontextprotocol/serverInfo": {
        name: "authichain",
        version: "1.4.0",
      },
    },
  });
}
