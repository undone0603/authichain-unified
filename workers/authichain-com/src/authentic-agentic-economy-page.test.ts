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
      "The authentic agentic economy: signed seals, MCP, and x402. A signed record is not a physical inspection."
    );
    expect(AUTHENTIC_AGENTIC_ECONOMY.description).not.toContain(
      "trust physical products"
    );
    expect(html).toContain(
      `<meta name="description" content="${AUTHENTIC_AGENTIC_ECONOMY.description}">`
    );
    expect(html).not.toContain('name="description" content=""');
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
    expect(html).toContain("empty JSON body");
    expect(html).toContain("A non-UUID sealId is HTTP 400 before payment.");
    expect(html).toContain("not a paid receipt");
    expect(html).toContain("not a physical inspection");
    expect(html).toContain(
      "Our goal: an agent checks a signed seal and is told the seal is not a physical inspection."
    );
    expect(html).toContain(
      "Our goal: a reader can tell a free seal answer from a settled receipt on the live x402 rail."
    );
    expect(html).toContain(
      "Our goal: cite ERC-8004 as an external description of agent registries, not as an AuthiChain implementation."
    );
    expect(html).not.toContain(
      "Our goal: a reader can tell the unpaid empty body from a free seal answer and from a settled receipt."
    );
    expect(html).not.toContain(
      "Our goal: the seed names polygon-anchor-1 as the published demonstration record and never as a customer product."
    );
    const meta = html.match(/<meta name="description" content="([^"]*)"/);
    const og = html.match(/<meta property="og:description" content="([^"]*)"/);
    expect(meta?.[1]).toBe(AUTHENTIC_AGENTIC_ECONOMY.description);
    expect(og?.[1]).toBe(AUTHENTIC_AGENTIC_ECONOMY.description);
    expect(meta?.[1]).not.toContain("Our goal");
    expect(og?.[1]).not.toContain("Our goal");
    expect(html).toContain("X-PAYMENT and a seal UUID");
    expect(html).not.toContain("seal or product identifier");
    expect(html).not.toContain("Polygon · ERC-721");
    expect(html).not.toContain("trust physical products");
    expect(html).not.toContain("verify authenticity");
    expect(html).not.toContain("physical-world authenticity");
    expect(html).not.toContain("accept the goods");
    expect(html).toContain("Signed seals · x402 on Base · EU DPP");
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
    expect(html).toContain(
      "Our goal: cite ERC-8004 as an external description of agent registries, not as an AuthiChain implementation."
    );
    expect(html).not.toContain("FedRAMP");
    expect(html).not.toContain("NSF award");
    expect(html.toLowerCase()).not.toContain("facilitator.payai");
  });

  it("uses the same meta description as the SEO seed", () => {
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
    expect(seed?.metaDescription).not.toContain("Our goal");
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
