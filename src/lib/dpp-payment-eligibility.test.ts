import { describe, expect, it } from "vitest";
import {
  DPP_PAYMENT_LINK_ID, dppGrantDecision, isDppCheckoutCandidate,
  type DppProofSession,
} from "./dpp-payment-eligibility";
import { DPP_PRICE_ID } from "./dpp-loop";

const paid: DppProofSession = {
  id: "cs_test_dpp",
  mode: "payment", status: "complete", payment_status: "paid",
  amount_total: 29900, currency: "usd", metadata: { plan: "dpp_readiness" },
  line_items: { data: [{ quantity: 1, price: { id: DPP_PRICE_ID } }], has_more: false },
};

describe("DPP paid entitlement boundary", () => {
  it("grants a completed paid session with the actual authorized line item", () => {
    expect(dppGrantDecision(paid)).toBe("paid");
  });
  it.each([
    ["completed but unpaid", { payment_status: "unpaid" }, "unverified"],
    ["paid but open", { status: "open" }, "unverified"],
    ["missing payment status", { payment_status: null }, "unverified"],
    ["subscription mode", { mode: "subscription" }, "recurring"],
    ["subscription id", { subscription: "sub_test_1" }, "recurring"],
    ["zero-dollar purchase", { amount_total: 0 }, "invalid_product"],
    ["underpaid DPP amount", { amount_total: 29899 }, "invalid_product"],
    ["overpaid DPP amount", { amount_total: 30000 }, "invalid_product"],
    ["wrong currency", { currency: "eur" }, "invalid_product"],
    ["missing line items", { line_items: null }, "invalid_product"],
    ["missing line-item has_more proof", { line_items: { data: [{ quantity: 1, price: { id: DPP_PRICE_ID } }] } }, "invalid_product"],
    ["truncated line-item list", { line_items: { data: [{ quantity: 1, price: { id: DPP_PRICE_ID } }], has_more: true } }, "invalid_product"],
    ["missing purchased quantity", { line_items: { data: [{ price: { id: DPP_PRICE_ID } }], has_more: false } }, "invalid_product"],
    ["null purchased quantity", { line_items: { data: [{ price: { id: DPP_PRICE_ID }, quantity: null }], has_more: false } }, "invalid_product"],
    ["wrong price", { line_items: { data: [{ price: { id: "price_other" } }] } }, "invalid_product"],
    ["multiple items", { line_items: { data: [{ price: { id: DPP_PRICE_ID } }, { price: { id: DPP_PRICE_ID } }] } }, "invalid_product"],
    ["quantity two", { line_items: { data: [{ price: { id: DPP_PRICE_ID }, quantity: 2 }] } }, "invalid_product"],
    ["conflicting plan", { metadata: { plan: "musa_claim_file", offer: "dpp_readiness_2026" } }, "invalid_product"],
  ] as const)("refuses %s", (_case, override, outcome) => {
    expect(dppGrantDecision({ ...paid, ...override } as DppProofSession)).toBe(outcome);
  });
  it("never trusts metadata.stripe_price_id as actual purchase evidence", () => {
    expect(dppGrantDecision({ ...paid, line_items: null,
      metadata: { plan: "dpp_readiness", stripe_price_id: DPP_PRICE_ID },
    })).toBe("invalid_product");
  });
  it("recognizes the active DPP Payment Link but still needs its real price", () => {
    const link = { ...paid, metadata: {}, payment_link: DPP_PAYMENT_LINK_ID };
    expect(isDppCheckoutCandidate(link)).toBe(true);
    expect(dppGrantDecision(link)).toBe("paid");
    expect(dppGrantDecision({ ...link, line_items: null })).toBe("invalid_product");
  });
  it("keeps explicit $0 authorized smokes separate from buyer revenue", () => {
    const smoke = { ...paid, amount_total: 0, line_items: null,
      client_reference_id: "smoke_check_1789786486",
      metadata: { plan: "dpp_readiness", is_demo: "true", promo: "DPP-SMOKE-E2E" },
    };
    expect(dppGrantDecision(smoke)).toBe("authorized_smoke");
    expect(dppGrantDecision({ ...smoke, metadata: { ...smoke.metadata, promo: "fake" } })).toBe("invalid_product");
  });
  it("ignores a different catalog offer", () => {
    expect(dppGrantDecision({ ...paid, metadata: { plan: "starter" },
      line_items: { data: [{ price: { id: "price_starter" } }] },
    })).toBe("not_dpp");
  });
});
