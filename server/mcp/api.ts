import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

/**
 * MCP tools for the public AuthiChain API.
 * Calls https://authichain.com (or AUTHICHAIN_API_BASE). Does not mint
 * certificates and does not create API keys.
 */

export function apiBase(): string {
  return (process.env.AUTHICHAIN_API_BASE || "https://authichain.com").replace(
    /\/$/,
    ""
  );
}

export async function apiCall(
  path: string,
  init: RequestInit = {},
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<{ status: number; body: string }> {
  const headers = new Headers(init.headers);
  if (!headers.has("accept")) headers.set("accept", "application/json");
  const key = process.env.AUTHICHAIN_API_KEY;
  const paid = path.startsWith("/api/x402");
  if (key && !paid && !headers.has("X-API-Key")) {
    headers.set("X-API-Key", key);
  }
  const res = await fetchImpl(`${apiBase()}${path}`, { ...init, headers });
  return { status: res.status, body: await res.text() };
}

function textResult(status: number, body: string) {
  return { content: [{ type: "text" as const, text: `HTTP ${status}\n${body}` }] };
}

const server = new McpServer({
  name: "AuthiChain API",
  version: "1.0.0",
});

server.tool("get_pricing", {}, async () => {
  const res = await apiCall("/api/v1/pricing");
  return textResult(res.status, res.body);
});

server.tool("list_industries", {}, async () => {
  const res = await apiCall("/api/v1/industries");
  return textResult(res.status, res.body);
});

server.tool(
  "verify",
  {
    serial: z
      .string()
      .describe("Serial, product id, or truemark id. 1-128 letters, digits, . _ : -"),
  },
  async ({ serial }) => {
    const res = await apiCall("/api/v1/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ serial }),
    });
    return textResult(res.status, res.body);
  }
);

server.tool(
  "classify",
  {
    name: z.string(),
    category: z.string().optional(),
    description: z.string().optional(),
  },
  async ({ name, category, description }) => {
    const res = await apiCall("/api/v1/classify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, category, description }),
    });
    return textResult(res.status, res.body);
  }
);

server.tool(
  "list_products",
  {
    category: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  },
  async ({ category, limit, offset }) => {
    const qs = new URLSearchParams();
    if (category) qs.set("category", category);
    if (limit != null) qs.set("limit", String(limit));
    if (offset != null) qs.set("offset", String(offset));
    const q = qs.toString();
    const res = await apiCall(`/api/v1/products${q ? `?${q}` : ""}`);
    return textResult(res.status, res.body);
  }
);

server.tool("whoami", {}, async () => {
  const res = await apiCall("/api/v1/me");
  return textResult(res.status, res.body);
});

server.tool(
  "verify_paid",
  {
    subject: z.string().describe("Product id or serial to verify"),
    payment: z
      .string()
      .optional()
      .describe("x402 X-PAYMENT proof. Omit to receive the 402 requirements."),
  },
  async ({ subject, payment }) => {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (payment) headers["X-PAYMENT"] = payment;
    const res = await apiCall("/api/x402", {
      method: "POST",
      headers,
      body: JSON.stringify({ productId: subject }),
    });
    return textResult(res.status, res.body);
  }
);

export async function startApiMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("server/mcp/api.ts") || entry.endsWith("server/mcp/api.js")) {
  startApiMcpServer().catch(err => {
    console.error("[MCP] AuthiChain API server failed to start");
    console.error(err instanceof Error ? err.message : "unknown error");
    process.exit(1);
  });
}
