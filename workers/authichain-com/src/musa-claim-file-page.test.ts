import { describe, expect, it } from "vitest";
import {
  CLAIM_FILE_PATH,
  CLAIM_FILE_THANKS_PATH,
  isClaimFilePath,
  isClaimFileThanksPath,
  renderClaimFilePage,
  renderClaimFileThanksPage,
} from "./musa-claim-file-page.ts";
import { planById } from "../../../src/lib/plans";
import { buildGatedSessionBody } from "../../../src/lib/checkout-gate";

describe("Made in USA claim file page", () => {
  const html = renderClaimFilePage();
  const plan = planById("musa_claim_file")!;

  it("matches only its own paths", () => {
    expect(isClaimFilePath(CLAIM_FILE_PATH)).toBe(true);
    expect(isClaimFilePath(`${CLAIM_FILE_PATH}/`)).toBe(true);
    expect(isClaimFilePath("/made-in-america")).toBe(false);
    expect(isClaimFileThanksPath(CLAIM_FILE_THANKS_PATH)).toBe(true);
    expect(isClaimFilePath(CLAIM_FILE_THANKS_PATH)).toBe(false);
  });

  it("sells the claim file through the gated checkout, never the DPP audit", () => {
    expect(plan.price).toBe(299);
    // Listed since 2026-09-29: this page is no longer the only way to buy it,
    // but it must still sell it through the gated checkout rather than the DPP.
    expect(plan.listed).toBe(true);
    expect(html).toContain(
      'action="https://authichain.com/checkout/musa_claim_file"'
    );
    expect(html).not.toContain("checkout/dpp_readiness");
    expect(html).toContain('name="utm_campaign" value="musa-claim-file"');
    expect(html).toContain(`href="${plan.stripe_payment_link}"`);
    for (const f of plan.features) expect(html).toContain(f);
  });

  it("offers the $2,500 audit bundle through its own Payment Link", () => {
    const bundle = planById("musa_audit_bundle")!;
    expect(bundle.price).toBe(2500);
    // Listed since 2026-09-29; this page still offers it via its Payment Link,
    // which is what collects company, SKU count and tax ID for the invoice.
    expect(bundle.listed).toBe(true);
    expect(html).toContain(`href="${bundle.stripe_payment_link}"`);
    expect(html).toContain("$2,500");
    expect(html).not.toMatch(/legal review|memo/i);
  });

  it("says what it is not and makes no invented claims", () => {
    expect(html).toContain("not legal advice");
    expect(html).toContain("16 CFR Part 323");
    expect(html).not.toMatch(/testimonial|trusted by|guarantee|certified/i);
    expect(html).not.toMatch(/mendo/i);
  });

  it("publishes JSON-LD with the live price", () => {
    const m = html.match(
      /<script type="application\/ld\+json">(.*?)<\/script>/s
    );
    const ld = JSON.parse(m![1]);
    expect(ld["@graph"][0].offers.price).toBe("299");
  });

  it("returns paid buyers to their own thanks page, not the DPP one", () => {
    const body = buildGatedSessionBody({
      plan,
      email: "maker@example.com",
      fields: new URLSearchParams(),
    });
    expect(body.get("success_url")).toContain(CLAIM_FILE_THANKS_PATH);
    expect(body.get("success_url")).not.toContain("/dpp/");
    expect(body.get("metadata[plan]")).toBe("musa_claim_file");
    expect(body.get("metadata[offer]")).toBeNull();
    expect(renderClaimFileThanksPage()).toContain("claim file is started");
  });
});
