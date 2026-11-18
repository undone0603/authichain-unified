import { describe, expect, it, vi } from "vitest";
import {
  BASE_USDC_ASSET,
  EXPECTED_TREASURY_PAY_TO,
  runX402VerifyClient,
} from "../../mcp/examples/x402-verify-client.mjs";

function makeChallengeResponse(overrides: Record<string, unknown> = {}, status = 402) {
  const requirement = {
    scheme: "exact",
    network: "eip155:8453",
    asset: BASE_USDC_ASSET,
    payTo: EXPECTED_TREASURY_PAY_TO,
    maxAmountRequired: "10000",
    ...overrides,
  };
  return new Response(
    JSON.stringify({
      x402Version: 2,
      accepts: [requirement],
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

describe("x402-verify-client example", () => {
  it("validates an unpaid 402 Base USDC challenge in no-spend mode without signing", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(makeChallengeResponse());

    const result = await runX402VerifyClient({
      endpoint: "https://authichain.com/api/x402",
      payload: { sku: "DEMO-001" },
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: true,
      status: 402,
      noSpend: true,
      validated: true,
      amountAtomic: "10000",
    });
    expect(result.requirement?.payTo).toBe(EXPECTED_TREASURY_PAY_TO);
  });

  it("refuses an over-budget 402 challenge before signing or retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeChallengeResponse({ maxAmountRequired: "500000" }),
    );
    const signerMock = vi.fn();

    const result = await runX402VerifyClient({
      endpoint: "https://authichain.com/api/x402",
      maxAmountAtomic: 100000n,
      createPaymentSignature: signerMock,
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(signerMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      status: 402,
      refused: true,
      code: "over_budget",
    });
  });

  it("refuses a 402 challenge with a wrong payTo recipient", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      makeChallengeResponse({ payTo: "0x000000000000000000000000000000000000dEaD" }),
    );
    const signerMock = vi.fn();

    const result = await runX402VerifyClient({
      endpoint: "https://authichain.com/api/x402",
      createPaymentSignature: signerMock,
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(signerMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      status: 402,
      refused: true,
      code: "wrong_recipient",
    });
  });

  it("refuses 503 registry_not_bound before any settlement", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "registry_not_bound" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const signerMock = vi.fn();

    const result = await runX402VerifyClient({
      endpoint: "https://authichain.com/api/x402",
      createPaymentSignature: signerMock,
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(signerMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      status: 503,
      refused: true,
      code: "registry_not_bound",
    });
  });

  it("fulfills an authorized 402 challenge by retrying with PAYMENT-SIGNATURE", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeChallengeResponse())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ verified: true, sku: "DEMO-001" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const signerMock = vi.fn().mockResolvedValueOnce("mock-payment-signature-v2");

    const result = await runX402VerifyClient({
      endpoint: "https://authichain.com/api/x402",
      payload: { sku: "DEMO-001" },
      createPaymentSignature: signerMock,
      fetchImpl: fetchMock,
    });

    expect(signerMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, secondCallInit] = fetchMock.mock.calls[1];
    expect((secondCallInit.headers as Record<string, string>)["PAYMENT-SIGNATURE"]).toBe(
      "mock-payment-signature-v2",
    );
    expect(result).toMatchObject({
      ok: true,
      status: 200,
      paid: true,
      body: { verified: true, sku: "DEMO-001" },
    });
});
  
    it("refuses a 402 challenge with conflicting amount and maxAmountRequired fields", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(makeChallengeResponse({ amount: "500000", maxAmountRequired: "10000" }));
    const signerMock = vi.fn();
    const result = await runX402VerifyClient({ endpoint: "https://authichain.com/api/x402", maxAmountAtomic: 100000n, createPaymentSignature: signerMock, fetchImpl: fetchMock });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(signerMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, status: 402, refused: true, reason: "conflicting_amount_fields" });
    });
});
