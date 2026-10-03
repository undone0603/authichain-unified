// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import {
  registerUnsubscribeRoutes,
  type UnsubscribeBindings,
} from "./unsubscribe-routes";
import {
  signedUnsubscribeUrl,
  unsubscribeCheckUrl,
} from "../server/outreach/unsubscribe-link";

const SECRET = "edge-optout-secret";
const UNSUBSCRIBED = /You(&#39;|')re unsubscribed/;
const ENV: UnsubscribeBindings = {
  OUTREACH_UNSUBSCRIBE_SECRET: SECRET,
  SUPABASE_URL: "https://db.example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
};

function app() {
  const hono = new Hono();
  registerUnsubscribeRoutes(hono);
  return hono;
}

function pathOf(url: string) {
  const u = new URL(url);
  return u.pathname + u.search;
}

function stubSupabase(status = 201) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(null, { status });
    })
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OUTREACH_UNSUBSCRIBE_SECRET;
});

describe("GET /api/outreach/unsubscribe", () => {
  it("records a valid link in guardrail_suppression_list", async () => {
    const calls = stubSupabase();
    const link = await signedUnsubscribeUrl({
      secret: SECRET,
      email: "Dana@AcmeLabs.com",
    });
    const res = await app().request(pathOf(link), {}, ENV);
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(UNSUBSCRIBED);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://db.example.supabase.co/rest/v1/guardrail_suppression_list?on_conflict=email"
    );
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Prefer).toContain("resolution=ignore-duplicates");
    expect(headers.Authorization).toBe("Bearer service-role");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      email: "dana@acmelabs.com",
      reason: "unsubscribed",
      source: "unsubscribe_link",
    });
  });

  it("rejects a tampered or foreign token without writing", async () => {
    const calls = stubSupabase();
    const link = await signedUnsubscribeUrl({
      secret: "some-other-secret",
      email: "dana@acmelabs.com",
    });
    const res = await app().request(pathOf(link), {}, ENV);
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("will not unsubscribe the reserved check address", async () => {
    const calls = stubSupabase();
    const check = await unsubscribeCheckUrl({ secret: SECRET });
    const res = await app().request(
      pathOf(check).replace("/unsubscribe/check", "/unsubscribe"),
      {},
      ENV
    );
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("answers 503 and says to reply when the edge isn't configured", async () => {
    const calls = stubSupabase();
    const link = await signedUnsubscribeUrl({
      secret: SECRET,
      email: "dana@acmelabs.com",
    });
    const res = await app().request(
      pathOf(link),
      {},
      { ...ENV, OUTREACH_UNSUBSCRIBE_SECRET: undefined }
    );
    expect(res.status).toBe(503);
    expect(await res.text()).toContain("unsubscribe");
    expect(calls).toHaveLength(0);
  });

  it("answers 503 when the write fails, never a false success", async () => {
    stubSupabase(500);
    const link = await signedUnsubscribeUrl({
      secret: SECRET,
      email: "dana@acmelabs.com",
    });
    const res = await app().request(pathOf(link), {}, ENV);
    expect(res.status).toBe(503);
    expect(await res.text()).not.toMatch(UNSUBSCRIBED);
  });
});

describe("POST /api/outreach/unsubscribe (RFC 8058 one-click)", () => {
  it("records the opt-out and answers plain text", async () => {
    const calls = stubSupabase();
    const link = await signedUnsubscribeUrl({
      secret: SECRET,
      email: "dana@acmelabs.com",
    });
    const res = await app().request(
      pathOf(link),
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      },
      ENV
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(calls).toHaveLength(1);
  });
});

describe("GET /api/outreach/unsubscribe/check", () => {
  it("confirms the same secret without writing", async () => {
    const calls = stubSupabase();
    const res = await app().request(
      pathOf(await unsubscribeCheckUrl({ secret: SECRET })),
      {},
      ENV
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: true, tokenValid: true });
    expect(calls).toHaveLength(0);
  });

  it("reports a secret mismatch as 409", async () => {
    const res = await app().request(
      pathOf(
        await unsubscribeCheckUrl({ secret: "github-has-a-different-one" })
      ),
      {},
      ENV
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ configured: true, tokenValid: false });
  });

  it("only accepts the reserved check address", async () => {
    const res = await app().request(
      "/api/outreach/unsubscribe/check?e=dana%40acmelabs.com&t=00",
      {},
      ENV
    );
    expect(res.status).toBe(400);
  });

  it("answers 503 unconfigured", async () => {
    const res = await app().request(
      pathOf(await unsubscribeCheckUrl({ secret: SECRET })),
      {},
      { ...ENV, SUPABASE_SERVICE_ROLE_KEY: undefined }
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ configured: false, tokenValid: false });
  });
});
