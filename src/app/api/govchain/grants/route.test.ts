import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Fake supabase-js: mirrors the real client's guard (throws on an empty URL)
// and records which URL the route actually built its client with.
const state = vi.hoisted(() => ({
  urls: [] as string[],
  queryError: null as string | null,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (url: string, key: string) => {
    if (!url) throw new Error("supabaseUrl is required.");
    if (!key) throw new Error("supabaseKey is required.");
    state.urls.push(url);
    const result = {
      data: [{ id: "g1", program: "SBIR Phase I", agency: "NSF" }],
      count: 1,
      error: state.queryError ? new Error(state.queryError) : null,
    };
    const chain: Record<string, unknown> = {};
    for (const m of ["from", "select", "order", "range", "ilike", "gte"]) {
      chain[m] = () => chain;
    }
    chain.then = (resolve: (v: unknown) => unknown) => resolve(result);
    return chain;
  },
}));

const ENV_KEYS = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;
const saved: Record<string, string | undefined> = {};

async function callGet(query = "") {
  vi.resetModules(); // supabase-admin caches its client per module instance
  const { GET } = await import("./route");
  return GET(
    new NextRequest(`https://authichain.com/api/govchain/grants${query}`)
  );
}

describe("/api/govchain/grants env resolution", () => {
  beforeEach(() => {
    state.urls = [];
    state.queryError = null;
    for (const k of ENV_KEYS) saved[k] = process.env[k];
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it.each([
    ["empty string (as inlined by next build)", ""],
    ["unset", undefined],
  ])(
    "(1) reads SUPABASE_URL at runtime when NEXT_PUBLIC_SUPABASE_URL is %s",
    async (_label, publicUrl) => {
      process.env.SUPABASE_URL = "https://example-ref.supabase.co";
      if (publicUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = publicUrl;
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";

      const res = await callGet();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ total: 1, limit: 20, offset: 0 });
      expect(body.grants).toHaveLength(1);
      expect(state.urls).toEqual(["https://example-ref.supabase.co"]);
    }
  );

  it("(2) neither URL set: JSON 500 that names no env vars", async () => {
    delete process.env.SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";

    const res = await callGet();
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "service unavailable" });
    expect(text).not.toMatch(/SUPABASE|SERVICE_ROLE|supabaseUrl|process\.env/i);
    expect(state.urls).toEqual([]);
  });

  it("(3) a query error does not echo the message", async () => {
    process.env.SUPABASE_URL = "https://example-ref.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    state.queryError = "https://example-ref.supabase.co relation missing";

    const res = await callGet();
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "service unavailable" });
    expect(text).not.toContain("example-ref");
    expect(text).not.toContain("relation");
  });
});
