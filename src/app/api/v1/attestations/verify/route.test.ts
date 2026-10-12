import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-usage", () => ({
  checkAndIncrementUsage: vi.fn().mockResolvedValue(undefined),
  ApiUsageLimitError: class ApiUsageLimitError extends Error {},
}));
vi.mock("@authichain/verifier", async () => {
  const actual = await vi.importActual<typeof import("@authichain/verifier")>(
    "@authichain/verifier",
  );
  return {
    ...actual,
    verifyWithCanonicalWorker: vi.fn(),
  };
});

import { POST } from "./route";
import { verifyWithCanonicalWorker } from "@authichain/verifier";
import { checkAndIncrementUsage } from "@/lib/api-usage";

describe("POST /api/v1/attestations/verify Next adapter", () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env.AUTHICHAIN_CANONICAL_VERIFY_URL =
      "https://canonical.example.test/api/v1/attestation/verify";
    vi.mocked(verifyWithCanonicalWorker).mockReset();
    vi.mocked(checkAndIncrementUsage).mockClear();
  });

  afterEach(() => {
    if (original.AUTHICHAIN_CANONICAL_VERIFY_URL === undefined) {
      delete process.env.AUTHICHAIN_CANONICAL_VERIFY_URL;
    } else {
      process.env.AUTHICHAIN_CANONICAL_VERIFY_URL =
        original.AUTHICHAIN_CANONICAL_VERIFY_URL;
    }
  });

  it("returns the canonical worker body and status unchanged", async () => {
    vi.mocked(verifyWithCanonicalWorker).mockResolvedValue({
      httpStatus: 409,
      response: {
        valid: false,
        decision: "revoked",
        decision_contract: "AuthiChain Verification Decision v1",
        reasons: ["durable_status_revoked"],
      },
    });

    const res = await POST(
      new NextRequest("https://authichain.com/api/v1/attestations/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jws: "signed",
          expected_object_id: "authi:test:1",
        }),
      }),
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      valid: false,
      decision: "revoked",
      decision_contract: "AuthiChain Verification Decision v1",
    });
    expect(verifyWithCanonicalWorker).toHaveBeenCalledWith(
      process.env.AUTHICHAIN_CANONICAL_VERIFY_URL,
      "signed",
      "authi:test:1",
    );
    expect(checkAndIncrementUsage).toHaveBeenCalled();
  });

  it("falls back to the public canonical verify URL when unset", async () => {
    delete process.env.AUTHICHAIN_CANONICAL_VERIFY_URL;
    vi.mocked(verifyWithCanonicalWorker).mockResolvedValue({
      httpStatus: 200,
      response: {
        valid: true,
        decision: "verified",
        decision_contract: "AuthiChain Verification Decision v1",
        reasons: [],
      },
    });
    const res = await POST(
      new NextRequest("https://authichain.com/api/v1/attestations/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jws: "signed" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(verifyWithCanonicalWorker).toHaveBeenCalledWith(
      "https://authichain.com/api/v1/attestation/verify",
      "signed",
      undefined,
    );
  });
});
