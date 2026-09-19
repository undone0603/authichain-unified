// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { registerGuardrailApi, type GuardrailEnv } from "./guardrail-api";

const {
  checkAndReserveWithSupabase,
  recordEventWithSupabase,
  addSuppressionWithSupabase,
} = vi.hoisted(() => ({
  checkAndReserveWithSupabase: vi.fn(),
  recordEventWithSupabase: vi.fn(),
  addSuppressionWithSupabase: vi.fn(),
}));

vi.mock("../shared/guardrail-store", () => ({
  checkAndReserveWithSupabase,
  recordEventWithSupabase,
  addSuppressionWithSupabase,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: () => ({}) }),
}));

function appWithSecret(secret = "test-secret") {
  const app = new Hono<{ Bindings: GuardrailEnv }>();
  registerGuardrailApi(app);
  return {
    app,
    env: {
      INTERNAL_API_SECRET: secret,
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    } satisfies GuardrailEnv,
  };
}

describe("POST /api/guardrail/check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_API_SECRET = "test-secret";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  });

  afterEach(() => {
    delete process.env.INTERNAL_API_SECRET;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("returns 503 when INTERNAL_API_SECRET is missing", async () => {
    delete process.env.INTERNAL_API_SECRET;
    const app = new Hono<{ Bindings: GuardrailEnv }>();
    registerGuardrailApi(app);
    const res = await app.request("/api/guardrail/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: "email.b2b-cold" }),
    });
    expect(res.status).toBe(503);
  });

  it("returns 401 when the secret does not match", async () => {
    const { app, env } = appWithSecret();
    const res = await app.request(
      "/api/guardrail/check",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": "wrong",
        },
        body: JSON.stringify({ channel: "email.b2b-cold" }),
      },
      env
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 without a channel", async () => {
    const { app, env } = appWithSecret();
    const res = await app.request(
      "/api/guardrail/check",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": "test-secret",
        },
        body: JSON.stringify({}),
      },
      env
    );
    expect(res.status).toBe(400);
  });

  it("returns the store result when allowed", async () => {
    checkAndReserveWithSupabase.mockResolvedValue({
      allowed: true,
      remaining: 12,
    });
    const { app, env } = appWithSecret();
    const res = await app.request(
      "/api/guardrail/check",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": "test-secret",
        },
        body: JSON.stringify({
          channel: "email.b2b-cold",
          count: 1,
          recipient: "franchiseinfo@fastsigns.com",
        }),
      },
      env
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ allowed: true, remaining: 12 });
    expect(checkAndReserveWithSupabase).toHaveBeenCalledWith(
      expect.anything(),
      "email.b2b-cold",
      1,
      "franchiseinfo@fastsigns.com"
    );
  });
});

describe("POST /api/guardrail/record", () => {
  beforeEach(() => {
    process.env.INTERNAL_API_SECRET = "test-secret";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  });

  afterEach(() => {
    delete process.env.INTERNAL_API_SECRET;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("records and returns ok", async () => {
    recordEventWithSupabase.mockResolvedValue(undefined);
    const { app, env } = appWithSecret();
    const res = await app.request(
      "/api/guardrail/record",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": "test-secret",
        },
        body: JSON.stringify({
          channel: "email.b2b-cold",
          action: "record",
          allowed: true,
        }),
      },
      env
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("POST /api/guardrail/suppress", () => {
  beforeEach(() => {
    process.env.INTERNAL_API_SECRET = "test-secret";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  });

  afterEach(() => {
    delete process.env.INTERNAL_API_SECRET;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("suppresses and records", async () => {
    addSuppressionWithSupabase.mockResolvedValue(undefined);
    recordEventWithSupabase.mockResolvedValue(undefined);
    const { app, env } = appWithSecret();
    const res = await app.request(
      "/api/guardrail/suppress",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": "test-secret",
        },
        body: JSON.stringify({
          email: "bad@example.com",
          reason: "bounced",
          source: "qron-outreach-webhook",
        }),
      },
      env
    );
    expect(res.status).toBe(200);
    expect(addSuppressionWithSupabase).toHaveBeenCalled();
    expect(recordEventWithSupabase).toHaveBeenCalled();
  });
});
