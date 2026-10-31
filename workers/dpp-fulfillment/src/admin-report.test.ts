import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { isAdminAuthorized, timingSafeEqual, type Env } from "./index";

const ADMIN = "test-admin-token-not-real";
const WEBHOOK = "whsec_test_not_real";

function makeEnv(overrides: Partial<Env> = {}): Env {
  const store = new Map<string, string>();
  return {
    KV: {
      get: async (k: string) => store.get(k) ?? null,
      put: async (k: string, v: string) => void store.set(k, v),
    } as unknown as KVNamespace,
    STRIPE_WEBHOOK_SECRET: WEBHOOK,
    RESEND_API_KEY: "re_test_not_real",
    OFFER_KEY: "dpp_readiness_2026",
    PAYMENT_LINK_URL: "https://buy.stripe.com/test",
    FROM_EMAIL: "from@example.com",
    REPLY_TO: "reply@example.com",
    FOUNDER_NOTIFY: "founder@example.com",
    DPP_ADMIN_TOKEN: ADMIN,
    ...overrides,
  };
}

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

function report(auth?: string): Request {
  const headers: Record<string, string> = {};
  if (auth !== undefined) headers.Authorization = auth;
  return new Request("https://dpp.example/admin/report", {
    method: "POST",
    headers,
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("timingSafeEqual", () => {
  it("matches equal strings and rejects different ones, including different lengths", async () => {
    expect(await timingSafeEqual("abc", "abc")).toBe(true);
    expect(await timingSafeEqual("abc", "abd")).toBe(false);
    expect(await timingSafeEqual("abc", "abcd")).toBe(false);
    expect(await timingSafeEqual("", "x")).toBe(false);
  });
});

describe("isAdminAuthorized", () => {
  it("fails closed when DPP_ADMIN_TOKEN is unset or empty", async () => {
    expect(await isAdminAuthorized("Bearer ", undefined)).toBe(false);
    expect(await isAdminAuthorized("Bearer ", "")).toBe(false);
    expect(await isAdminAuthorized(null, undefined)).toBe(false);
  });
  it("requires the Bearer scheme and the exact token", async () => {
    expect(await isAdminAuthorized(`Bearer ${ADMIN}`, ADMIN)).toBe(true);
    expect(await isAdminAuthorized(ADMIN, ADMIN)).toBe(false);
    expect(await isAdminAuthorized(`Basic ${ADMIN}`, ADMIN)).toBe(false);
    expect(await isAdminAuthorized(`Bearer ${ADMIN}x`, ADMIN)).toBe(false);
    expect(await isAdminAuthorized(null, ADMIN)).toBe(false);
  });
});

describe("POST /admin/report", () => {
  it("returns 401 for every request when DPP_ADMIN_TOKEN is unset", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const env = makeEnv({ DPP_ADMIN_TOKEN: undefined });
    for (const auth of [
      undefined,
      "Bearer ",
      "Bearer undefined",
      `Bearer ${WEBHOOK}`,
    ]) {
      const res = await worker.fetch(report(auth), env, ctx);
      expect(res.status).toBe(401);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("no longer accepts the Stripe webhook secret as the admin bearer", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await worker.fetch(report(`Bearer ${WEBHOOK}`), makeEnv(), ctx);
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a wrong or missing token", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect((await worker.fetch(report(), makeEnv(), ctx)).status).toBe(401);
    expect(
      (await worker.fetch(report("Bearer wrong"), makeEnv(), ctx)).status
    ).toBe(401);
  });

  it("runs the report with the correct DPP_ADMIN_TOKEN", async () => {
    const fetchSpy = vi.fn(async () => Response.json({ id: "email_1" }));
    vi.stubGlobal("fetch", fetchSpy);
    const res = await worker.fetch(report(`Bearer ${ADMIN}`), makeEnv(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
