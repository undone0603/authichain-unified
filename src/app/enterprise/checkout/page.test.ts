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

  it("prices the Farm Plan from plans.ts and links its gated checkout", () => {
    const farm = planById("strainchain_farm");
    const link = planPaymentLink("strainchain_farm");
    expect(farm && link).toBeTruthy();
    expect(html).toContain(`$${farm!.price}`);
    expect(html).toContain(`href="${link}"`);
  });

  it("offers the anchor partnership as custom, with unbuilt features as roadmap", () => {
    expect(html).toContain('href="/contact"');
    expect(html).toContain("On the roadmap (not available yet)");
    // Roadmap items are not presented as included checkmarks.
    expect(html).not.toMatch(/✓<\/span>\s*Unlimited TruMark/);
  });
});
