import { describe, expect, it } from "vitest";
import {
  stripeWebhookFailureStatus,
} from "./stripe-webhook-error-status";
import {
  markRetryableFulfillment,
} from "../../src/lib/retryable-fulfillment";

describe("Stripe webhook HTTP error classification", () => {
  it("returns 500 so Stripe retries a paid entitlement database outage", () => {
    const error = markRetryableFulfillment(
      new Error("DPP entitlement database not configured")
    );
    expect(stripeWebhookFailureStatus(error)).toBe(500);
  });

  it("returns 500 when the Stripe idempotency guard is unavailable", () => {
    const error = Object.assign(new Error("claim unavailable"), {
      name: "StripeEventClaimUnavailableError",
    });
    expect(stripeWebhookFailureStatus(error)).toBe(500);
  });

  it("returns 400 for nonretryable errors such as bad Stripe signatures", () => {
    expect(stripeWebhookFailureStatus(new Error("bad signature"))).toBe(400);
    expect(stripeWebhookFailureStatus(null)).toBe(400);
  });
});
