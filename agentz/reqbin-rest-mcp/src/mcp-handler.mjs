import {
  executeHttpRequest,
  executeMcpProbe,
  executeBatchHealthCheck,
} from "./rest-client.mjs";

export const SERVER_INFO = {
  name: "reqbin-rest",
  version: "1.0.0",
};

export const TOOLS = [
  {
    name: "http_request",
    description:
      "Execute a REST/HTTP request (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS) with headers, query params, JSON/raw body, and timeout controls. Blocks private/loopback IPs unless allowlisted.",
    annotations: { readOnlyHint: false, destructiveHint: false },
    inputSchema: {
      type: "object",
      properties: {
        method: {
          type: "string",
          enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
          default: "GET",
        },
        url: { type: "string", description: "Target HTTPS URL" },
        headers: { type: "object", additionalProperties: { type: "string" } },
        query: { type: "object", additionalProperties: { type: "string" } },
        body: { type: "string", description: "Raw request body string" },
        json: { description: "JSON payload (sets Content-Type: application/json)" },
        timeoutMs: { type: "number", default: 15000, minimum: 500, maximum: 30000 },
        followRedirects: { type: "boolean", default: true },
      },
      required: ["url"],
    },
  },
  {
    name: "mcp_probe",
    description:
      "Probe a remote MCP Streamable-HTTP/JSON-RPC 2.0 endpoint (GET discovery, initialize, tools/list, and optional tools/call).",
    annotations: { readOnlyHint: true, destructiveHint: false },
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "MCP endpoint URL (e.g. https://signal.authichain.com/mcp)" },
        mode: {
          type: "string",
          enum: ["full", "discovery", "initialize", "tools/list", "tools/call"],
          default: "full",
        },
        toolName: { type: "string", description: "Optional tool name for tools/call" },
        toolArgs: { type: "object", description: "Optional arguments for tools/call" },
        headers: { type: "object", additionalProperties: { type: "string" } },
        timeoutMs: { type: "number", default: 15000 },
      },
      required: ["url"],
    },
  },
  {
    name: "batch_health_check",
    description:
      "Run parallel HTTP health checks across up to 10 endpoints and return status codes and latencies.",
    annotations: { readOnlyHint: true, destructiveHint: false },
    inputSchema: {
      type: "object",
      properties: {
        urls: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 10 },
        method: { type: "string", enum: ["GET", "HEAD"], default: "GET" },
        timeoutMs: { type: "number", default: 10000 },
      },
      required: ["urls"],
    },
  },
];

function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

export function isAuthorized(request, env = {}) {
  const expected = env.REQBIN_BEARER_TOKEN;
  if (!expected) return true;
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  return timingSafeEqual(auth.slice(7), expected);
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, MCP-Protocol-Version",
    },
  });
}

export async function dispatchToolCall(name, args, env = {}, fetchImpl = globalThis.fetch) {
  if (name === "http_request") {
    return executeHttpRequest(args, env, fetchImpl);
  }
  if (name === "mcp_probe") {
    return executeMcpProbe(args, env, fetchImpl);
  }
  if (name === "batch_health_check") {
    return executeBatchHealthCheck(args, env, fetchImpl);
  }
  throw new Error(`Unknown tool: ${name}`);
}

export async function handleMcpRequest(request, env = {}, fetchImpl = globalThis.fetch) {
  if (request.method === "OPTIONS") {
    return jsonResponse({}, 204);
  }

  if (!isAuthorized(request, env)) {
    return jsonResponse({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" } }, 401);
  }

  if (request.method === "GET") {
    return jsonResponse({
      protocol: "mcp",
      jsonrpc: "2.0",
      serverInfo: SERVER_INFO,
      tools: TOOLS.map((t) => t.name),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }

  const { id = null, method, params = {} } = body || {};

  if (method === "notifications/initialized") {
    return new Response(null, { status: 202 });
  }

  if (method === "ping") {
    return jsonResponse({ jsonrpc: "2.0", id, result: {} });
  }

  if (method === "initialize") {
    return jsonResponse({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: params.protocolVersion || "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      },
    });
  }

  if (method === "tools/list") {
    return jsonResponse({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
  }

  if (method === "tools/call") {
    try {
      const data = await dispatchToolCall(params.name, params.arguments || {}, env, fetchImpl);
      return jsonResponse({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        },
      });
    } catch (err) {
      return jsonResponse({
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        },
      });
    }
  }

  return jsonResponse({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } }, 404);
}
