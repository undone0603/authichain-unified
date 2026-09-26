import { describe, expect, it } from "vitest";
import {
  PRICING_TEST,
  PRICING_TEST_COOKIE,
  assignVariant,
  plainHeadline,
  tagCheckoutHref,
  variantFromCookie,
  variantTag,
} from "./pricing-test";
import { listedPlans } from "./plans";

describe("pricing test", () => {
  it("ships with the flag off", () => {
    expect(PRICING_TEST.active).toBe(false);
  });

  it("reads only a valid stored variant", () => {
    expect(variantFromCookie(`x=1; ${PRICING_TEST_COOKIE}=b`)).toBe("b");
    expect(variantFromCookie(`${PRICING_TEST_COOKIE}=z`)).toBeNull();
    expect(variantFromCookie("")).toBeNull();
  });

  it("splits 50/50", () => {
    expect(assignVariant(0)).toBe("a");
    expect(assignVariant(0.49)).toBe("a");
    expect(assignVariant(0.5)).toBe("b");
    expect(assignVariant(0.99)).toBe("b");
  });

  it("tags checkout links without clobbering an existing utm_content", () => {
    const tagged = new URL(
      tagCheckoutHref(
        "https://authichain.com/checkout/starter?utm_source=x",
        "b"
      )
    );
    expect(tagged.searchParams.get("utm_content")).toBe(variantTag("b"));
    expect(tagged.searchParams.get("utm_source")).toBe("x");
    const kept = "https://authichain.com/checkout/starter?utm_content=mail";
    expect(tagCheckoutHref(kept, "a")).toBe(kept);
    expect(tagCheckoutHref("/onboard", "a")).toBe("/onboard");
  });

  it("prices the variant headline from the plan catalogue", () => {
    const from = Math.min(
      ...listedPlans("qron")
        .filter(p => p.price > 0)
        .map(p => p.price)
    );
    expect(plainHeadline(from)).toBe(
      `Verifiable product seals from $${from}. No sales call.`
    );
  });
});
