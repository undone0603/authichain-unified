import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({ getDb: vi.fn() }));
import { getDb } from "../db";
import { settleServiceOrderPaymentAtomic } from "./order-payment-atomic";

const evidence = {
  orderId: 42,
  sessionId: "cs_test_paid",
  paymentIntentId: "pi_test_paid",
  paidAmountCents: 1000,
};

function fakeDatabase(claims: Array<{ id: number; userId: number | null; serviceType: string } | null>) {
  const returning = vi.fn(async () => {
    const claim = claims.shift();
    return claim ? [claim] : [];
  });
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const values = vi.fn(async (_value: unknown) => undefined);
  const insert = vi.fn(() => ({ values }));
  const tx = { update, insert };
  const transaction = vi.fn(async (callback: (transaction: typeof tx) => Promise<boolean>) => callback(tx));
  vi.mocked(getDb).mockResolvedValue({ transaction } as any);
  return { transaction, update, set, where, returning, insert, values };
}

beforeEach(() => vi.resetAllMocks());

describe("settleServiceOrderPaymentAtomic", () => {
  it("uses an injected request-scoped transaction without Node DATABASE_URL", async () => {
    const f = fakeDatabase([{ id: 42, userId: 7, serviceType: "audit" }]);
    const requestDb = { transaction: f.transaction } as any;
    await expect(settleServiceOrderPaymentAtomic(evidence, requestDb)).resolves.toBe(true);
    expect(getDb).not.toHaveBeenCalled();
    expect(f.transaction).toHaveBeenCalledTimes(1);
    expect(f.insert).toHaveBeenCalledTimes(3);
  });

  it("writes one activity, revenue and notification only after winning the pending CAS", async () => {
    const f = fakeDatabase([{ id: 42, userId: 7, serviceType: "authenticity_audit" }]);
    await expect(settleServiceOrderPaymentAtomic(evidence)).resolves.toBe(true);
    expect(f.transaction).toHaveBeenCalledTimes(1);
    expect(f.update).toHaveBeenCalledTimes(1);
    expect(f.set).toHaveBeenCalledWith(expect.objectContaining({
      status: "paid", stripePaymentIntentId: "pi_test_paid",
    }));
    expect(f.insert).toHaveBeenCalledTimes(3);
    const payloads = f.values.mock.calls.map(call => call[0]);
    expect(payloads).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "service_order_paid", details: expect.objectContaining({ amount: 1000 }) }),
      expect.objectContaining({ source: "stripe", amount: "10.00", currency: "USD", type: "service_order" }),
      expect.objectContaining({ title: "Payment confirmed", userId: 7 }),
    ]));
  });

  it("does not write any economic side effects if another delivery already claimed the order", async () => {
    const f = fakeDatabase([null]);
    await expect(settleServiceOrderPaymentAtomic(evidence)).resolves.toBe(false);
    expect(f.insert).not.toHaveBeenCalled();
  });

  it("a second identical delivery cannot write duplicate revenue", async () => {
    const f = fakeDatabase([{ id: 42, userId: 7, serviceType: "audit" }, null]);
    await expect(settleServiceOrderPaymentAtomic(evidence)).resolves.toBe(true);
    await expect(settleServiceOrderPaymentAtomic(evidence)).resolves.toBe(false);
    expect(f.insert).toHaveBeenCalledTimes(3);
  });

  it("skips the notification only for an unowned order", async () => {
    const f = fakeDatabase([{ id: 42, userId: null, serviceType: "audit" }]);
    await expect(settleServiceOrderPaymentAtomic(evidence)).resolves.toBe(true);
    expect(f.insert).toHaveBeenCalledTimes(2);
  });

  it("propagates ledger failures out of the transaction", async () => {
    const f = fakeDatabase([{ id: 42, userId: 7, serviceType: "audit" }]);
    f.values.mockRejectedValueOnce(new Error("ledger unavailable"));
    await expect(settleServiceOrderPaymentAtomic(evidence)).rejects.toThrow("ledger unavailable");
  });

  it.each([
    { ...evidence, paidAmountCents: 0 },
    { ...evidence, paidAmountCents: 1.5 },
    { ...evidence, paymentIntentId: "" },
    { ...evidence, sessionId: "not_a_checkout" },
    { ...evidence, orderId: -1 },
  ])("refuses malformed settlement evidence before accessing the database", async bad => {
    await expect(settleServiceOrderPaymentAtomic(bad)).rejects.toThrow("Invalid service-order settlement evidence");
    expect(getDb).not.toHaveBeenCalled();
  });
});
