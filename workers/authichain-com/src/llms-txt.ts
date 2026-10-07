/**
 * /llms.txt for agents. Live apex 404s this path today because the gateway
 * handler never runs — landing 404s first. Point crawlers at Payment Links
 * and unpaid POST /api/x402. Do not tell them to GET /api/checkout.
 */
import { planPaymentLink, planUsd } from "../../../src/lib/plans.ts";
import { x402PriceUsd } from "../../../src/lib/x402.ts";

const PASSPORT_LINK = planPaymentLink("strainchain_passport") ?? "";
const DPP_LINK = planPaymentLink("dpp_readiness") ?? "";
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

export function renderLlmsTxt(): string {
  return [
    "# AuthiChain",
    "> The authentic agentic economy. Signed seals, MCP verify, x402 pay-per-call.",
    "",
    "## Agent pay (x402)",
    `- Unpaid POST https://authichain.com/api/x402 returns HTTP 402 ($${X402_USD} USDC on Base)`,
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
    "## Free tools",
    "- EU DPP readiness check (score, gaps, dated obligation): https://authichain.com/dpp-check",
    "- Same check for agents: MCP tools/call dpp_readiness_check on https://authichain.com/mcp",
    "- Battery passport gap map (e-bike / LMT example; passport required from 18 February 2027 under Regulation (EU) 2023/1542): https://authichain.com/battery-passport",
    "- Fictional e-bike battery walkthrough (not a document the $299 checkout sends): https://authichain.com/battery-passport/sample-audit",
    "",
    "## Human checkout (Stripe Payment Links)",
    `- EU DPP Readiness $${planUsd("dpp_readiness")}: ${DPP_LINK}`,
    `- Made in USA Claim File $${planUsd("musa_claim_file")} per SKU: https://authichain.com/made-in-usa-claim-file`,
    `- StrainChain Passport $${planUsd("strainchain_passport")}: ${PASSPORT_LINK}`,
    "- Pricing: https://authichain.com/pricing",
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
