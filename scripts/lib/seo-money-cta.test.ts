import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  DPP_CHECKOUT_HREF,
  PASSPORT_CHECKOUT_HREF,
  PRICING_HREF,
  moneyCtaHtml,
  moneyCtaLinks,
} = require("./seo-money-cta.cjs") as {
  DPP_CHECKOUT_HREF: string;
  PASSPORT_CHECKOUT_HREF: string;
  PRICING_HREF: string;
  moneyCtaHtml: (keyword: string, brand: string) => string;
  moneyCtaLinks: (
    keyword: string,
    brand: string
  ) => Array<{ href: string; label: string }>;
};

describe("SEO hub money CTAs", () => {
  it("uses the live AuthiChain DPP checkout path, not an invented URL", () => {
    expect(DPP_CHECKOUT_HREF).toBe("https://authichain.com/api/checkout/dpp");
    expect(PASSPORT_CHECKOUT_HREF).toBe(
      "https://authichain.com/api/checkout/plan/strainchain_passport"
    );
    expect(PRICING_HREF).toBe("/pricing");
  });

  it("gives DPP/battery/textile keywords DPP checkout plus pricing", () => {
    for (const keyword of [
      "eu digital product passport batteries",
      "eu digital product passport textiles",
      "battery passport qr code requirements",
      "eu dpp access rights management standard en 18239",
    ]) {
      const links = moneyCtaLinks(keyword, "authichain");
      expect(links.map(l => l.href)).toEqual([DPP_CHECKOUT_HREF, PRICING_HREF]);
      const html = moneyCtaHtml(keyword, "authichain");
      expect(html).toContain(`href="${DPP_CHECKOUT_HREF}"`);
      expect(html).toContain(`href="${PRICING_HREF}"`);
      expect(html).not.toContain("$");
      expect(html).not.toContain("<h2>FAQ</h2>");
    }
  });

  it("does not send battery-passport keywords to StrainChain checkout", () => {
    const html = moneyCtaHtml(
      "global battery alliance battery passport vs eu regulation",
      "authichain"
    );
    expect(html).toContain(DPP_CHECKOUT_HREF);
    expect(html).not.toContain(PASSPORT_CHECKOUT_HREF);
  });

  it("gives StrainChain cannabis/metrc/passport keywords plan checkout", () => {
    for (const [keyword, brand] of [
      ["blockchain qr code for cannabis", "strainchain"],
      ["product authentication for cannabis dispensary", "strainchain"],
      ["metrc compliance blockchain", "strainchain"],
      ["federal hemp redefinition 2026 interstate traceability", "strainchain"],
    ] as const) {
      const links = moneyCtaLinks(keyword, brand);
      expect(links[0]?.href).toBe(PASSPORT_CHECKOUT_HREF);
      const html = moneyCtaHtml(keyword, brand);
      expect(html).toContain(`href="${PASSPORT_CHECKOUT_HREF}"`);
      expect(html).toContain(`href="${PRICING_HREF}"`);
      expect(html).not.toContain(DPP_CHECKOUT_HREF);
      expect(html).not.toContain("$");
    }
  });

  it("gives other brands pricing only", () => {
    for (const [keyword, brand] of [
      ["gs1 digital link sunrise 2027", "qron"],
      ["blockchain qr code for defense", "govchain"],
      ["blockchain qr code for luxury", "authichain"],
    ] as const) {
      const links = moneyCtaLinks(keyword, brand);
      expect(links).toEqual([{ href: PRICING_HREF, label: "View pricing" }]);
      const html = moneyCtaHtml(keyword, brand);
      expect(html).toContain(`href="${PRICING_HREF}"`);
      expect(html).not.toContain("/api/checkout/");
      expect(html).not.toContain("$");
    }
  });
});
