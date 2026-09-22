/**
 * Agent discovery on sister apexes (qron.space, strainchain.io, govchain.us).
 *
 * Live those hosts 404 /llms.txt and /openapi.json, so crawlers never see
 * Payment Links or unpaid POST /api/x402. OpenAPI servers.url is this
 * origin so x402scan probing `{origin}/api/x402` matches the spec. The
 * unpaid 402 itself is served by estate-x402.ts. Do not tell them to GET
 * /api/checkout.
 */
import { planPaymentLink, planUsd } from "../../src/lib/plans.ts";
import { x402PriceUsd } from "../../src/lib/x402.ts";
import { ESTATE_BRANDS, type EstateBrandId } from "./estate-landing.ts";

const PASSPORT_LINK = planPaymentLink("strainchain_passport") ?? "";
const DPP_LINK = planPaymentLink("dpp_readiness") ?? "";
const FARM_LINK = planPaymentLink("strainchain_farm") ?? "";
const STARTER_LINK = planPaymentLink("starter") ?? "";
const CREATOR_LINK = planPaymentLink("creator") ?? "";
const X402_USD = x402PriceUsd();

const LLMS_PATHS = new Set([
  "/llms.txt",
  "/llms.txt/",
  "/.well-known/llms.txt",
  "/.well-known/llms.txt/",
]);

const OPENAPI_PATHS = new Set(["/openapi.json", "/openapi.json/"]);

export type SisterDiscoveryBrand = Exclude<EstateBrandId, "authichain">;

const BRAND_COPY: Record<
  SisterDiscoveryBrand,
  { title: string; lede: string }
> = {
  qron: {
    title: "QRON",
    lede: "Living QR codes that scan. AuthiChain estate.",
  },
  strainchain: {
    title: "StrainChain",
    lede: "Seed-to-sale provenance. AuthiChain estate.",
  },
  govchain: {
    title: "GovChain",
    lede: "Federal contract intelligence. AuthiChain estate.",
  },
};

export function isEstateLlmsTxtPath(pathname: string): boolean {
  return LLMS_PATHS.has(pathname);
}

export function isEstateOpenApiPath(pathname: string): boolean {
  return OPENAPI_PATHS.has(pathname);
}

export function isEstateAgentDiscoveryPath(pathname: string): boolean {
  return isEstateLlmsTxtPath(pathname) || isEstateOpenApiPath(pathname);
}

function humanCheckoutLines(brand: SisterDiscoveryBrand): string[] {
  const lines = [
    "## Human checkout (Stripe Payment Links)",
    `- EU DPP Readiness $${planUsd("dpp_readiness")}: ${DPP_LINK}`,
    `- StrainChain Passport $${planUsd("strainchain_passport")}: ${PASSPORT_LINK}`,
    `- StrainChain Farm Plan $${planUsd("strainchain_farm")}/mo: ${FARM_LINK}`,
  ];
  if (brand === "qron") {
    lines.push(
      `- QRON Starter $${planUsd("starter")}: ${STARTER_LINK}`,
      `- QRON Creator $${planUsd("creator")}: ${CREATOR_LINK}`
    );
  }
  lines.push(
    `- Pricing: https://${brand === "qron" ? "qron.space" : brand === "strainchain" ? "strainchain.io" : "govchain.us"}/pricing`,
    "- Canonical catalogue: https://authichain.com/pricing"
  );
  return lines;
}

export function renderEstateLlmsTxt(brand: SisterDiscoveryBrand): string {
  const meta = BRAND_COPY[brand];
  return [
    `# ${meta.title}`,
    `> ${meta.lede}`,
    "",
    "## Agent pay (x402)",
    `- Unpaid POST ${ESTATE_BRANDS[brand].url}/api/x402 returns HTTP 402 ($${X402_USD} USDC on Base)`,
    "- Canonical rail: https://authichain.com/api/x402",
    "- Catalog: https://authichain.com/api/x402/catalog",
    "- Well-known catalog: https://authichain.com/.well-known/x402.json",
    "- x402scan fan-out: https://authichain.com/.well-known/x402",
    "- OpenAPI: https://authichain.com/openapi.json",
    `- MCP: GET ${ESTATE_BRANDS[brand].url}/mcp (get_pricing free; tools/call verify is unpaid HTTP 402)`,
    "- Canonical MCP: GET https://authichain.com/mcp",
    "- Docs: https://authichain.com/x402",
    "",
    ...humanCheckoutLines(brand),
    "",
    "## Positioning",
    "- https://authichain.com/authentic-agentic-economy",
  ].join("\n");
}

export type EstateOpenApiDocument = {
  openapi: "3.1.0";
  info: {
    title: string;
    version: string;
    description: string;
    "x-human-checkout": {
      source: "src/lib/plans.ts";
      passportUsd: number;
      dppUsd: number;
      farmUsd: number;
      passportPaymentLink: string;
      dppPaymentLink: string;
      farmPaymentLink: string;
    };
  };
  servers: Array<{ url: string }>;
  paths: Record<string, unknown>;
};

export function renderEstateOpenApi(
  brand: SisterDiscoveryBrand
): EstateOpenApiDocument {
  const meta = BRAND_COPY[brand];
  const origin = ESTATE_BRANDS[brand].url;
  return {
    openapi: "3.1.0",
    info: {
      title: `${meta.title} agent pay (AuthiChain rails)`,
      version: "1.0.0",
      description: `Unpaid POST ${origin}/api/x402 returns HTTP 402. Human SKUs are Stripe Payment Links from src/lib/plans.ts. Canonical spec: https://authichain.com/openapi.json.`,
      "x-human-checkout": {
        source: "src/lib/plans.ts",
        passportUsd: planUsd("strainchain_passport"),
        dppUsd: planUsd("dpp_readiness"),
        farmUsd: planUsd("strainchain_farm"),
        passportPaymentLink: PASSPORT_LINK,
        dppPaymentLink: DPP_LINK,
        farmPaymentLink: FARM_LINK,
      },
    },
    servers: [{ url: origin }],
    paths: {
      "/api/x402": {
        get: {
          summary: "Rail health (free)",
          responses: { "200": { description: "Health" } },
        },
        post: {
          operationId: "agentVerify",
          summary: "AuthiChain agent verification",
          "x-payment-info": {
            protocols: ["x402"],
            price: {
              mode: "fixed",
              currency: "USD",
              amount: String(X402_USD),
            },
          },
          responses: {
            "402": { description: "Payment required (x402)" },
            "200": { description: "Paid verification result" },
          },
        },
      },
    },
  };
}

const TEXT_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "public, max-age=3600",
} as const;

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=3600",
} as const;

/** Serve GET/HEAD /llms.txt and /openapi.json from a sister landing worker. */
export function tryHandleEstateAgentDiscovery(
  request: Request,
  brand: SisterDiscoveryBrand
): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const pathname = new URL(request.url).pathname;
  if (isEstateLlmsTxtPath(pathname)) {
    return new Response(
      request.method === "HEAD" ? null : renderEstateLlmsTxt(brand),
      { status: 200, headers: TEXT_HEADERS }
    );
  }
  if (isEstateOpenApiPath(pathname)) {
    return new Response(
      request.method === "HEAD"
        ? null
        : JSON.stringify(renderEstateOpenApi(brand)),
      { status: 200, headers: JSON_HEADERS }
    );
  }
  return null;
}
