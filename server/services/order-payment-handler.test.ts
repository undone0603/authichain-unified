import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db-helpers", () => ({
  getServiceOrderBySessionId: vi.fn(),
  updateServiceOrderStatus: vi.fn(),
  logActivity: vi.fn(),
  createSystemNotification: vi.fn(),
  recordRevenue: vi.fn(),
}));

import * as dbHelpers from "../db-helpers";
import { handleServiceOrderPayment } from "./order-payment-handler";

// Fake db instance — every db-touching call in order-payment-handler.ts goes
// through the mocked ../db-helpers module above, so the real value here is
// never dereferenced; it just has to be threaded through as the first arg.
const FAKE_DB = {} as any;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("handleServiceOrderPayment", () => {
  it("returns { handled: false } when no order matches the session", async () => {
    vi.mocked(dbHelpers.getServiceOrderBySessionId).mockResolvedValue(null as any);
    const result = await handleServiceOrderPayment(FAKE_DB, { id: "cs_test_unknown" });
    expect(result).toEqual({ handled: false, reason: "no service order for this session" });
    expect(dbHelpers.updateServiceOrderStatus).not.toHaveBeenCalled();
    expect(dbHelpers.logActivity).not.toHaveBeenCalled();
    expect(dbHelpers.createSystemNotification).not.toHaveBeenCalled();
  });

  it("transitions a pending order to paid and dispatches all side effects", async () => {
    vi.mocked(dbHelpers.getServiceOrderBySessionId).mockResolvedValue({
      id: 42,
      userId: 7,
      status: "pending",
      amount: 19900,
      serviceType: "authenticity_audit",
    } as any);

    const result = await handleServiceOrderPayment(FAKE_DB, {
      id: "cs_test_001",
      payment_intent: "pi_test_xyz",
    });

    expect(result).toEqual({ handled: true, orderId: 42 });
    expect(dbHelpers.updateServiceOrderStatus).toHaveBeenCalledWith(FAKE_DB, 42, "paid", {
      stripePaymentIntentId: "pi_test_xyz",
    });
    expect(dbHelpers.logActivity).toHaveBeenCalledWith(FAKE_DB, {
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
    expect(dbHelpers.createSystemNotification).toHaveBeenCalledWith(
      FAKE_DB,
      7,
      "Payment confirmed",
      expect.stringContaining("authenticity_audit"),
      "success",
      "/orders",
    );
    expect(dbHelpers.recordRevenue).toHaveBeenCalledWith(FAKE_DB, {
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
    vi.mocked(dbHelpers.getServiceOrderBySessionId).mockResolvedValue({
      id: 43,
      userId: null,
      status: "pending",
      amount: 9900,
      serviceType: "landing_page",
    } as any);

    const result = await handleServiceOrderPayment(FAKE_DB, {
      id: "cs_test_002",
      payment_intent: "pi_test_abc",
    });

    expect(result).toEqual({ handled: true, orderId: 43 });
    expect(dbHelpers.updateServiceOrderStatus).toHaveBeenCalled();
    expect(dbHelpers.logActivity).toHaveBeenCalled();
    expect(dbHelpers.createSystemNotification).not.toHaveBeenCalled();
    expect(dbHelpers.recordRevenue).toHaveBeenCalledWith(
      FAKE_DB,
      expect.objectContaining({ amount: "99.00", userId: null }),
    );
  });

  it("is idempotent — ignores an already-paid order without side effects", async () => {
    vi.mocked(dbHelpers.getServiceOrderBySessionId).mockResolvedValue({
      id: 44,
      userId: 7,
      status: "paid",
      amount: 19900,
      serviceType: "authenticity_audit",
    } as any);

    const result = await handleServiceOrderPayment(FAKE_DB, {
      id: "cs_test_003",
      payment_intent: "pi_test_again",
    });

    expect(result).toEqual({ handled: false, reason: "Order already in status: paid" });
    expect(dbHelpers.updateServiceOrderStatus).not.toHaveBeenCalled();
    expect(dbHelpers.logActivity).not.toHaveBeenCalled();
    expect(dbHelpers.createSystemNotification).not.toHaveBeenCalled();
    expect(dbHelpers.recordRevenue).not.toHaveBeenCalled();
  });
});
