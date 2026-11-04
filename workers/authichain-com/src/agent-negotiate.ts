/**
 * Non-standard, read-only AuthiChain capability preflight.
 *
 * /negotiate is NOT MCP initialize, MCP 2026-07-28 server/discover,
 * an A2A 1.0 operation, or an authorization decision. No peer connections,
 * tool invocation, tasks, identity assertions, signing, or settlement occur.
 */
export const MCP_NEGOTIATE_VERSIONS = [
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
] as const;
export const A2A_NEGOTIATE_VERSIONS = ["1.0"] as const;
export const NEGOTIATE_CAPABILITIES = [
  "mcp.tools.list",
  "mcp.tools.get_agent_setup_offers",
  "mcp.tools.verify_record",
  "a2a.agent_card.read",
] as const;

const NEGOTIATE_SCHEMA = "authichain-agent-negotiate/1";
const MAX_BODY_BYTES = 4096;
const INPUT_KEYS = new Set(["intent", "mcpVersions", "a2aVersions", "capabilities"]);
const PUBLIC_NEXT = {
  mcp: "https://authichain.com/mcp",
  mcpInstall: "https://authichain.com/mcp/install",
  a2aAgentCard: "https://authichain.com/.well-known/agent-card.json",
  a2aJsonRpc: "https://authichain.com/api/a2a",
};
const LIMITS = [
  "This is a proprietary preflight, not a standard MCP/A2A protocol handshake.",
  "No remote peer, task, identity, authorization, session, or settlement is created.",
  "MCP 2026-07-28 server/discover and 2025-11-25 are not yet implemented here.",
  "Actual MCP compatibility must be negotiated using MCP's own lifecycle.",
  "A2A SendMessage, credentials, payments, signing and persistent workflows require separate authorization.",
];

type Decision = "discovery_only" | "compatible_read_only" | "unsupported" |
  "approval_required" | "invalid_request";

export type AgentNegotiation = {
  schema: string;
  status: Decision;
  readOnly: true;
  authorized: false;
  connected: false;
  mcp: { supportedHandshakeVersions: string[]; selectedVersion: string | null };
  a2a: { supportedVersions: string[]; selectedVersion: string | null };
  capabilities: { available: string[]; allowed: string[]; denied: string[] };
  next: typeof PUBLIC_NEXT;
  limitations: string[];
};

function snapshot(
  status: Decision,
  mcpVersion: string | null = null,
  a2aVersion: string | null = null,
  allowed: string[] = [],
  denied: string[] = []
): AgentNegotiation {
  return {
    schema: NEGOTIATE_SCHEMA,
    status,
    readOnly: true,
    authorized: false,
    connected: false,
    mcp: {
      supportedHandshakeVersions: [...MCP_NEGOTIATE_VERSIONS],
      selectedVersion: mcpVersion,
    },
    a2a: { supportedVersions: [...A2A_NEGOTIATE_VERSIONS], selectedVersion: a2aVersion },
    capabilities: {
      available: [...NEGOTIATE_CAPABILITIES],
      allowed,
      denied,
    },
    next: PUBLIC_NEXT,
    limitations: LIMITS,
  };
}

function isStringList(value: unknown, limit: number, length: number): value is string[] {
  return Array.isArray(value) && value.length <= limit &&
    value.every(v => typeof v === "string" && v.length > 0 && v.length <= length);
}

/** Pure: never fetches, writes, authorizes or produces a session token. */
export function negotiateAgentCapabilities(input: unknown): AgentNegotiation {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return snapshot("invalid_request");
  }
  const obj = input as Record<string, unknown>;
  if (Object.keys(obj).some(k => !INPUT_KEYS.has(k)) ||
      (obj.intent !== undefined && typeof obj.intent !== "string") ||
      (obj.mcpVersions !== undefined && !isStringList(obj.mcpVersions, 8, 32)) ||
      (obj.a2aVersions !== undefined && !isStringList(obj.a2aVersions, 8, 32)) ||
      (obj.capabilities !== undefined && !isStringList(obj.capabilities, 12, 64))) {
    return snapshot("invalid_request");
  }
  const mcpVersions = (obj.mcpVersions ?? []) as string[];
  const a2aVersions = (obj.a2aVersions ?? []) as string[];
  const requested = (obj.capabilities ?? []) as string[];
  const mcp = MCP_NEGOTIATE_VERSIONS.find(v => mcpVersions.includes(v)) ?? null;
  const a2a = A2A_NEGOTIATE_VERSIONS.find(v => a2aVersions.includes(v)) ?? null;
  const allowed = requested.filter(c => (NEGOTIATE_CAPABILITIES as readonly string[]).includes(c));
  const denied = requested.filter(c => !(NEGOTIATE_CAPABILITIES as readonly string[]).includes(c));

  if ((mcpVersions.length > 0 && !mcp) || (a2aVersions.length > 0 && !a2a)) {
    return snapshot("unsupported", mcp, a2a, [], requested);
  }
  if (obj.intent !== undefined && obj.intent !== "discover") {
    return snapshot("approval_required", mcp, a2a, [], requested);
  }
  if (denied.length) return snapshot("approval_required", mcp, a2a, [], denied);
  if (!mcpVersions.length && !a2aVersions.length) return snapshot("discovery_only");
  return snapshot("compatible_read_only", mcp, a2a, allowed);
}

function response(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

async function boundedJson(request: Request): Promise<{ ok: true; data: unknown } | { ok: false; code: number }> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) return { ok: false, code: 413 };
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) return { ok: false, code: 415 };
  if (!request.body) return { ok: false, code: 400 };
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        return { ok: false, code: 413 };
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, code: 400 };
  } finally {
    reader.releaseLock();
  }
}

/** Routed before /api/* proxy and before /mcp, so /api/negotiate is local. */
export async function tryHandleAgentNegotiate(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path !== "/negotiate" && path !== "/api/negotiate") return null;
  const origin = request.headers.get("Origin");
  if (origin) {
    let allowed = false;
    try {
      allowed = new URL(origin).origin === url.origin;
    } catch { /* reject malformed origin */ }
    if (!allowed) return response({ error: "origin_not_allowed" }, 403);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": origin || url.origin,
        "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Vary": "Origin",
      },
    });
  }
  if (request.method === "HEAD") {
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }
  if (request.method === "GET") return response(negotiateAgentCapabilities({}));
  if (request.method !== "POST") return response({ error: "method_not_allowed" }, 405, { Allow: "GET, HEAD, POST, OPTIONS" });
  const parsed = await boundedJson(request);
  if (!parsed.ok) return response({ error: parsed.code === 413 ? "body_too_large" : parsed.code === 415 ? "unsupported_media_type" : "invalid_json" }, parsed.code);
  const result = negotiateAgentCapabilities(parsed.data);
  const status = result.status === "invalid_request" ? 400 :
    result.status === "unsupported" ? 422 :
    result.status === "approval_required" ? 403 : 200;
  return response(result, status, origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {});
}
