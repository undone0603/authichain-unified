/**
 * Services router unit tests — db and stripe-service are mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SERVICE_LIST, SERVICE_CATALOG } from "../service-catalog";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../db.js", () => ({
  getServiceOrdersByUser: vi.fn().mockResolvedValue([]),
  getAllServiceOrders: vi.fn().mockResolvedValue([]),
  updateServiceOrderStatus: vi.fn().mockResolvedValue(undefined),
  createServiceOrder: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock("../stripe-service.js", () => ({
  createPaymentCheckout: vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/mock", sessionId: "cs_mock_123" }),
}));

vi.mock("../_core/trpc.js", () => {
  const makeProc = () => ({
    query: (fn: any) => ({ _type: "query", _fn: fn }),
    mutation: (fn: any) => ({ _type: "mutation", _fn: fn }),
    input: (schema: any) => ({
      query: (fn: any) => ({ _type: "query", _fn: fn }),
      mutation: (fn: any) => ({ _type: "mutation", _fn: fn }),
    }),
  });
  return {
    publicProcedure: makeProc(),
    protectedProcedure: makeProc(),
    adminProcedure: makeProc(),
    router: (routes: any) => routes,
  };
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("service catalog", () => {
  it("exports a non-empty catalog", () => {
    expect(SERVICE_LIST.length).toBeGreaterThan(0);
  });

  it("every catalog entry has a price > 0 and a name", () => {
    for (const svc of SERVICE_LIST) {
      expect(svc.price).toBeGreaterThan(0);
      expect(svc.name.length).toBeGreaterThan(0);
    }
  });

  it("SERVICE_CATALOG keys match ServiceType values in SERVICE_LIST", () => {
    for (const svc of SERVICE_LIST) {
      expect(SERVICE_CATALOG[svc.key]).toBeDefined();
    }
  });
});

describe("servicesRouter — catalog", () => {
  it("returns SERVICE_LIST", async () => {
    const { servicesRouter } = await import("../services/router.js");
    const result = (servicesRouter as any).catalog._fn();
    expect(result).toBe(SERVICE_LIST);
  });
});

describe("servicesRouter — myOrders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls getServiceOrdersByUser with the ctx user id", async () => {
    const { getServiceOrdersByUser } = await import("../db.js");
    const { servicesRouter } = await import("../services/router.js");
    const ctx = { user: { id: 99 } };
    await (servicesRouter as any).myOrders._fn({ ctx });
    expect(vi.mocked(getServiceOrdersByUser)).toHaveBeenCalledWith(99);
  });
});

describe("servicesRouter — checkout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws when neither serviceKey nor serviceType is provided", async () => {
    const { servicesRouter } = await import("../services/router.js");
    const ctx = { user: { id: 1, email: "a@b.com", name: "Test" } };
    await expect(
      (servicesRouter as any).checkout._fn({ ctx, input: { origin: "https://example.com" } }),
    ).rejects.toThrow("serviceKey or serviceType is required");
  });

  it("calls createPaymentCheckout and returns checkoutUrl", async () => {
    const { createPaymentCheckout } = await import("../stripe-service.js");
    const { servicesRouter } = await import("../services/router.js");
    const ctx = { user: { id: 1, email: "a@b.com", name: "Test" } };
    const result = await (servicesRouter as any).checkout._fn({
      ctx,
      input: { serviceKey: "authenticity_audit", origin: "http://localhost:3000" },
    });
    expect(vi.mocked(createPaymentCheckout)).toHaveBeenCalledOnce();
    expect(result.checkoutUrl).toBe("https://checkout.stripe.com/mock");
  });
});

describe("servicesRouter — updateStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delegates to updateServiceOrderStatus and returns success", async () => {
    const { updateServiceOrderStatus } = await import("../db.js");
    const { servicesRouter } = await import("../services/router.js");
    const result = await (servicesRouter as any).updateStatus._fn({
      input: { id: 7, status: "completed" },
    });
    expect(vi.mocked(updateServiceOrderStatus)).toHaveBeenCalledWith(7, "completed");
    expect(result.success).toBe(true);
  });
});
