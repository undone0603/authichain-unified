import { describe, it, expect } from "vitest";
import {
  deriveIdempotencyKey,
  enforceCaps,
  decideExecution,
  type PayoutIntent,
  type PayoutCaps,
} from "./policy";

const caps: PayoutCaps = { maxPerItem: 500, maxPerRun: 1000 };

function intent(amount: number, ref: string): PayoutIntent {
  return {
    rail: "stripe_connect",
    amount,
    currency: "usd",
    destination: "acct_123",
    referenceType: "affiliate_commission",
    referenceId: ref,
  };
}

describe("deriveIdempotencyKey", () => {
  it("is deterministic for the same source row", () => {
    expect(deriveIdempotencyKey("affiliate_commission", "42")).toBe("affiliate_commission:42");
    expect(deriveIdempotencyKey("staking_reward", "7")).toBe("staking_reward:7");
  });
  it("differs across reference types and ids", () => {
    expect(deriveIdempotencyKey("a", "1")).not.toBe(deriveIdempotencyKey("a", "2"));
    expect(deriveIdempotencyKey("a", "1")).not.toBe(deriveIdempotencyKey("b", "1"));
  });
});

describe("enforceCaps", () => {
  it("allows items under both caps", () => {
    const { allowed, held } = enforceCaps([intent(100, "1"), intent(200, "2")], caps);
    expect(allowed).toHaveLength(2);
    expect(held).toHaveLength(0);
  });

  it("holds an item over the per-item cap", () => {
    const { allowed, held } = enforceCaps([intent(600, "1")], caps);
    expect(allowed).toHaveLength(0);
    expect(held[0].reason).toContain("per-item cap");
  });

  it("stops spending once the per-run cap would be exceeded", () => {
    const { allowed, held } = enforceCaps(
      [intent(400, "1"), intent(400, "2"), intent(400, "3")],
      caps,
    );
    expect(allowed).toHaveLength(2);          // 400 + 400 = 800 ok; third would hit 1200
    expect(held).toHaveLength(1);
    expect(held[0].reason).toContain("per-run cap");
  });

  it("does not cherry-pick smaller items past the cap", () => {
    // 400+400=800 allowed; 300 trips the 1000 run cap (1100); the trailing 50
    // would still fit in the 200 of remaining budget, but once the cap is hit
    // the run stops spending — it is held too.
    const { allowed, held } = enforceCaps(
      [intent(400, "1"), intent(400, "2"), intent(300, "3"), intent(50, "4")],
      caps,
    );
    expect(allowed.map(a => a.referenceId)).toEqual(["1", "2"]);
    expect(held.map(h => h.intent.referenceId)).toEqual(["3", "4"]);
  });

  it("holds non-positive amounts", () => {
    const { allowed, held } = enforceCaps([intent(0, "1"), intent(-5, "2")], caps);
    expect(allowed).toHaveLength(0);
    expect(held).toHaveLength(2);
  });
});

describe("decideExecution", () => {
  const base = { rail: "stripe_connect" as const, destination: "acct_1", amount: 100 };

  it("refuses when the kill-switch is off", () => {
    const d = decideExecution({ ...base, status: "approved" }, { payoutsEnabled: false });
    expect(d.execute).toBe(false);
    if (!d.execute) expect(d.reason).toContain("PAYOUTS_ENABLED");
  });

  it("refuses anything not approved", () => {
    for (const status of ["pending_approval", "processing", "paid", "failed", "rejected", "held"] as const) {
      const d = decideExecution({ ...base, status }, { payoutsEnabled: true });
      expect(d.execute).toBe(false);
    }
  });

  it("refuses a non-burn payout with no destination", () => {
    const d = decideExecution(
      { rail: "qron_onchain", destination: null, amount: 10, status: "approved" },
      { payoutsEnabled: true },
    );
    expect(d.execute).toBe(false);
    if (!d.execute) expect(d.reason).toContain("destination");
  });

  it("allows burn with no destination", () => {
    const d = decideExecution(
      { rail: "buyback_burn", destination: null, amount: 10, status: "approved" },
      { payoutsEnabled: true },
    );
    expect(d.execute).toBe(true);
  });

  it("executes an approved, funded, in-cap payout when enabled", () => {
    const d = decideExecution({ ...base, status: "approved" }, { payoutsEnabled: true });
    expect(d.execute).toBe(true);
  });
});
