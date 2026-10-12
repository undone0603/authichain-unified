import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/dpp-verify", () => ({ verifyDpp: vi.fn() }));
vi.mock("../../../../../packages/verifier/src/canonical-worker-client", () => ({
  verifyWithCanonicalWorker: vi.fn(),
}));

import { GET, POST } from "./route";
import { verifyDpp } from "@/lib/dpp-verify";
import { verifyWithCanonicalWorker } from "../../../../../packages/verifier/src/canonical-worker-client";

const publishedDpp = {
  ok: true,
  status: "verified",
  dpp_id: "dpp-test-1",
  product: { name: "Test product", brand: "Test brand" },
  proves: "This passport is published and resolves to a registered product record.",
  doesNotProve: "Does not prove the physical item in hand matches it.",
  event_recorded: false,
} as const;

const canonicalBlocked = {
  valid: false,
  decision: "blocked",
  decision_contract: "AuthiChain Verification Decision v1",
  reasons: ["decision_blocked"],
};

describe("DPP verification canonical adapter", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.AUTHICHAIN_CANONICAL_VERIFY_URL = "https://canonical.example.test/api/v1/attestation/verify";
    vi.mocked(verifyDpp).mockResolvedValue(publishedDpp as never);
    vi.mocked(verifyWithCanonicalWorker).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "AUTHICHAIN_CANONICAL_VERIFY_URL",
    ]) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it("preserves the canonical blocked decision instead of treating publication as physical verification", async () => {
    vi.mocked(verifyWithCanonicalWorker).mockResolvedValue({
      httpStatus: 200,
      response: canonicalBlocked,
    });
    const res = await POST(new NextRequest("https://authichain.com/api/dpp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dpp_id: "dpp-test-1", jws: "signed-attestation", expected_object_id: "gtin:123" }),
    }));

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      ok: true,
      status: "verified",
      doesNotProve: expect.stringMatching(/physical item/i),
      protocol_verification: canonicalBlocked,
    });
    expect(verifyWithCanonicalWorker).toHaveBeenCalledWith(
      process.env.AUTHICHAIN_CANONICAL_VERIFY_URL,
      "signed-attestation",
      "gtin:123",
    );
  });

  it("fails closed with 502 when canonical verification is unavailable", async () => {
    vi.mocked(verifyWithCanonicalWorker).mockRejectedValue(new Error("upstream unavailable"));
    const res = await GET(new NextRequest(
      "https://authichain.com/api/dpp/verify?dpp_id=dpp-test-1&jws=signed-attestation",
    ));

    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({
      ok: true,
      protocol_verification: {
        valid: false,
        decision: "indeterminate",
        reasons: ["canonical_verification_unavailable"],
      },
    });
  });

  it("does not call the canonical verifier when no signed attestation is supplied", async () => {
    const res = await GET(new NextRequest(
      "https://authichain.com/api/dpp/verify?dpp_id=dpp-test-1",
    ));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      status: "verified",
      doesNotProve: expect.stringMatching(/physical item/i),
    });
    expect(verifyWithCanonicalWorker).not.toHaveBeenCalled();
  });

  it("fails closed when the canonical endpoint is not configured", async () => {
    delete process.env.AUTHICHAIN_CANONICAL_VERIFY_URL;
    const res = await POST(new NextRequest("https://authichain.com/api/dpp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dpp_id: "dpp-test-1", jws: "signed-attestation" }),
    }));

    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({
      protocol_verification: {
        valid: false,
        decision: "indeterminate",
        reasons: ["canonical_verification_unavailable"],
      },
    });
    expect(verifyWithCanonicalWorker).not.toHaveBeenCalled();
  });
});
