import { describe, expect, it } from "vitest";
import { checkoutActivationHref } from "./checkout-confirmation";

describe("checkoutActivationHref", () => {
  it("constructs eligibility links but does not establish payment", () => {
    expect(checkoutActivationHref("cs_live_A123", "visit_abc")).toBe(
      "/dpp/activate?session_id=cs_live_A123&visit_id=visit_abc"
    );
    expect(checkoutActivationHref("cs_test_1", "")).toBe(
      "/dpp/activate?session_id=cs_test_1"
    );
  });

  it.each([
    "",
    "cs_live_",
    "fake",
    "pi_123",
    "cs_live_a?plan=starter",
    "cs_live_a%22",
    "cs_test_a/b",
    "cs_live_" + "a".repeat(201),
  ])("rejects a missing or forged checkout reference: %s", sessionId => {
    expect(checkoutActivationHref(sessionId)).toBeNull();
  });

  it("does not include untrusted visit-id characters in the link", () => {
    expect(checkoutActivationHref("cs_live_A123", "x&paid=1")).toBe(
      "/dpp/activate?session_id=cs_live_A123"
    );
    expect(checkoutActivationHref("cs_live_A123", "a".repeat(129))).toBe(
      "/dpp/activate?session_id=cs_live_A123"
    );
  });
});
