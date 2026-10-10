import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./edge";

describe("QRON edge POST /api/verify canonical adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes the canonical verified response through unchanged", async () => {
    const canonical = {
      valid: true,
      decision: "verified",
      decision_contract: "AuthiChain Verification Decision v1",
      reasons: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(canonical), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await worker.fetch(
      new Request("https://qron.space/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jws: "signed-attestation", expected_object_id: "gtin:123" }),
      }),
      { AUTHICHAIN_CANONICAL_VERIFY_URL: "https://canonical.example.test/verify" } as never,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual(canonical);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://canonical.example.test/verify",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ jws: "signed-attestation", expected_object_id: "gtin:123" }),
      }),
    );
  });

  it("preserves a canonical blocked decision and non-success status", async () => {
    const canonical = { valid: false, decision: "blocked", reasons: ["decision_blocked"] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify(canonical), {
        status: 409,
        headers: { "content-type": "application/json" },
      }),
    ));

    const res = await worker.fetch(
      new Request("https://qron.space/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jws: "signed-attestation" }),
      }),
      { AUTHICHAIN_CANONICAL_VERIFY_URL: "https://canonical.example.test/verify" } as never,
    );

    expect(res.status).toBe(409);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual(canonical);
  });

  it("fails closed when the canonical endpoint is not configured", async () => {
    const res = await worker.fetch(
      new Request("https://qron.space/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jws: "signed-attestation" }),
      }),
      {} as never,
    );

    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({
      valid: false,
      decision: "indeterminate",
      error: "AUTHICHAIN_CANONICAL_VERIFY_URL not configured",
    });
  });

  it("rejects requests without a JWS", async () => {
    const res = await worker.fetch(
      new Request("https://qron.space/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expected_object_id: "gtin:123" }),
      }),
      { AUTHICHAIN_CANONICAL_VERIFY_URL: "https://canonical.example.test/verify" } as never,
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      valid: false,
      decision: "indeterminate",
      error: "jws is required",
    });
  });

  it("returns indeterminate when the canonical service cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));

    const res = await worker.fetch(
      new Request("https://qron.space/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jws: "signed-attestation" }),
      }),
      { AUTHICHAIN_CANONICAL_VERIFY_URL: "https://canonical.example.test/verify" } as never,
    );

    expect(res.status).toBe(502);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({
      valid: false,
      decision: "indeterminate",
      error: "network unavailable",
    });
  });
});
