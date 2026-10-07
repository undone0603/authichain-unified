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

  it("prices the passport from plans.ts and does not link Farm", () => {
    const passport = planById("strainchain_passport");
    const link = planPaymentLink("strainchain_passport");
    const farmLink = planPaymentLink("strainchain_farm");
    expect(passport && link && farmLink).toBeTruthy();
    expect(html).toContain(`$${passport!.price}`);
    expect(html).toContain(`href="${link}"`);
    expect(html).not.toContain(farmLink);
    expect(html).not.toContain("Farm Plan");
  });

  it("offers the anchor partnership as custom, with unbuilt features as roadmap", () => {
    expect(html).toContain('href="/contact"');
    expect(html).toContain("On the roadmap (not available yet)");
    // Roadmap items are not presented as included checkmarks.
    expect(html).not.toMatch(/✓<\/span>\s*Unlimited TruMark/);
  });
});
