import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  registryError: null as null | { message: string },
  steps: [] as string[],
  releaseX402Spend: vi.fn(),
  reserveX402Spend: vi.fn(),
  settlePayment: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => {
          mocks.steps.push("registry");
          return { data: null, error: mocks.registryError };
        },
      };
      return query;
    },
  }),
}));

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => ({ ok: true }),
}));
vi.mock("@/lib/x402", () => ({
  buildPaymentRequired: () => ({
    v2: { payment: "required" },
    headers: {},
    body: { accepts: [{}] },
  }),
  parsePaymentHeader: () => ({ payer: "0xabc", amount: "50000" }),
  paymentResponseHeaders: () => ({}),
  readPaymentProofHeader: () => "proof",
  verifyPaymentProof: () => ({ valid: true, amount: 50000n }),
  usdToAtomic: () => "50000",
  dailyCapUsd: () => 10,
  settlePayment: mocks.settlePayment,
  X402_REGISTRY_NOT_BOUND: { error: "registry_not_bound" },
}));
vi.mock("@/lib/seal-attestation", () => ({
  attestSeal: () => ({ verdict: null, reasons: [], verified: false }),
}));
vi.mock("@/lib/paid-seal-verify", () => ({
  releaseX402Spend: mocks.releaseX402Spend,
  reserveX402Spend: mocks.reserveX402Spend,
  sealLookupCredentials: () => ({
    url: "https://supabase.example",
    key: "service-test",
    role: "service",
  }),
}));
vi.mock("../../../../lib/agent-verify", () => ({
  parseSealRequest: () => ({ ok: true, sealId: "seal-1" }),
  registryAnswer: () => ({
    details: {},
    checks: {},
    registered: true,
    status: "registered",
  }),
}));
vi.mock("../../../../../server/revenue-engine/loop", () => ({
  onVerificationEvent: vi.fn(),
}));

import { POST } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  mocks.registryError = null;
  mocks.steps.length = 0;
  mocks.reserveX402Spend.mockReset().mockImplementation(async () => {
    mocks.steps.push("reservation");
    return { ok: true, id: "reservation-1" };
  });
  mocks.releaseX402Spend.mockReset().mockResolvedValue(true);
  mocks.settlePayment.mockReset();
});

function request() {
  return new Request("https://authichain.com/api/v1/agent-verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sealId: "seal-1" }),
  });
}

function bindEnvironment() {
  vi.stubEnv("X402_PAY_TO", "0xpayto");
  vi.stubEnv("SUPABASE_URL", "https://supabase.example");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-test");
}

describe("POST /api/v1/agent-verify", () => {
  it("does not reserve spend when the registry lookup fails", async () => {
    bindEnvironment();
    mocks.registryError = { message: "registry unavailable" };

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "registry_unavailable",
      settled: false,
    });
    expect(mocks.steps).toEqual(["registry"]);
    expect(mocks.reserveX402Spend).not.toHaveBeenCalled();
    expect(mocks.settlePayment).not.toHaveBeenCalled();
  });

  it("does not settle when the atomic reservation refuses the payer", async () => {
    bindEnvironment();
    mocks.reserveX402Spend.mockImplementation(async () => {
      mocks.steps.push("reservation");
      return { ok: true, id: null };
    });

    const response = await POST(request());

    expect(response.status).toBe(402);
    expect(await response.json()).toMatchObject({
      error: "daily_spend_cap_exceeded",
    });
    expect(mocks.steps).toEqual(["registry", "reservation"]);
    expect(mocks.reserveX402Spend).toHaveBeenCalledOnce();
    expect(mocks.settlePayment).not.toHaveBeenCalled();
    expect(mocks.releaseX402Spend).not.toHaveBeenCalled();
  });

  it("releases the reservation after a definite settlement rejection", async () => {
    bindEnvironment();
    mocks.settlePayment.mockResolvedValue({
      settled: false,
      trustless: false,
      reason: "payment_rejected",
    });

    const response = await POST(request());

    expect(response.status).toBe(402);
    expect(mocks.steps).toEqual(["registry", "reservation"]);
    expect(mocks.settlePayment).toHaveBeenCalledOnce();
    expect(mocks.releaseX402Spend).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ role: "service" }),
      "reservation-1"
    );
  });
});
