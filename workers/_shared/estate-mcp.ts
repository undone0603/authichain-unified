/**
 * Live sister /mcp (qron.space, strainchain.io, govchain.us) 404s today.
 * Agents that probe `{origin}/mcp` the way they do on authichain.com get
 * nothing.
 *
 * GET is free discovery: Payment Links from plans.ts (Passport, DPP, Farm;
 * QRON also Starter+Creator) + unpaid POST /api/x402. tools/call verify is
 * the same unpaid 402 as estate-x402.ts. Catalog stays on authichain.com
 * (#1171 owns sister catalog). Do not tell agents to GET /api/checkout.
 * Do not invent Stripe links. Do not list theater.
 */
import { planPaymentLink, planUsd } from "../../src/lib/plans.ts";
import {
  BASE_USDC_ASSET,
  X402_PUBLISHED_PAY_TO,
  buildPaymentRequired,
  parsePaymentHeader,
  readPaymentProofHeader,
  X402_REGISTRY_NOT_BOUND,
  x402PriceUsd,
  type X402HealthEnv,
} from "../../src/lib/x402.ts";
import type { SisterDiscoveryBrand } from "./estate-agent-discovery.ts";
import { sisterOrigin, type SisterX402Env } from "./estate-x402.ts";

const JSON_HEADERS = {
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
};

const PASSPORT_LINK = planPaymentLink("strainchain_passport") ?? "";
const DPP_LINK = planPaymentLink("dpp_readiness") ?? "";
const FARM_LINK = planPaymentLink("strainchain_farm") ?? "";
const STARTER_LINK = planPaymentLink("starter") ?? "";
const CREATOR_LINK = planPaymentLink("creator") ?? "";

const BRAND_NAME: Record<SisterDiscoveryBrand, string> = {
  qron: "qron",
  strainchain: "strainchain",
  govchain: "govchain",
};

/** Linear trailing-slash strip — CodeQL flags /\/+$/ as quadratic. */
function normalizePath(pathname: string): string {
  if (pathname.length <= 1) return pathname;
  let end = pathname.length;
  while (end > 1 && pathname.charCodeAt(end - 1) === 47) end--;
  return pathname.slice(0, end);
}

export function isSisterMcpPath(pathname: string): boolean {
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

function hydrateX402(env?: SisterX402Env) {
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

function publishedPayTo(env?: SisterX402Env): string {
  return (
    env?.X402_PAY_TO?.trim() ||
    process.env.X402_PAY_TO?.trim() ||
    X402_PUBLISHED_PAY_TO
  );
}

function mcpTools(brand: SisterDiscoveryBrand) {
  const human =
    brand === "qron"
      ? "StrainChain Passport, Farm, EU DPP, and QRON Starter/Creator Payment Links"
      : "StrainChain Passport, Farm, and EU DPP Payment Links";
  return [
    {
      name: "get_pricing",
      description: `Live ${BRAND_NAME[brand]} prices: ${human} for humans; unpaid POST /api/x402 ($0.05 USDC on Base) for agents.`,
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
}

export function sisterMcpPricingDiscovery(brand: SisterDiscoveryBrand) {
  const origin = sisterOrigin(brand);
  const humanCheckout: Record<string, unknown> = {
    rail: "stripe",
    source: "src/lib/plans.ts",
    passportUsd: planUsd("strainchain_passport"),
    dppUsd: planUsd("dpp_readiness"),
    farmUsd: planUsd("strainchain_farm"),
    passportPaymentLink: PASSPORT_LINK,
    dppPaymentLink: DPP_LINK,
    farmPaymentLink: FARM_LINK,
    emailCapture: {
      passport: "https://authichain.com/passport",
      dpp: "https://authichain.com/dpp",
      pricing: `${origin}/pricing`,
    },
  };
  if (brand === "qron") {
    humanCheckout.starterUsd = planUsd("starter");
    humanCheckout.creatorUsd = planUsd("creator");
    humanCheckout.starterPaymentLink = STARTER_LINK;
    humanCheckout.creatorPaymentLink = CREATOR_LINK;
  }
  return {
    agentRail: {
      endpoint: "POST /api/x402",
      protocol: "x402",
      network: "base",
      chainId: "8453",
      asset: BASE_USDC_ASSET,
      publishedPayTo: X402_PUBLISHED_PAY_TO,
      pricePerCall: `$${x402PriceUsd()} USDC`,
      catalog: "https://authichain.com/api/x402/catalog",
      wellKnown: "https://authichain.com/.well-known/x402.json",
      mcp: `${origin}/mcp`,
      docs: "https://authichain.com/x402",
      note: "Unpaid POST /api/x402 and unpaid MCP tools/call verify return HTTP 402; pay Base USDC and retry with X-PAYMENT.",
    },
    humanCheckout,
  };
}

function discoveryBody(brand: SisterDiscoveryBrand) {
  const origin = sisterOrigin(brand);
  return {
    protocol: "mcp",
    jsonrpc: "2.0",
    serverInfo: { name: BRAND_NAME[brand], version: "1.0.0" },
    tools: mcpTools(brand),
    pricing: sisterMcpPricingDiscovery(brand),
    pay: {
      x402: `POST ${origin}/api/x402`,
      mcpVerify: `POST ${origin}/mcp tools/call verify`,
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

function paidResourceUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}${normalizePath(url.pathname)}`;
}

async function unpaidOrRefusedVerify(
  request: Request,
  env: SisterX402Env | undefined,
  args: Record<string, unknown>
): Promise<Response> {
  hydrateX402(env);
  const payTo = publishedPayTo(env);
  const resource = paidResourceUrl(request);
  const priceUsd = x402PriceUsd(env?.X402_PRICE_USD);
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

  // No registry lookup is bound here: refuse before settlePayment() so the
  // agent is never charged for an answer that cannot be real.
  return json(503, X402_REGISTRY_NOT_BOUND);
}

async function handleRpc(
  request: Request,
  brand: SisterDiscoveryBrand,
  env?: SisterX402Env
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
  const tools = mcpTools(brand);

  if (method === "initialize" || method === "notifications/initialized") {
    return rpcResult(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: BRAND_NAME[brand], version: "1.0.0" },
    });
  }

  if (method === "tools/list") {
    return rpcResult(id, { tools });
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
            text: JSON.stringify(sisterMcpPricingDiscovery(brand), null, 2),
          },
        ],
      });
    }
    if (name === "verify" || name === "authichain_verify_product") {
      return unpaidOrRefusedVerify(request, env, params.arguments ?? {});
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

/** Serve GET/HEAD discovery and unpaid POST 402 on a sister landing worker. */
export async function tryHandleSisterMcp(
  request: Request,
  brand: SisterDiscoveryBrand,
  env: SisterX402Env = {}
): Promise<Response | null> {
  if (!isSisterMcpPath(new URL(request.url).pathname)) return null;

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
    return json(200, discoveryBody(brand));
  }

  if (request.method === "POST") {
    return handleRpc(request, brand, env);
  }

  return json(405, { error: "method not allowed" });
}
