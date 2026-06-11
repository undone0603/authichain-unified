import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db", () => ({
  getServiceOrderBySessionId: vi.fn(),
  updateServiceOrderStatus: vi.fn(),
  logActivity: vi.fn(),
  createSystemNotification: vi.fn(),
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
      details: { amount: 19900 },
      serviceType: "authenticity_audit",
    } as any);

    const result = await handleServiceOrderPayment({
      id: "cs_test_001",
      payment_intent: "pi_test_xyz",
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
  });

  it("skips notification when the order has no associated user", async () => {
    vi.mocked(db.getServiceOrderBySessionId).mockResolvedValue({
      id: 43,
      userId: null,
      status: "pending",
      details: { amount: 9900 },
      serviceType: "landing_page",
    } as any);

    const result = await handleServiceOrderPayment({
      id: "cs_test_002",
      payment_intent: "pi_test_abc",
    });

    expect(result).toEqual({ handled: true, orderId: 43 });
    expect(db.updateServiceOrderStatus).toHaveBeenCalled();
    expect(db.logActivity).toHaveBeenCalled();
    expect(db.createSystemNotification).not.toHaveBeenCalled();
  });

  it("is idempotent — ignores an already-paid order without side effects", async () => {
    vi.mocked(db.getServiceOrderBySessionId).mockResolvedValue({
      id: 44,
      userId: 7,
      status: "paid",
      details: { amount: 19900 },
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
  });
});
