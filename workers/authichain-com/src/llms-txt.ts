/**
 * /llms.txt for agents. Point crawlers at Payment Links, unpaid POST /api/x402,
 * and the canonical Living QR scan. Do not tell them to GET /api/checkout.
 */
import {
  planById,
  planPaymentLink,
  planUsd,
  type PlanId,
} from "../../../src/lib/plans.ts";
import { x402PriceUsd } from "../../../src/lib/x402.ts";

const X402_USD = x402PriceUsd();

const LLMS_PATHS = new Set([
  "/llms.txt",
  "/llms.txt/",
  "/.well-known/llms.txt",
  "/.well-known/llms.txt/",
]);

export function isLlmsTxtPath(pathname: string): boolean {
  return LLMS_PATHS.has(pathname);
}

/** Listed plans only. Closed Launch checkouts 303 to /pricing. */
function listedCheckoutLine(
  id: PlanId,
  label: string,
  href?: string
): string | null {
  const plan = planById(id);
  if (!plan || plan.listed === false) return null;
  const link = href ?? planPaymentLink(id);
  if (!link) return null;
  const suffix = plan.price_suffix ?? "";
  return `- ${label} $${planUsd(id)}${suffix}: ${link}`;
}

export function renderLlmsTxt(): string {
  const dpp = planById("dpp_readiness");
  const humanCheckout = [
    "## Human checkout (Stripe Payment Links)",
    listedCheckoutLine("qron_launch", "QRON Launch"),
    listedCheckoutLine("qron_launch_annual", "QRON Launch Annual"),
    listedCheckoutLine("starter", "QRON Starter"),
    listedCheckoutLine("creator", "QRON Creator"),
    "- Generate (redirects to Starter): https://authichain.com/generate",
    listedCheckoutLine("dpp_readiness", dpp?.name ?? "EU DPP Workspace"),
    listedCheckoutLine(
      "musa_claim_file",
      "Made in USA Claim File",
      "https://authichain.com/made-in-usa-claim-file"
    ),
    listedCheckoutLine("strainchain_passport", "StrainChain Passport"),
    "- Pricing: https://authichain.com/pricing",
  ].filter((line): line is string => line !== null);

  return [
    "# AuthiChain",
    "> The authentic agentic economy. Signed seals, MCP verify, x402 pay-per-call.",
    "",
    "## Agent pay (x402)",
    `- Unpaid POST https://authichain.com/api/x402 returns HTTP 402 ($${X402_USD} USDC on Base)`,
    "- An empty JSON body is the unpaid HTTP 402. A non-UUID sealId is HTTP 400 before payment.",
    "- Canonical paid verify: POST https://authichain.com/api/v1/agent-verify",
    "- Read https://authichain.com/api/x402/health first. paidVerify.bound false means HTTP 503 before settlement and no payment is taken.",
    "- Catalog: https://authichain.com/api/x402/catalog",
    "- Listing pack: https://authichain.com/api/x402/listing",
    "- Growth registry: https://authichain.com/api/x402/growth",
    "- Well-known catalog: https://authichain.com/.well-known/x402.json",
    "- x402scan fan-out: https://authichain.com/.well-known/x402",
    "- OpenAPI: https://authichain.com/openapi.json",
    "- MCP: GET https://authichain.com/mcp (get_pricing free; tools/call verify is unpaid HTTP 402)",
    "- Docs: https://authichain.com/x402",
    "- Documentation: https://authichain.com/docs/gs1-digital-link",
    "- Verification: https://authichain.com/docs/verification",
    "- DPP architecture: https://authichain.com/docs/dpp-architecture",
    "- Examples: https://authichain.com/docs/examples",
    "",
    "## Protocol (this host verifies)",
    "- Issuer: https://authichain.com/protocol/issuer.json",
    "- JWKS: https://authichain.com/protocol/jwks.json",
    "- Well-known JWKS: https://authichain.com/.well-known/jwks.json",
    "- Decision v1 verify: POST https://authichain.com/api/v1/attestation/verify",
    "- Living QR scan: GET https://authichain.com/qron/r/{object_id}",
    "- This host verifies the signature. A missing id is HTTP 404 presentation_not_found.",
    "",
    "## Free tools",
    "- EU DPP readiness check (score, gaps, dated obligation): https://authichain.com/dpp-check",
    "- Same check for agents: MCP tools/call dpp_readiness_check on https://authichain.com/mcp",
    "- Battery passport gap map (e-bike / LMT example; passport required from 18 February 2027 under Regulation (EU) 2023/1542): https://authichain.com/battery-passport",
    "- Fictional e-bike battery walkthrough (not a document the $299 checkout sends): https://authichain.com/battery-passport/sample-audit",
    "",
    ...humanCheckout,
    "",
    "## Positioning",
    "- https://authichain.com/authentic-agentic-economy",
  ].join("\n");
}

export function tryHandleLlmsTxt(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (!isLlmsTxtPath(new URL(request.url).pathname)) return null;
  return new Response(request.method === "HEAD" ? null : renderLlmsTxt(), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
