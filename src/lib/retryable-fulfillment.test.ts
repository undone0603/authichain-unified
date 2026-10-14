import { describe, expect, it } from "vitest";
import {
  isRetryableFulfillment,
  markRetryableFulfillment,
} from "./retryable-fulfillment";

describe("retryable fulfillment", () => {
  it("marks a continuity failure so Stripe can retry", () => {
    const err = markRetryableFulfillment(new Error("illegal_transition"));
    expect(err.message).toBe("illegal_transition");
    expect(isRetryableFulfillment(err)).toBe(true);
  });

  it("treats an unmarked signature failure as not retryable", () => {
    expect(
      isRetryableFulfillment(
        new Error("No signatures found matching the expected signature")
      )
    ).toBe(false);
  });

  it("recognizes the provision and continuity messages without the wrapper", () => {
    expect(
      isRetryableFulfillment(new Error("DPP provision failed: upsert"))
    ).toBe(true);
    expect(isRetryableFulfillment(new Error("continuity_insert_failed"))).toBe(
      true
    );
  });
});
