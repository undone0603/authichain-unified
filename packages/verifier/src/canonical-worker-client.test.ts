import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CANONICAL_VERIFY_URL,
  resolveCanonicalVerifyUrl,
} from "./canonical-worker-client";

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
