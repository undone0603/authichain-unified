import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AUTHENTIC_AGENTIC_ECONOMY,
  isAuthenticAgenticEconomyPath,
  renderAuthenticAgenticEconomyPage,
} from "./authentic-agentic-economy-page";

describe("authentic agentic economy page", () => {
  it("recognizes only the canonical path", () => {
    expect(isAuthenticAgenticEconomyPath("/authentic-agentic-economy")).toBe(
      true
    );
    expect(isAuthenticAgenticEconomyPath("/authentic-agentic-economy/")).toBe(
      true
    );
    expect(isAuthenticAgenticEconomyPath("/agentic-economy")).toBe(false);
    expect(isAuthenticAgenticEconomyPath("/x402")).toBe(false);
    expect(isAuthenticAgenticEconomyPath("/")).toBe(false);
  });

  it("renders the positioning phrase and live estate paths", () => {
    const html = renderAuthenticAgenticEconomyPage();
    expect(AUTHENTIC_AGENTIC_ECONOMY.description).toBe(
      "AuthiChain is the authentic agentic economy: signed seals, MCP tools, and x402 pay-per-call so agents can trust physical products."
    );
    expect(html).toContain(
      `<meta name="description" content="${AUTHENTIC_AGENTIC_ECONOMY.description}">`
    );
    expect(html).toContain(
      `<meta property="og:description" content="${AUTHENTIC_AGENTIC_ECONOMY.description}">`
    );
    expect(html).not.toContain('name="description" content=""');
    expect(html).not.toContain("fully autonomous");
    expect(html).not.toContain("5-agent");
    expect(html).toContain(
      "<title>The authentic agentic economy — AuthiChain</title>"
    );
    expect(html).toContain("The authentic agentic economy");
    expect(html).toContain(
      "Agents can pay. They still need to know if it is real."
    );
    expect(html).toContain('name="email"');
    expect(html).toContain('action="https://authichain.com/checkout/dpp_readiness"');
    expect(html).not.toContain('href="/api/checkout');
    expect(html).toContain(
      'href="https://authichain.com/checkout/dpp_readiness"'
    );
    expect(html).toContain('href="/x402"');
    expect(html).toContain('href="/onboard"');
    expect(html).toContain('href="/pricing"');
    expect(html).toContain("$0.05");
    expect(html).toContain("HTTP 402");
    expect(html).toContain("not Polygon $QRON");
    expect(html).not.toContain("GET /api/checkout");
    expect(html).toContain('<main id="main">');
    expect(html).toContain(
      'rel="canonical" href="https://authichain.com/authentic-agentic-economy"'
    );
  });

  it("cites public research without claiming AuthiChain authored it", () => {
    const html = renderAuthenticAgenticEconomyPage();
    expect(html).toContain("arxiv.org/abs/2602.14219");
    expect(html).toContain("abstract_id=6068907");
    expect(html).toContain("ERC8004SPEC.md");
    expect(html).toContain("not AuthiChain whitepapers");
    expect(html).toContain("not an ERC-8004 implementation claim");
    expect(html).not.toContain("FedRAMP");
    expect(html).not.toContain("NSF award");
    expect(html.toLowerCase()).not.toContain("facilitator.payai");
  });

  it("matches the SEO seed meta description", () => {
    const pagesPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../content/seo/pages.json"
    );
    const pages = JSON.parse(readFileSync(pagesPath, "utf8")) as Array<{
      slug?: string;
      metaDescription?: string;
    }>;
    const seed = pages.find(page => page.slug === "authentic-agentic-economy");
    expect(seed?.metaDescription).toBe(AUTHENTIC_AGENTIC_ECONOMY.description);
  });

  it("emits Organization slogan JSON-LD", () => {
    const html = renderAuthenticAgenticEconomyPage();
    expect(html).toContain('"slogan":"The authentic agentic economy"');
    expect(html).toContain('"@type":"Article"');
    expect(html).toContain('"@type":"FAQPage"');
    expect(AUTHENTIC_AGENTIC_ECONOMY.canonicalUrl).toBe(
      "https://authichain.com/authentic-agentic-economy"
    );
  });
});
