import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db", () => ({ getServiceOrderBySessionId: vi.fn() }));
vi.mock("./order-payment-atomic", () => ({ settleServiceOrderPaymentAtomic: vi.fn() }));

import * as db from "../db";
import { settleServiceOrderPaymentAtomic } from "./order-payment-atomic";
import { handleServiceOrderPayment } from "./order-payment-handler";

const settled = {
  id: "cs_test_paid",
  payment_intent: "pi_test_paid",
  status: "complete",
  payment_status: "paid",
  mode: "payment",
  subscription: null,
  amount_total: 19900,
  currency: "usd",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(settleServiceOrderPaymentAtomic).mockResolvedValue(true);
});

describe("handleServiceOrderPayment", () => {
  it("ignores an unknown order without attempting settlement", async () => {
    vi.mocked(db.getServiceOrderBySessionId).mockResolvedValue(null as any);
    expect(await handleServiceOrderPayment(settled)).toEqual({
      handled: false, reason: "no service order for this session",
    });
    expect(settleServiceOrderPaymentAtomic).not.toHaveBeenCalled();
  });

  it("passes verified cash and identifiers to atomic settlement once", async () => {
    vi.mocked(db.getServiceOrderBySessionId).mockResolvedValue({
      id: 42, userId: 7, status: "pending", amount: "19900", serviceType: "authenticity_audit",
    } as any);
    expect(await handleServiceOrderPayment(settled)).toEqual({ handled: true, orderId: 42 });
    expect(settleServiceOrderPaymentAtomic).toHaveBeenCalledTimes(1);
    expect(settleServiceOrderPaymentAtomic).toHaveBeenCalledWith({
      orderId: 42, sessionId: "cs_test_paid", paymentIntentId: "pi_test_paid",
      paidAmountCents: 19900,
    });
  });

  it("uses actual discounted checkout cash, not the order list price", async () => {
    vi.mocked(db.getServiceOrderBySessionId).mockResolvedValue({
      id: 43, userId: 7, status: "pending", amount: "19900", serviceType: "audit",
    } as any);
    expect(await handleServiceOrderPayment({ ...settled, amount_total: 1000 }))
      .toEqual({ handled: true, orderId: 43 });
    expect(settleServiceOrderPaymentAtomic).toHaveBeenCalledWith(
      expect.objectContaining({ paidAmountCents: 1000 }),
    );
  });

  it.each([
    ["completed but unpaid", { payment_status: "unpaid" }],
    ["paid but open", { status: "open" }],
    ["zero-cash discount", { amount_total: 0 }],
    ["foreign currency", { currency: "eur" }],
    ["subscription checkout", { mode: "subscription" }],
    ["no PaymentIntent", { payment_intent: undefined }],
  ])("does not attempt settlement for %s", async (_name, override) => {
    vi.mocked(db.getServiceOrderBySessionId).mockResolvedValue({
      id: 44, userId: 7, status: "pending", amount: "19900", serviceType: "audit",
    } as any);
    const result = await handleServiceOrderPayment({ ...settled, ...override });
    expect(result.handled).toBe(false);
    expect(settleServiceOrderPaymentAtomic).not.toHaveBeenCalled();
  });

  it("reports a lost compare-and-swap as ignored, never as fulfilled", async () => {
    vi.mocked(db.getServiceOrderBySessionId).mockResolvedValue({
      id: 45, userId: 7, status: "pending", amount: "19900", serviceType: "audit",
    } as any);
    vi.mocked(settleServiceOrderPaymentAtomic).mockResolvedValue(false);
    expect(await handleServiceOrderPayment(settled)).toEqual({
      handled: false, reason: "Order already settled or session changed",
    });
  });

  it("propagates transaction failures so the webhook cannot acknowledge missing economic writes", async () => {
    vi.mocked(db.getServiceOrderBySessionId).mockResolvedValue({
      id: 46, userId: 7, status: "pending", amount: "19900", serviceType: "audit",
    } as any);
    vi.mocked(settleServiceOrderPaymentAtomic).mockRejectedValue(new Error("DB unavailable"));
    await expect(handleServiceOrderPayment(settled)).rejects.toThrow("DB unavailable");
  });

  it("ignores already-paid orders without a second settlement attempt", async () => {
    vi.mocked(db.getServiceOrderBySessionId).mockResolvedValue({
      id: 47, userId: 7, status: "paid", amount: "19900", serviceType: "audit",
    } as any);
    expect(await handleServiceOrderPayment(settled)).toEqual({
      handled: false, reason: "Order already in status: paid",
    });
    expect(settleServiceOrderPaymentAtomic).not.toHaveBeenCalled();
  });
});
