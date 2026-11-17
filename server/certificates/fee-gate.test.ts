import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const retrieve = vi.fn();
vi.mock("../stripe-service", () => ({
  createPaymentCheckout: vi.fn().mockResolvedValue({
    url: "https://checkout.stripe.com/x",
    sessionId: "cs_1",
  }),
  getStripe: () => ({ checkout: { sessions: { retrieve } } }),
}));

import { planByAmountCents } from "../../src/lib/plans";
import { feeCents, requireFeePaid } from "./fee-gate";

const base = {
  kind: "evidence" as const,
  certificateNumber: "AC-1",
  userId: 7,
};
const paid = (over: Record<string, unknown> = {}) => ({
  payment_status: "paid",
  metadata: {
    kind: "evidence",
    certificateNumber: "AC-1",
    user_id: "7",
    ...over,
  },
});

describe("fee-gate", () => {
  beforeEach(() => retrieve.mockReset());
  afterEach(() => vi.unstubAllEnvs());

  it("is a no-op when the gate is off", async () => {
    await expect(requireFeePaid(base)).resolves.toBeUndefined();
    expect(retrieve).not.toHaveBeenCalled();
  });

  describe("gate on", () => {
    beforeEach(() => vi.stubEnv("CERT_FEE_GATE", "on"));

    it("rejects when no session is presented", async () => {
      await expect(requireFeePaid(base)).rejects.toThrow(/Payment required/);
    });

    it("accepts a paid session matching user, cert and kind", async () => {
      retrieve.mockResolvedValue(paid());
      await expect(
        requireFeePaid({ ...base, sessionId: "cs_1" })
      ).resolves.toBeUndefined();
    });

    it.each([
      ["unpaid", { payment_status: "unpaid", metadata: paid().metadata }],
      ["another user's", paid({ user_id: "8" })],
      ["another certificate's", paid({ certificateNumber: "AC-2" })],
      ["a receipt (wrong kind)", paid({ kind: "receipt" })],
    ])("rejects %s session", async (_n, session) => {
      retrieve.mockResolvedValue(session);
      await expect(
        requireFeePaid({ ...base, sessionId: "cs_1" })
      ).rejects.toThrow(/Payment required/);
    });
  });

  it("never lets a fee collide with a catalogue plan price (webhook amount-matching)", () => {
    expect(planByAmountCents(feeCents("receipt"))).toBeUndefined();
    expect(planByAmountCents(feeCents("evidence"))).toBeUndefined();
    vi.stubEnv("CERT_EVIDENCE_FEE_CENTS", "2900"); // Starter's price
    expect(feeCents("evidence")).toBe(3900);
  });

  it("uses defaults and honours valid overrides only", () => {
    expect(feeCents("receipt")).toBe(199);
    vi.stubEnv("CERT_RECEIPT_FEE_CENTS", "500");
    expect(feeCents("receipt")).toBe(500);
    vi.stubEnv("CERT_RECEIPT_FEE_CENTS", "-5");
    expect(feeCents("receipt")).toBe(199);
  });
});
