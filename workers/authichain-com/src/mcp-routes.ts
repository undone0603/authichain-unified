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
  forwardPaidVerifyMcp,
  parsePaymentHeader,
  readPaymentProofHeader,
  X402_REGISTRY_NOT_BOUND,
  x402PriceUsd,
  x402PaidVerifyStatus,
  type X402EnvVars,
  type X402VerifyBinding,
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
      x402PaidVerifyStatus().bound
        ? "Paid AuthiChain verification. Unpaid tools/call returns HTTP 402 ($0.05 USDC on Base). Retry with X-PAYMENT."
        : "Paid AuthiChain verification, not answering yet. Unpaid tools/call returns HTTP 402 ($0.05 USDC on Base) for discovery; a paid call is refused with 503 registry_not_bound before settlement, so no payment is taken. Use query_provenance for a free lookup.",
    inputSchema: {
      type: "object",
      properties: {
        sealId: { type: "string" },
        productId: { type: "string" },
        serial: { type: "string" },
      },
    },
  },
  {
    name: "query_provenance",
    description:
      "Free public lookup for an assetId / seal / QR token. Never attests. Unknown IDs return status unknown. " +
      (x402PaidVerifyStatus().bound
        ? "Paid verify is tools/call verify ($0.05 USDC on Base)."
        : "Paid tools/call verify ($0.05 USDC on Base) is not answering yet: it refuses before settlement."),
    inputSchema: {
      type: "object",
      properties: {
        assetId: {
          type: "string",
          description: "Seal, serial, or QR token identifier",
        },
      },
      required: ["assetId"],
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
  const keys: Array<keyof X402EnvVars> = [
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

function livePayTo(env?: X402Env): string {
  return (
    env?.X402_PAY_TO?.trim() ||
    process.env.X402_PAY_TO?.trim() ||
    X402_PUBLISHED_PAY_TO
  );
}

export function mcpPricingDiscovery(env?: X402Env) {
  return {
    agentRail: {
      endpoint: "POST /api/v1/agent-verify",
      alias: "POST /api/x402",
      protocol: "x402",
      network: "base",
      chainId: "8453",
      asset: BASE_USDC_ASSET,
      publishedPayTo: livePayTo(env),
      pricePerCall: `$${x402PriceUsd()} USDC`,
      catalog: "https://authichain.com/api/x402/catalog",
      wellKnown: "https://authichain.com/.well-known/x402.json",
      mcp: "https://authichain.com/mcp",
      docs: "https://authichain.com/x402",
      note: x402PaidVerifyStatus().bound
        ? "Unpaid POST /api/x402 and unpaid MCP tools/call verify return HTTP 402; pay Base USDC and retry with X-PAYMENT."
        : "Unpaid POST /api/x402 and unpaid MCP tools/call verify return HTTP 402 for discovery, but a paid call is refused with 503 registry_not_bound before settlement until the registry lookup is bound. No payment is taken.",
      paidVerify: x402PaidVerifyStatus(),
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

function queryProvenance(assetIdRaw: unknown) {
  const assetId = String(assetIdRaw ?? "").trim();
  const seed = assetId.toUpperCase() === "AC-7C2A91E4";
  return {
    assetId: assetId || null,
    status: seed ? "desk_sample" : "unknown",
    verified: false,
    authenticityScore: 0,
    protocol: "AuthiChain attestation 0.1",
    product: seed
      ? {
          id: "AC-7C2A91E4",
          name: "Michigan METRC sample",
          source: "Self-serve desk seed. Not a live registry row.",
        }
      : null,
    ledger: {
      polygonNft: {
        chainId: 137,
        contract: "0x4da4D2675e52374639C9c954f4f653887A9972BE",
        note: "16 ACPT NFTs. $QRON is not this rail.",
      },
      baseNft: {
        chainId: 8453,
        contract: null,
        note: "AuthiChainNFT getCode is empty. Do not claim Base mint.",
      },
      x402: {
        chainId: 8453,
        asset: BASE_USDC_ASSET,
        pricePerCall: `$${x402PriceUsd()} USDC`,
        payTo: livePayTo(),
      },
    },
    registry: {
      certificatesApi: "https://authichain.com/api/authichain/certificates",
      state: "404",
      note: "Public count stays — until this endpoint answers.",
    },
    jwks: "https://authichain.com/.well-known/jwks.json",
    paidVerify: "POST /mcp tools/call verify",
    compliance:
      "EU DPP Readiness is a $299 Stripe SKU. It is not a status on this lookup.",
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

async function unpaidOrRefusedVerify(
  request: Request,
  env: X402Env | undefined,
  args: Record<string, unknown>,
  id: unknown,
  verifyApp?: X402VerifyBinding
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
  const proofHeader = readPaymentProofHeader(name => request.headers.get(name));
  const proof = parsePaymentHeader(proofHeader);
  if (!proof || !proofHeader) {
    return json(402, required.v2, required.headers);
  }

  if (verifyApp) {
    return forwardPaidVerifyMcp(verifyApp, request, proofHeader, args, id);
  }
  // No registry lookup is bound here: refuse before settlePayment() so the
  // agent is never charged for an answer that cannot be real.
  return json(503, X402_REGISTRY_NOT_BOUND);
}

async function handleRpc(
  request: Request,
  env?: X402Env,
  verifyApp?: X402VerifyBinding
): Promise<Response> {
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
      hydrateX402(env);
      return rpcResult(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify(mcpPricingDiscovery(env), null, 2),
          },
        ],
      });
    }
    if (name === "verify" || name === "authichain_verify_product") {
      return unpaidOrRefusedVerify(
        request,
        env,
        params.arguments ?? {},
        id,
        verifyApp
      );
    }
    if (name === "query_provenance" || name === "authichain_query_provenance") {
      const args = params.arguments ?? {};
      const assetId = args.assetId ?? args.sealId ?? args.serial ?? args.id;
      return rpcResult(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify(queryProvenance(assetId), null, 2),
          },
        ],
      });
    }
    return rpcResult(id, {
      content: [
        {
          type: "text",
          text: "Unknown tool. Use get_pricing (free), query_provenance (free, not an attestation), or verify (unpaid HTTP 402 on POST /mcp, $0.05 USDC on Base).",
        },
      ],
      isError: true,
    });
  }

  return rpcError(id, `Method not found: ${method}`);
}

export async function tryHandleMcp(
  request: Request,
  env: X402Env = {},
  verifyApp?: X402VerifyBinding
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
    hydrateX402(env);
    return json(200, discoveryBody());
  }

  if (request.method === "POST") {
    return handleRpc(request, env, verifyApp);
  }

  return json(405, { error: "method not allowed" });
}
