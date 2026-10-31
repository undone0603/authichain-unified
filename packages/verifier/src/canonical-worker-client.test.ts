import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CANONICAL_VERIFY_URL,
  isCanonicalPositive,
  resolveCanonicalVerifyUrl,
  verifyWithCanonicalWorker,
} from "./canonical-worker-client";

describe("isCanonicalPositive", () => {
  const verified = { valid: true, decision: "verified" };

  it("is positive only for 2xx + valid + verified", () => {
    expect(isCanonicalPositive({ httpStatus: 200, response: verified })).toBe(true);
  });

  it("a verified body under an error status is not positive", () => {
    for (const httpStatus of [301, 400, 409, 503]) {
      expect(isCanonicalPositive({ httpStatus, response: verified })).toBe(false);
    }
  });

  it("valid=true with any other decision is not positive", () => {
    for (const decision of ["warning", "blocked", "revoked", "expired", "not_found", "risk", "indeterminate"]) {
      expect(isCanonicalPositive({ httpStatus: 200, response: { valid: true, decision } })).toBe(false);
    }
    expect(isCanonicalPositive({ httpStatus: 200, response: { valid: false, decision: "verified" } })).toBe(false);
  });
});

describe("verifyWithCanonicalWorker", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the decision and HTTP status from the worker", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ valid: false, decision: "revoked" }), { status: 409 })));
    await expect(verifyWithCanonicalWorker("https://w.example/verify", "a.b.c")).resolves.toEqual({
      httpStatus: 409,
      response: { valid: false, decision: "revoked" },
    });
  });

  it("throws on a body outside the decision contract instead of passing it on", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })));
    await expect(verifyWithCanonicalWorker("https://w.example/verify", "a.b.c")).rejects.toThrow(
      /decision contract/,
    );
  });

  it("throws when the worker does not answer in time", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      })));
    await expect(
      verifyWithCanonicalWorker("https://w.example/verify", "a.b.c", undefined, { timeoutMs: 20 }),
    ).rejects.toThrow();
  });
});

describe("resolveCanonicalVerifyUrl", () => {
  const original = process.env.AUTHICHAIN_CANONICAL_VERIFY_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.AUTHICHAIN_CANONICAL_VERIFY_URL;
    else process.env.AUTHICHAIN_CANONICAL_VERIFY_URL = original;
  });

  it("prefers an explicit endpoint", () => {
    process.env.AUTHICHAIN_CANONICAL_VERIFY_URL = "https://env.example/verify";
    expect(resolveCanonicalVerifyUrl("https://explicit.example/verify")).toBe(
      "https://explicit.example/verify",
    );
  });

  it("uses the env override when set", () => {
    process.env.AUTHICHAIN_CANONICAL_VERIFY_URL = "https://env.example/verify";
    expect(resolveCanonicalVerifyUrl()).toBe("https://env.example/verify");
  });

  it("falls back to the public production verify URL", () => {
    delete process.env.AUTHICHAIN_CANONICAL_VERIFY_URL;
    expect(resolveCanonicalVerifyUrl()).toBe(DEFAULT_CANONICAL_VERIFY_URL);
    expect(DEFAULT_CANONICAL_VERIFY_URL).toBe(
      "https://authichain.com/api/v1/attestation/verify",
    );
  });
});
