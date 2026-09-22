/**
 * Live /mcp and /api/mcp 404 today — landing 404s /mcp, APP_WORKER 404s
 * /api/mcp. Agents that probe those paths never see a pay rail.
 *
 * GET is free discovery (Payment Links + unpaid POST /api/x402).
 * tools/call verify is the same unpaid 402 as /api/x402 — not a fake
 * "SECURED" JSON. Do not tell agents to GET /api/checkout.
 *
 * Do not import authentic-economy here — that pulls supabase-js into the
 * landing worker. plans.ts + x402.ts are already on this worker.
 */
import { planPaymentLink, planUsd } from "../../../src/lib/plans.ts";
import {
  BASE_USDC_ASSET,
  X402_PUBLISHED_PAY_TO,
  buildPaymentRequired,
  parsePaymentHeader,
  paymentResponseHeaders,
  readPaymentProofHeader,
  settlePayment,
  verifyPaymentProof,
  x402PriceUsd,
  type X402HealthEnv,
} from "../../../src/lib/x402.ts";
import type { X402Env } from "./x402-routes";

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
      "Live AuthiChain prices: StrainChain Passport, Farm, and EU DPP Payment Links for humans; unpaid POST /api/x402 ($0.05 USDC on Base) for agents.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "verify",
    description:
      "Paid AuthiChain verification. Unpaid tools/call returns HTTP 402 ($0.05 USDC on Base). Retry with X-PAYMENT.",
    inputSchema: {
      type: "object",
      properties: {
        sealId: { type: "string" },
        productId: { type: "string" },
        serial: { type: "string" },
      },
    },
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

function json(
  status: number,
  body: unknown,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function hydrateX402(env?: X402Env) {
  if (!env) return;
  const keys: Array<keyof X402HealthEnv> = [
    "X402_PAY_TO",
    "X402_FACILITATOR_URL",
    "X402_NETWORK",
    "X402_CHAIN_ID",
    "X402_USDC_ASSET",
    "X402_PRICE_USD",
    "X402_DAILY_CAP_USD",
  ];
  for (const name of keys) {
    const value = env[name];
    if (value && !process.env[name]) process.env[name] = value;
  }
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
      mcp: "https://authichain.com/mcp",
      docs: "https://authichain.com/x402",
      note: "Unpaid POST /api/x402 and unpaid MCP tools/call verify return HTTP 402; pay Base USDC and retry with X-PAYMENT.",
    },
    humanCheckout: {
      rail: "stripe",
      source: "src/lib/plans.ts",
      passportUsd: planUsd("strainchain_passport"),
      dppUsd: planUsd("dpp_readiness"),
      farmUsd: planUsd("strainchain_farm"),
      passportPaymentLink: planPaymentLink("strainchain_passport"),
      dppPaymentLink: planPaymentLink("dpp_readiness"),
      farmPaymentLink: planPaymentLink("strainchain_farm"),
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
      mcpVerify: "POST https://authichain.com/mcp tools/call verify",
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

async function unpaidOrSettledVerify(
  request: Request,
  env: X402Env | undefined,
  args: Record<string, unknown>
): Promise<Response> {
  hydrateX402(env);
  const payTo = (env?.X402_PAY_TO || process.env.X402_PAY_TO || "").trim();
  const resource = new URL(request.url).toString();
  const priceUsd = x402PriceUsd(env?.X402_PRICE_USD);
  if (!payTo) {
    return json(503, {
      error: "payments_not_configured",
      status: "not_configured",
      health: "/api/x402/health",
    });
  }

  const required = buildPaymentRequired({
    resource,
    priceUsd,
    payTo,
    description: "AuthiChain MCP verify",
  });
  const proof = parsePaymentHeader(
    readPaymentProofHeader(name => request.headers.get(name))
  );
  if (!proof) {
    return json(402, required.v2, required.headers);
  }

  const verification = verifyPaymentProof(proof, required.body.accepts[0]);
  if (!verification.valid) {
    return json(
      402,
      { ...required.v2, error: verification.reason },
      required.headers
    );
  }

  const settlement = await settlePayment(
    readPaymentProofHeader(name => request.headers.get(name)) ?? "",
    required.body.accepts[0]
  );
  if (!settlement.settled || !settlement.trustless) {
    return json(
      402,
      {
        ...required.v2,
        error: settlement.reason ?? "not_configured",
        status: settlement.trustless ? "unpaid" : "not_configured",
      },
      required.headers
    );
  }

  const subject = (args.sealId ??
    args.seal_id ??
    args.productId ??
    args.serial) as string | undefined;

  return json(
    200,
    {
      jsonrpc: "2.0",
      result: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              verified: false,
              authenticityScore: 0,
              subject: subject ?? null,
              details: {
                note: "Paid settlement accepted; registry lookup is not bound on this edge path.",
              },
              settlement: {
                payer: proof.payer,
                amountAtomic: verification.amount.toString(),
                txHash: settlement.txHash ?? proof.txHash ?? null,
                trustless: settlement.trustless,
              },
            }),
          },
        ],
      },
    },
    paymentResponseHeaders({
      success: true,
      transaction: settlement.txHash ?? proof.txHash,
      network: required.body.accepts[0].network,
      payer: proof.payer,
    })
  );
}

async function handleRpc(request: Request, env?: X402Env): Promise<Response> {
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
    const params = (body.params ?? {}) as {
      name?: string;
      arguments?: Record<string, unknown>;
    };
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
    if (name === "verify" || name === "authichain_verify_product") {
      return unpaidOrSettledVerify(request, env, params.arguments ?? {});
    }
    return rpcResult(id, {
      content: [
        {
          type: "text",
          text: "Unknown tool. Use get_pricing (free) or verify (unpaid HTTP 402 on POST /mcp, $0.05 USDC on Base).",
        },
      ],
      isError: true,
    });
  }

  return rpcError(id, `Method not found: ${method}`);
}

export async function tryHandleMcp(
  request: Request,
  env: X402Env = {}
): Promise<Response | null> {
  if (!isMcpPath(new URL(request.url).pathname)) return null;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-PAYMENT, PAYMENT-SIGNATURE",
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
    return handleRpc(request, env);
  }

  return json(405, { error: "method not allowed" });
}
