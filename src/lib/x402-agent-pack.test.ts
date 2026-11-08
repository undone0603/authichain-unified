import { describe, expect, it } from "vitest";
import {
  X402_AGENT_PACK_CREDITS,
  X402_AGENT_PACK_PRICE_ID,
  isX402PackCandidate,
  validX402PackPurchase,
  x402PackReady,
  type PackPurchaseEvidence,
} from "./x402-agent-pack";

const valid: PackPurchaseEvidence = {
  livemode: true,
  mode: "payment",
  paymentStatus: "paid",
  currency: "usd",
  amountSubtotal: 500,
  items: [{
    priceId: X402_AGENT_PACK_PRICE_ID,
    quantity: 1,
    unitAmount: 500,
    currency: "usd",
    recurring: false,
  }],
};

describe("x402 Stripe prepaid verification pack", () => {
  it("stays disabled without all three matching production bindings", () => {
    expect(x402PackReady()).toBe(false);
    expect(x402PackReady({ X402_PACK_ENABLED: "true" })).toBe(false);
    expect(x402PackReady({
      X402_PACK_ENABLED: "true",
      X402_PACK_PRICE_ID: "price_other",
      X402_PACK_CREDITS: "120",
    })).toBe(false);
    expect(x402PackReady({
      X402_PACK_ENABLED: "true",
      X402_PACK_PRICE_ID: X402_AGENT_PACK_PRICE_ID,
      X402_PACK_CREDITS: "120",
    })).toBe(true);
  });

  it("accepts exactly one paid live one-time $5 price for 120 verifications", () => {
    expect(validX402PackPurchase(valid)).toBe(true);
    expect(X402_AGENT_PACK_CREDITS).toBe(120);
  });

  it.each([
    { livemode: false },
    { mode: "subscription" },
    { paymentStatus: "unpaid" },
    { paymentStatus: null },
    { currency: "eur" },
    { amountSubtotal: 0 },
    { amountSubtotal: 100 },
    { items: [] },
    { items: [...valid.items, ...valid.items] },
    { items: [{ ...valid.items[0], priceId: "price_other" }] },
    { items: [{ ...valid.items[0], quantity: 2 }] },
    { items: [{ ...valid.items[0], recurring: true }] },
    { items: [{ ...valid.items[0], unitAmount: 100 }] },
  ])("rejects mismatched payment evidence %#", change => {
    expect(validX402PackPurchase({ ...valid, ...change })).toBe(false);
  });

  it("does not use arbitrary $5 charges or attacker metadata as payment proof", () => {
    expect(isX402PackCandidate({ plan: "other" }, null)).toBe(false);
    expect(isX402PackCandidate({ plan: "x402_agent_credits_120" }, null)).toBe(true);
    expect(validX402PackPurchase({ ...valid, items: [{
      ...valid.items[0], priceId: "price_other",
    }] })).toBe(false);
  });
});
