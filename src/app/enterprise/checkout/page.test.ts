import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import EnterpriseCheckout from "./page";
import { planById, planPaymentLink } from "../../../lib/plans";

const html = renderToStaticMarkup(EnterpriseCheckout());

describe("/enterprise/checkout", () => {
  it("sells no off-catalogue price and posts to no missing API", () => {
    expect(html).not.toContain("$500");
    expect(html).not.toContain("/api/checkout/enterprise");
  });

  it("does not sell the Farm Plan (PM-222)", () => {
    const farm = planById("strainchain_farm");
    const link = planPaymentLink("strainchain_farm");
    expect(farm && link).toBeTruthy();
    expect(html).not.toContain(`$${farm!.price}`);
    expect(html).not.toContain(`href="${link}"`);
    expect(html).not.toContain("Farm Plan");
  });

  it("offers the anchor partnership as custom, with unbuilt features as roadmap", () => {
    expect(html).toContain('href="/contact"');
    expect(html).toContain("On the roadmap (not available yet)");
    // Roadmap items are not presented as included checkmarks.
    expect(html).not.toMatch(/✓<\/span>\s*Unlimited TruMark/);
  });
});
