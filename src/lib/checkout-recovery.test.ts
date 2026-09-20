import { describe, expect, it } from "vitest";
import {
  applyHostedCheckoutRecovery,
  checkoutRecoveryUrl,
  checkoutSessionEmail,
  hostedCheckoutRecoveryParams,
} from "./checkout-recovery";

describe("hostedCheckoutRecoveryParams", () => {
  it("enables recovery without promotion codes and collects consent", () => {
    const params = hostedCheckoutRecoveryParams("payment");
    expect(params.after_expiration.recovery).toEqual({
      enabled: true,
      allow_promotion_codes: false,
    });
    expect(params.consent_collection.promotions).toBe("auto");
    expect(params.customer_creation).toBe("always");
  });

  it("omits customer_creation for subscription mode (Checkout already collects email)", () => {
    const params = hostedCheckoutRecoveryParams("subscription");
    expect(params.after_expiration.recovery.enabled).toBe(true);
    expect(params.customer_creation).toBeUndefined();
  });
});

describe("applyHostedCheckoutRecovery", () => {
  it("writes form-urlencoded recovery fields for Worker Checkout creates", () => {
    const body = new URLSearchParams();
    applyHostedCheckoutRecovery(body, "payment");
    expect(body.get("after_expiration[recovery][enabled]")).toBe("true");
    expect(body.get("after_expiration[recovery][allow_promotion_codes]")).toBe(
      "false"
    );
    expect(body.get("consent_collection[promotions]")).toBe("auto");
    expect(body.get("customer_creation")).toBe("always");
  });
});

describe("checkoutRecoveryUrl", () => {
  it("reads after_expiration.recovery.url from an expired session", () => {
    expect(
      checkoutRecoveryUrl({
        after_expiration: {
          recovery: { url: "https://buy.stripe.com/r/recover_test" },
        },
      })
    ).toBe("https://buy.stripe.com/r/recover_test");
    expect(checkoutRecoveryUrl({})).toBeNull();
  });
});

describe("checkoutSessionEmail", () => {
  it("prefers customer_details.email so expired-session consent emails are usable", () => {
    expect(
      checkoutSessionEmail({
        customer_details: { email: "buyer@example.com" },
        customer_email: null,
      })
    ).toBe("buyer@example.com");
    expect(checkoutSessionEmail({ customer_email: "not-an-email" })).toBeNull();
  });
});
