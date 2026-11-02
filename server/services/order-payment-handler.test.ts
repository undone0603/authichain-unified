import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db", () => ({
  getServiceOrderBySessionId: vi.fn(),
  updateServiceOrderStatus: vi.fn(),
  logActivity: vi.fn(),
  createSystemNotification: vi.fn(),
  recordRevenue: vi.fn(),
}));

import * as db from "../db";
import { handleServiceOrderPayment } from "./order-payment-handler";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("handleServiceOrderPayment", () => {
  it("returns { handled: false } when no order matches the session", async () => {
    vi.mocked(db.getServiceOrderBySessionId).mockResolvedValue(null as any);
    const result = await handleServiceOrderPayment({ id: "cs_test_unknown" });
    expect(result).toEqual({ handled: false, reason: "no service order for this session" });
    expect(db.updateServiceOrderStatus).not.toHaveBeenCalled();
    expect(db.logActivity).not.toHaveBeenCalled();
    expect(db.createSystemNotification).not.toHaveBeenCalled();
  });

  it("transitions a pending order to paid and dispatches all side effects", async () => {
    vi.mocked(db.getServiceOrderBySessionId).mockResolvedValue({
      id: 42,
      userId: 7,
      status: "pending",
      amount: 19900,
      serviceType: "authenticity_audit",
    } as any);

    const result = await handleServiceOrderPayment({
      id: "cs_test_001",
      payment_intent: "pi_test_xyz",
      status: "complete",
      payment_status: "paid",
      mode: "payment",
      amount_total: 19900,
      currency: "usd",
    });

    expect(result).toEqual({ handled: true, orderId: 42 });
    expect(db.updateServiceOrderStatus).toHaveBeenCalledWith(42, "paid", {
      stripePaymentIntentId: "pi_test_xyz",
    });
    expect(db.logActivity).toHaveBeenCalledWith({
      userId: 7,
      action: "service_order_paid",
      entityType: "service_order",
      entityId: 42,
      details: {
        sessionId: "cs_test_001",
        amount: 19900,
        serviceType: "authenticity_audit",
      },
    });
    expect(db.createSystemNotification).toHaveBeenCalledWith(
      7,
      "Payment confirmed",
      expect.stringContaining("authenticity_audit"),
      "success",
      "/orders",
    );
    expect(db.recordRevenue).toHaveBeenCalledWith({
      source: "stripe",
      amount: "199.00",
      currency: "USD",
      type: "service_order",
      userId: 7,
      metadata: {
        sessionId: "cs_test_001",
        orderId: 42,
        serviceType: "authenticity_audit",
        stripePaymentIntentId: "pi_test_xyz",
      },
    });
  });

  it("skips notification when the order has no associated user", async () => {
    vi.mocked(db.getServiceOrderBySessionId).mockResolvedValue({
      id: 43,
      userId: null,
      status: "pending",
      amount: 9900,
      serviceType: "landing_page",
    } as any);

    const result = await handleServiceOrderPayment({
      id: "cs_test_002",
      payment_intent: "pi_test_abc",
      status: "complete",
      payment_status: "paid",
      mode: "payment",
      amount_total: 9900,
      currency: "usd",
    });

    expect(result).toEqual({ handled: true, orderId: 43 });
    expect(db.updateServiceOrderStatus).toHaveBeenCalled();
    expect(db.logActivity).toHaveBeenCalled();
    expect(db.createSystemNotification).not.toHaveBeenCalled();
    expect(db.recordRevenue).toHaveBeenCalledWith(
      expect.objectContaining({ amount: "99.00", userId: null }),
    );
  });

  it.each([
    ["completed but unpaid", { status: "complete", payment_status: "unpaid", amount_total: 19900 }],
    ["fully discounted paid-status", { status: "complete", payment_status: "paid", amount_total: 0 }],
    ["open despite paid status", { status: "open", payment_status: "paid", amount_total: 19900 }],
    ["foreign-currency checkout", { status: "complete", payment_status: "paid", amount_total: 19900, currency: "eur" }],
  ])("never records revenue for %s", async (_name, overrides) => {
    vi.mocked(db.getServiceOrderBySessionId).mockResolvedValue({
      id: 45,
      userId: 7,
      status: "pending",
      amount: 19900,
      serviceType: "authenticity_audit",
    } as any);

    const result = await handleServiceOrderPayment({
      id: "cs_test_unsettled",
      payment_intent: "pi_test_unsettled",
      mode: "payment",
      currency: "usd",
      ...overrides,
    });

    expect(result.handled).toBe(false);
    expect(db.updateServiceOrderStatus).not.toHaveBeenCalled();
    expect(db.logActivity).not.toHaveBeenCalled();
    expect(db.recordRevenue).not.toHaveBeenCalled();
    expect(db.createSystemNotification).not.toHaveBeenCalled();
  });

  it("records actual discounted cash rather than the catalog list price", async () => {
    vi.mocked(db.getServiceOrderBySessionId).mockResolvedValue({
      id: 46,
      userId: 7,
      status: "pending",
      amount: 19900,
      serviceType: "authenticity_audit",
    } as any);
    const result = await handleServiceOrderPayment({
      id: "cs_test_discounted",
      payment_intent: "pi_test_discounted",
      status: "complete",
      payment_status: "paid",
      mode: "payment",
      amount_total: 1000,
      currency: "usd",
    });
    expect(result).toEqual({ handled: true, orderId: 46 });
    expect(db.recordRevenue).toHaveBeenCalledWith(
      expect.objectContaining({ amount: "10.00", currency: "USD" }),
    );
    expect(db.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.objectContaining({ amount: 1000 }) }),
    );
  });

  it("is idempotent — ignores an already-paid order without side effects", async () => {
    vi.mocked(db.getServiceOrderBySessionId).mockResolvedValue({
      id: 44,
      userId: 7,
      status: "paid",
      amount: 19900,
      serviceType: "authenticity_audit",
    } as any);

    const result = await handleServiceOrderPayment({
      id: "cs_test_003",
      payment_intent: "pi_test_again",
    });

    expect(result).toEqual({ handled: false, reason: "Order already in status: paid" });
    expect(db.updateServiceOrderStatus).not.toHaveBeenCalled();
    expect(db.logActivity).not.toHaveBeenCalled();
    expect(db.createSystemNotification).not.toHaveBeenCalled();
    expect(db.recordRevenue).not.toHaveBeenCalled();
  });
});
