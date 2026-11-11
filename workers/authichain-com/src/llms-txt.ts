/**
 * /llms.txt for agents. Point crawlers at Payment Links, unpaid POST /api/x402,
 * and the canonical Living QR scan. Do not tell them to GET /api/checkout.
 */
import { catalogOffers } from "../../../src/lib/plans.ts";
import {
  X402_PUBLISHED_PAY_TO,
  x402PriceUsd,
} from "../../../src/lib/x402.ts";

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
  const humanCheckout = [
    "## Human checkout (Stripe Payment Links)",
    ...catalogOffers().map(offer => {
      const suffix = offer.priceSuffix ?? "";
      return `- ${offer.name} $${offer.usd}${suffix}: ${offer.checkout}`;
    }),
    "- Generate (redirects to Starter): https://authichain.com/generate",
    "- Pricing: https://authichain.com/pricing",
  ];

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
    "- Published demonstration record, not a customer product: GET https://authichain.com/api/verify?id=polygon-anchor-1",
    "- Record JSON: https://authichain.com/protocol/examples/polygon-anchor-1.record.json",
    "- Anchor JSON: https://authichain.com/protocol/examples/polygon-anchor-1.anchor.json",
    "",
    "## Free tools",
    "- EU DPP readiness check (score, gaps, dated obligation): https://authichain.com/dpp-check",
    "- Same check for agents: MCP tools/call dpp_readiness_check on https://authichain.com/mcp",
    "- Battery passport gap map (e-bike / LMT example; passport required from 18 February 2027 under Regulation (EU) 2023/1542): https://authichain.com/battery-passport",
    "- Fictional Ed25519-signed LMT demonstration record (signed by bundled demo key https://authichain.com/battery-passport/sample.jwks.json, not live /.well-known/jwks.json; not an Article 77 passport): https://authichain.com/battery-passport/sample",
    "- Fictional e-bike battery walkthrough (not a document the $299 checkout sends): https://authichain.com/battery-passport/sample-audit",
    "- Proof-of-Support (human coffee, zero platform cut, not tax-deductible): https://authichain.com/coffee — GET Accept: application/json or ?rail=x402 returns HTTP 402 Base USDC (eip155:8453). Ed25519 receipts and Thanks for the coffee mint on verified Stripe Checkout; automated x402 facilitator settlement is not wired on /coffee yet. POST https://authichain.com/api/coffee/checkout creates a Stripe Checkout Session.",
    "",
    ...humanCheckout,
    "",
    ...whenToUseLines(),
    "",
    "## Positioning",
    "- https://authichain.com/authentic-agentic-economy",
  ].join("\n");
}

function whenToUseLines(): string[] {
  return [
    "## When to use this",
    "- Use AuthiChain when an agent needs a paid, machine-readable check of a signed product seal before trusting a physical-good claim.",
    `- Pay $${X402_USD} USDC on Base per paid verify. Unpaid POST https://authichain.com/api/v1/agent-verify returns HTTP 402.`,
    "- Use free MCP tools get_pricing, verify_record, and dpp_readiness_check when you only need a quote or a demonstration record.",
    "- Humans buy the QRON Starter Pack ($29) or EU DPP Workspace ($299) on Stripe Payment Links listed above.",
  ];
}

function explicitMediaQuality(header: string, type: string): number {
  let best = 0;
  const wanted = type.toLowerCase();
  for (const part of header.split(",")) {
    const [rawType, ...params] = part.trim().split(";").map(s => s.trim());
    if (!rawType) continue;
    let q = 1;
    for (const p of params) {
      const m = /^q=([0-9.]+)$/i.exec(p);
      if (m) {
        const parsed = Number(m[1]);
        q = Number.isFinite(parsed) ? parsed : 0;
      }
    }
    if (rawType.toLowerCase() === wanted && q > best) best = q;
  }
  return best;
}

/** True only when Accept names text/markdown at least as strongly as text/html. */
export function prefersMarkdown(request: Request): boolean {
  const header = request.headers.get("Accept") ?? "";
  if (!/\btext\/markdown\b/i.test(header)) return false;
  const md = explicitMediaQuality(header, "text/markdown");
  const html = explicitMediaQuality(header, "text/html");
  return md > 0 && md >= html;
}

export function renderHomepageMarkdown(): string {
  return [
    renderLlmsTxt(),
    "",
    "## Offer (machine-readable)",
    "- WHAT IS SOLD: paid evidence check for agents — signed record, machine-readable verification result, explicit unknowns, and a settlement receipt.",
    `- WHAT IT COSTS: $${X402_USD} USDC on Base (50000 atomic).`,
    `- HOW TO PAY: unpaid POST https://authichain.com/api/v1/agent-verify returns HTTP 402; retry with X-PAYMENT or PAYMENT-SIGNATURE. payTo ${X402_PUBLISHED_PAY_TO}.`,
    "- WHAT YOU RECEIVE: JSON verify body from the seal registry.",
    "- HOW DELIVERY IS VERIFIED: settlement receipt in the paid response. A valid signature is not real-world truth. Unpaid empty body is 402; a non-UUID sealId is 400 before payment.",
    "- Human checkout: Starter Pack $29 at https://authichain.com/checkout/starter ; EU DPP Workspace $299 at https://authichain.com/checkout/dpp_readiness .",
  ].join("\n");
}

export function renderNotFoundMarkdown(pathname: string): string {
  return [
    "# 404 — Not Found",
    "",
    `\`${pathname}\` is not a page on authichain.com.`,
    "",
    "Agent catalog: https://authichain.com/llms.txt",
    `Paid verify: POST https://authichain.com/api/v1/agent-verify (unpaid HTTP 402, $${X402_USD} USDC on Base)`,
    "Human checkout: https://authichain.com/pricing",
    "x402 docs: https://authichain.com/x402",
  ].join("\n");
}

export function markdownResponse(
  body: string,
  status: number,
  method: string
): Response {
  return new Response(method === "HEAD" ? null : body, {
    status,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept",
      "Cache-Control": status === 404 ? "no-store" : "public, max-age=300",
    },
  });
}

export function tryHandleHomepageMarkdown(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const path = new URL(request.url).pathname;
  if (path !== "/" && path !== "") return null;
  if (!prefersMarkdown(request)) return null;
  return markdownResponse(renderHomepageMarkdown(), 200, request.method);
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
