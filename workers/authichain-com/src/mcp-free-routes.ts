/**
 * /mcp/free — free-only sibling of /mcp for the xAI marketplace plugin
 * (AE Decision Advisor ruling B, Oct 23 2026).
 *
 * Same JSON-RPC / streamable-HTTP handling as /mcp, but tools/list and
 * tools/call expose only the free tools. The legacy x402 `verify` tool, the
 * pricing discovery tool, and query_provenance (whose output carries rail
 * details) are not listed and are refused here. No server info or tool
 * description on this endpoint carries commercial text.
 *
 * /mcp is untouched: free tools/call requests are delegated to the existing
 * tryHandleMcp handler, so tool behavior is identical.
 */
import {
  LATEST_PROTOCOL_VERSION,
  SERVER_VERSION,
  TOOLS,
  negotiateProtocolVersion,
  tryHandleMcp,
} from "./mcp-routes";

export const MCP_FREE_PATH = "/mcp/free";

/** Tools exposed on /mcp/free. Everything else is refused. */
export const FREE_TOOL_NAMES = [
  "verify_record",
  "dpp_readiness_check",
  "scan_living_qr",
] as const;

const FREE_DESCRIPTIONS: Partial<Record<(typeof FREE_TOOL_NAMES)[number], string>> = {
  scan_living_qr:
    "Free. Scan a stored Living QR. GET https://authichain.com/qron/r/{object_id} returns AuthiChain Verification Decision v1. This host verifies the signature. A missing id is presentation_not_found. It does not inspect a physical product.",
};

export const FREE_TOOLS = TOOLS.filter(t =>
  (FREE_TOOL_NAMES as readonly string[]).includes(t.name)
).map(t => {
  const d = FREE_DESCRIPTIONS[t.name as (typeof FREE_TOOL_NAMES)[number]];
  return d ? { ...t, description: d } : t;
});

const FREE_SERVER_INFO = { name: "authichain-free", version: SERVER_VERSION };
const FREE_INSTRUCTIONS =
  "Free AuthiChain tools. verify_record checks an Ed25519 signed provenance " +
  "record. scan_living_qr reads a stored Living QR as AuthiChain " +
  "Verification Decision v1. dpp_readiness_check scores EU Digital Product " +
  "Passport readiness. None of these inspects a physical product, and none " +
  "is legal advice.";

export function isMcpFreePath(pathname: string): boolean {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return p === MCP_FREE_PATH;
}

const BASE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Access-Control-Allow-Origin": "*",
  "MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, "Content-Type": "application/json" },
  });
}

function rpcResult(id: unknown, result: unknown): Response {
  return json(200, { jsonrpc: "2.0", id, result });
}

function rpcError(id: unknown, message: string, code = -32601): Response {
  return json(200, { jsonrpc: "2.0", id, error: { code, message } });
}

async function handleFreeRpc(
  request: Request,
  env: Parameters<typeof tryHandleMcp>[1]
): Promise<Response> {
  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return rpcError(null, "invalid JSON", -32700);
  }
  const method = body.method ?? "";
  const id = body.id;

  const isNotification =
    !Object.prototype.hasOwnProperty.call(body, "id") ||
    method.startsWith("notifications/");
  if (isNotification) {
    return new Response(null, { status: 202, headers: BASE_HEADERS });
  }
  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: negotiateProtocolVersion(body.params),
      capabilities: { tools: { listChanged: false } },
      serverInfo: FREE_SERVER_INFO,
      instructions: FREE_INSTRUCTIONS,
    });
  }
  if (method === "ping") return rpcResult(id, {});
  if (method === "tools/list") return rpcResult(id, { tools: FREE_TOOLS });
  if (method === "tools/call") {
    const name = String((body.params as { name?: unknown } | undefined)?.name ?? "");
    if (!(FREE_TOOL_NAMES as readonly string[]).includes(name)) {
      return rpcError(
        id,
        `Tool not available on ${MCP_FREE_PATH}: ${name}. Available: ${FREE_TOOL_NAMES.join(", ")}.`,
        -32602
      );
    }
    // Delegate to the unchanged /mcp handler for identical tool behavior.
    const url = new URL(request.url);
    url.pathname = "/mcp";
    const delegated = new Request(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify(body),
    });
    return (await tryHandleMcp(delegated, env)) ?? rpcError(id, "internal error", -32603);
  }
  return rpcError(id, `Method not found: ${method}`);
}

export async function tryHandleMcpFree(
  request: Request,
  env: Parameters<typeof tryHandleMcp>[1] = {}
): Promise<Response | null> {
  if (!isMcpFreePath(new URL(request.url).pathname)) return null;
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Accept, Authorization, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
        "Access-Control-Expose-Headers": "MCP-Protocol-Version, Mcp-Session-Id",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  if (request.method === "HEAD") {
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store" },
    });
  }
  if (request.method === "GET") {
    const accept = request.headers.get("Accept") ?? "";
    if (accept.includes("text/event-stream")) {
      return json(405, {
        error: "sse_stream_not_supported",
        note: "This endpoint answers each POST directly and opens no server-initiated stream. POST JSON-RPC to the same URL.",
      });
    }
    return json(200, {
      protocol: "mcp",
      transport: "streamable-http",
      endpoint: `https://authichain.com${MCP_FREE_PATH}`,
      serverInfo: FREE_SERVER_INFO,
      tools: FREE_TOOLS.map(t => t.name),
    });
  }
  if (request.method === "POST") return handleFreeRpc(request, env);
  return json(405, { error: "method not allowed" });
}
