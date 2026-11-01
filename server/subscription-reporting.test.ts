import { describe, expect, it } from "vitest";
import { formatUnverifiedSubscriptionMetrics } from "./subscription-reporting";

describe("subscription digest revenue-truth boundary", () => {
  it("does not count unlinked internal active records as paying customers", () => {
    const digest = formatUnverifiedSubscriptionMetrics({
      paymentRecordCount: 0,
      internalActiveCount: 3,
    });
    expect(digest).toContain("Internal active subscription rows (not verified paid): 3");
    expect(digest).toContain("Verified paid subscriptions / renewals: not measured");
    expect(digest).not.toMatch(/^Active Subscriptions:/m);
  });

  it("does not treat a payment record as a confirmed paid renewal", () => {
    const digest = formatUnverifiedSubscriptionMetrics({
      paymentRecordCount: 1,
      internalActiveCount: 0,
    });
    expect(digest).toContain("Payment records created (not verified paid): 1");
    expect(digest).not.toMatch(/^Paid Renewals: 1$/m);
  });
});
