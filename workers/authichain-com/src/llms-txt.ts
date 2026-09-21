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
    "- Well-known: https://authichain.com/.well-known/x402.json",
    "- Docs: https://authichain.com/x402",
    "",
    "## Human checkout (Stripe Payment Links)",
    `- EU DPP Readiness $${planUsd("dpp_readiness")}: ${DPP_LINK}`,
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
