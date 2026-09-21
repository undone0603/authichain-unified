/**
 * Live /mcp and /api/mcp 404 today — landing 404s /mcp, APP_WORKER 404s
 * /api/mcp. Agents that probe those paths never see a pay rail.
 *
 * Intercept both on authichain-com (before APP_PREFIXES) with public
 * get_pricing discovery. Paid verify is unpaid POST /api/x402, not a
 * fake "SECURED" JSON. Do not tell agents to GET /api/checkout.
 *
 * Do not import authentic-economy here — that pulls supabase-js into the
 * landing worker. plans.ts + x402.ts are already on this worker.
 */
import { planPaymentLink, planUsd } from "../../../src/lib/plans.ts";
import {
  BASE_USDC_ASSET,
  X402_PUBLISHED_PAY_TO,
  x402PriceUsd,
} from "../../../src/lib/x402.ts";

const JSON_HEADERS = {
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
};

const TOOLS = [
  {
    name: "get_pricing",
    description:
      "Live AuthiChain prices: StrainChain Passport and EU DPP Payment Links for humans; unpaid POST /api/x402 ($0.05 USDC on Base) for agents.",
    inputSchema: { type: "object", properties: {} },
  },
];

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "");
  }
  return pathname;
}

export function isMcpPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  return p === "/mcp" || p === "/api/mcp" || p === "/.well-known/mcp.json";
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

export function mcpPricingDiscovery() {
  return {
    agentRail: {
      endpoint: "POST /api/v1/agent-verify",
      alias: "POST /api/x402",
      protocol: "x402",
      network: "base",
      chainId: "8453",
      asset: BASE_USDC_ASSET,
      publishedPayTo: X402_PUBLISHED_PAY_TO,
      pricePerCall: `$${x402PriceUsd()} USDC`,
      catalog: "https://authichain.com/api/x402/catalog",
      wellKnown: "https://authichain.com/.well-known/x402.json",
      docs: "https://authichain.com/x402",
      note: "Unpaid POST returns HTTP 402; pay Base USDC and retry with X-PAYMENT.",
    },
    humanCheckout: {
      rail: "stripe",
      source: "src/lib/plans.ts",
      passportUsd: planUsd("strainchain_passport"),
      dppUsd: planUsd("dpp_readiness"),
      passportPaymentLink: planPaymentLink("strainchain_passport"),
      dppPaymentLink: planPaymentLink("dpp_readiness"),
      emailCapture: {
        passport: "https://authichain.com/passport",
        dpp: "https://authichain.com/dpp",
      },
    },
  };
}

function discoveryBody() {
  return {
    protocol: "mcp",
    jsonrpc: "2.0",
    serverInfo: { name: "authichain", version: "1.0.0" },
    tools: TOOLS,
    pricing: mcpPricingDiscovery(),
    pay: {
      x402: "POST https://authichain.com/api/x402",
      catalog: "https://authichain.com/api/x402/catalog",
      wellKnown: "https://authichain.com/.well-known/x402.json",
      docs: "https://authichain.com/x402",
    },
  };
}

function rpcResult(id: unknown, result: unknown): Response {
  return json(200, { jsonrpc: "2.0", id: id ?? null, result });
}

function rpcError(id: unknown, message: string, code = -32601): Response {
  return json(200, {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message },
  });
}

async function handleRpc(request: Request): Promise<Response> {
  let body: {
    jsonrpc?: string;
    id?: unknown;
    method?: string;
    params?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return rpcError(null, "invalid JSON", -32700);
  }
  const method = body.method ?? "";
  const id = body.id;

  if (method === "initialize" || method === "notifications/initialized") {
    return rpcResult(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "authichain", version: "1.0.0" },
    });
  }

  if (method === "tools/list") {
    return rpcResult(id, { tools: TOOLS });
  }

  if (method === "tools/call") {
    const params = (body.params ?? {}) as { name?: string };
    const name = params.name ?? "";
    if (name === "get_pricing" || name === "authichain_get_pricing") {
      return rpcResult(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify(mcpPricingDiscovery(), null, 2),
          },
        ],
      });
    }
    return rpcResult(id, {
      content: [
        {
          type: "text",
          text: "Paid verify is unpaid POST https://authichain.com/api/x402 ($0.05 USDC on Base). Retry with X-PAYMENT. Humans use catalogue Payment Links from get_pricing.",
        },
      ],
      isError: true,
    });
  }

  return rpcError(id, `Method not found: ${method}`);
}

export async function tryHandleMcp(request: Request): Promise<Response | null> {
  if (!isMcpPath(new URL(request.url).pathname)) return null;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-PAYMENT",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (request.method === "HEAD") {
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "private, no-store",
        "CDN-Cache-Control": "no-store",
      },
    });
  }

  if (request.method === "GET") {
    return json(200, discoveryBody());
  }

  if (request.method === "POST") {
    return handleRpc(request);
  }

  return json(405, { error: "method not allowed" });
}
