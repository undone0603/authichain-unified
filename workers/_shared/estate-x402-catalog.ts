/**
 * Sister-origin machine catalog for agents that probe
 * `{origin}/api/x402/catalog` and `/.well-known/x402.json`.
 *
 * Same class of payload authichain.com already serves: unpaid x402 price +
 * payTo from health, plus humanCheckout Payment Links from plans.ts
 * (Passport, DPP, Farm; QRON also Starter + Creator). Do not invent Stripe
 * URLs. Do not add GET /api/checkout. Do not publish a facilitator URL.
 */
import { planPaymentLink, planUsd } from "../../src/lib/plans.ts";
import {
  x402Caip2Network,
  x402HealthReport,
  type X402CatalogEndpoint,
  type X402HealthBody,
  type X402HealthEnv,
} from "../../src/lib/x402.ts";
import { ESTATE_BRANDS } from "./estate-landing.ts";
import type { SisterDiscoveryBrand } from "./estate-agent-discovery.ts";

export type SisterHumanCheckout = {
  rail: "stripe";
  passportUsd: number;
  dppUsd: number;
  farmUsd: number;
  passportPaymentLink?: string;
  dppPaymentLink?: string;
  farmPaymentLink?: string;
  starterUsd?: number;
  creatorUsd?: number;
  starterPaymentLink?: string;
  creatorPaymentLink?: string;
  source: "src/lib/plans.ts";
};

export type SisterX402CatalogBody = {
  protocol: "x402";
  x402Version: 2;
  brand: string;
  docs: string;
  health: string;
  catalog: string;
  wellKnown: string;
  tokenomics: string;
  identity: string;
  unitOfAccount: "USDC";
  network: string;
  chainId: string;
  asset: string;
  payTo: string | null;
  pricePerCall: { usd: number; atomic: string };
  dailyCapUsd: number;
  status: X402HealthBody["status"];
  ready: boolean;
  mode: X402HealthBody["mode"];
  endpoints: X402CatalogEndpoint[];
  humanCheckout: SisterHumanCheckout;
  discovery: {
    bazaarDeclared: true;
    declaredOn: "POST /api/x402 402 body extensions.bazaar and PAYMENT-REQUIRED header";
    paymentRequiredHeader: true;
  };
  timestamp: string;
};

export function sisterBrandFromHost(host: string): SisterDiscoveryBrand | null {
  const h = host.split(":")[0].toLowerCase();
  if (h === "qron.space") return "qron";
  if (h === "strainchain.io") return "strainchain";
  if (h === "govchain.us") return "govchain";
  return null;
}

function humanCheckout(
  brand: SisterDiscoveryBrand | null
): SisterHumanCheckout {
  const checkout: SisterHumanCheckout = {
    rail: "stripe",
    passportUsd: planUsd("strainchain_passport"),
    dppUsd: planUsd("dpp_readiness"),
    farmUsd: planUsd("strainchain_farm"),
    passportPaymentLink: planPaymentLink("strainchain_passport"),
    dppPaymentLink: planPaymentLink("dpp_readiness"),
    farmPaymentLink: planPaymentLink("strainchain_farm"),
    source: "src/lib/plans.ts",
  };
  if (brand === "qron") {
    checkout.starterUsd = planUsd("starter");
    checkout.creatorUsd = planUsd("creator");
    checkout.starterPaymentLink = planPaymentLink("starter");
    checkout.creatorPaymentLink = planPaymentLink("creator");
  }
  return checkout;
}

/**
 * Machine catalog for a sister apex. Price / payTo / asset copy health —
 * never a second schedule. Endpoints are only paths the sister worker
 * actually answers (no /mcp, no /api/checkout).
 */
export async function sisterX402Catalog(
  brand: SisterDiscoveryBrand | null,
  env: X402HealthEnv = {}
): Promise<SisterX402CatalogBody> {
  const health = await x402HealthReport(env);
  const paid = (path: string, description: string): X402CatalogEndpoint => ({
    method: "POST",
    path,
    paid: true,
    description,
    priceUsd: health.pricePerCall.usd,
    priceAtomic: health.pricePerCall.atomic,
    unpaidStatus: 402,
  });
  const free = (path: string, description: string): X402CatalogEndpoint => ({
    method: "GET",
    path,
    paid: false,
    description,
    priceUsd: null,
    priceAtomic: null,
  });
  const name = brand ? ESTATE_BRANDS[brand].name : "AuthiChain";
  return {
    protocol: "x402",
    x402Version: 2,
    brand: name,
    docs: "https://authichain.com/x402",
    health: "/api/x402/health",
    catalog: "/api/x402/catalog",
    wellKnown: "/.well-known/x402.json",
    tokenomics:
      "https://github.com/undone0603/authichain-unified/blob/main/docs/strategy/AGENT_TOKENOMICS_x402.md",
    identity:
      "https://github.com/undone0603/authichain-unified/blob/main/docs/strategy/WEB3_IDENTITY.md",
    unitOfAccount: "USDC",
    network: x402Caip2Network(health.network),
    chainId: health.chainId,
    asset: health.asset,
    payTo: health.payTo,
    pricePerCall: health.pricePerCall,
    dailyCapUsd: health.dailyCapUsd,
    status: health.status,
    ready: health.ready,
    mode: health.mode,
    endpoints: [
      free("/api/x402/health", "Public rail health (no secrets)"),
      free("/api/x402", "Health alias"),
      free("/api/x402/catalog", "Paid-endpoint catalog for agents"),
      free("/.well-known/x402.json", "Well-known catalog document"),
      free("/.well-known/x402", "x402scan fan-out (version + resources)"),
      free("/openapi.json", "OpenAPI 3.1 with x-payment-info for x402scan"),
      free(
        "/llms.txt",
        "Agent-readable discovery (Payment Links + unpaid POST)"
      ),
      paid("/api/x402", "AuthiChain agent verification (seal / product)"),
    ],
    humanCheckout: humanCheckout(brand),
    discovery: {
      bazaarDeclared: true,
      declaredOn:
        "POST /api/x402 402 body extensions.bazaar and PAYMENT-REQUIRED header",
      paymentRequiredHeader: true,
    },
    timestamp: health.timestamp,
  };
}
