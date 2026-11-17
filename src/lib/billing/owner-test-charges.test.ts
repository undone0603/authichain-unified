import { describe, expect, it } from "vitest";
import allowlistFile from "../../../ops/reconcile/excluded-test-payments.json";
import {
  EXCLUDED_TEST_PAYMENT_IDS,
  isExcludedTestId,
  isOwnerTestCharge,
  isOwnerTestMetadata,
  isTrueFlag,
} from "./owner-test-charges";

describe("owner-test charge exclusion", () => {
  it("allowlists the live $10 self-test charge and payment intent by id", () => {
    expect(allowlistFile.ids).toContain("ch_3UHcQfGqTruSqV8T1j4hdD7l");
    expect(allowlistFile.ids).toContain("pi_3UHcQfGqTruSqV8T18dYFwd3");
    expect(isExcludedTestId("ch_3UHcQfGqTruSqV8T1j4hdD7l")).toBe(true);
    expect(isExcludedTestId("pi_3UHcQfGqTruSqV8T18dYFwd3")).toBe(true);
    expect(EXCLUDED_TEST_PAYMENT_IDS).toEqual(
      expect.arrayContaining([
        "ch_3UHcQfGqTruSqV8T1j4hdD7l",
        "pi_3UHcQfGqTruSqV8T18dYFwd3",
        "paid_smoke_10_20260920",
      ])
    );
  });

  it("treats allowlisted charge, payment_intent, customer, and visit ids as owner tests", () => {
    expect(isOwnerTestCharge({ id: "ch_3UHcQfGqTruSqV8T1j4hdD7l" })).toBe(true);
    expect(
      isOwnerTestCharge({ payment_intent: "pi_3UHcQfGqTruSqV8T18dYFwd3" })
    ).toBe(true);
    expect(isOwnerTestCharge({ prospect_id: "paid_smoke_10_20260920" })).toBe(
      true
    );
    expect(
      isOwnerTestCharge({
        metadata: { charge_id: "ch_3UHcQfGqTruSqV8T1j4hdD7l" },
      })
    ).toBe(true);
  });

  it("treats explicit metadata flags as owner tests, including Stripe string values", () => {
    expect(isTrueFlag(true)).toBe(true);
    expect(isTrueFlag("true")).toBe(true);
    expect(isTrueFlag("false")).toBe(false);
    expect(isOwnerTestMetadata({ test_payment: "owner" })).toBe(true);
    expect(isOwnerTestMetadata({ is_self_test: "true" })).toBe(true);
    expect(isOwnerTestMetadata({ purpose: "paid_smoke_10" })).toBe(true);
    expect(isOwnerTestMetadata({ is_demo: "true" })).toBe(true);
    expect(isOwnerTestCharge({ metadata: { test_payment: "owner" } })).toBe(
      true
    );
  });

  it("does not exclude an unmarked stranger charge, including a $10 amount", () => {
    expect(
      isOwnerTestCharge({
        id: "ch_stranger_29",
        payment_intent: "pi_stranger_29",
        customer: "cus_stranger",
        metadata: { amount_total: 1000, surface: "authichain.com" },
      })
    ).toBe(false);
    expect(isOwnerTestMetadata({ test_payment: "qa" })).toBe(false);
    expect(isExcludedTestId("ch_someone_else")).toBe(false);
  });

  it("carries no emails or personal names in the allowlist file", () => {
    expect(JSON.stringify(allowlistFile)).not.toMatch(/@/);
  });
});
