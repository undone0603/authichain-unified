import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getStripeSecretKey,
  normalizeStripeSecretKey,
  STRIPE_BUILD_PLACEHOLDER,
  stripeNotConfiguredResponse,
} from "./stripe-secret";

// Dummy test-mode-shaped values only. Never put a real key in a test.
const DUMMY = "sk_test_dummy_for_unit_tests";

describe("stripe-secret (PM-231)", () => {
  const saved = process.env.STRIPE_SECRET_KEY;
  afterEach(() => {
    if (saved === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = saved;
  });

  it("treats unset, blank and the build placeholder as not configured", () => {
    expect(normalizeStripeSecretKey(undefined)).toBeNull();
    expect(normalizeStripeSecretKey(null)).toBeNull();
    expect(normalizeStripeSecretKey("   ")).toBeNull();
    expect(normalizeStripeSecretKey(STRIPE_BUILD_PLACEHOLDER)).toBeNull();
    expect(normalizeStripeSecretKey("build_placeholder")).toBeNull();
    expect(normalizeStripeSecretKey(` ${DUMMY} `)).toBe(DUMMY);
  });

  it("reads process.env at call time, not at import time", () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(getStripeSecretKey()).toBeNull();
    process.env.STRIPE_SECRET_KEY = DUMMY;
    expect(getStripeSecretKey()).toBe(DUMMY);
    process.env.STRIPE_SECRET_KEY = STRIPE_BUILD_PLACEHOLDER;
    expect(getStripeSecretKey()).toBeNull();
  });

  it("prefers an explicit Worker env binding", () => {
    process.env.STRIPE_SECRET_KEY = STRIPE_BUILD_PLACEHOLDER;
    expect(getStripeSecretKey({ STRIPE_SECRET_KEY: DUMMY })).toBe(DUMMY);
    expect(getStripeSecretKey({ STRIPE_SECRET_KEY: STRIPE_BUILD_PLACEHOLDER })).toBeNull();
  });

  it("fails closed with a clear 500 that never echoes the key", async () => {
    const res = stripeNotConfiguredResponse();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("stripe_not_configured");
    expect(JSON.stringify(body)).not.toMatch(/sk_(live|test)_/);
  });

  it("next.config.js does not inline STRIPE_SECRET_KEY at build time", () => {
    const src = readFileSync(join(process.cwd(), "next.config.js"), "utf8");
    expect(src).not.toMatch(/^\s*STRIPE_SECRET_KEY\s*:/m);
    expect(src).not.toContain(STRIPE_BUILD_PLACEHOLDER);
  });
});
