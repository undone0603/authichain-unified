import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// CFA-443 / CFA-444: supabase-admin must read the Cloudflare runtime bindings
// (getCloudflareContext().env) before process.env, treat empty/whitespace as
// missing, and log only the NAMES of missing vars.

const state = vi.hoisted(() => ({
  ctxEnv: {} as Record<string, unknown>,
  ctxThrows: false,
  created: [] as Array<{ url: string; key: string }>,
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => {
    if (state.ctxThrows) {
      throw new Error("getCloudflareContext called outside a request");
    }
    return { env: state.ctxEnv, cf: undefined, ctx: {} };
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (url: string, key: string) => {
    if (!url) throw new Error("supabaseUrl is required.");
    if (!key) throw new Error("supabaseKey is required.");
    state.created.push({ url, key });
    return { __fake: true, url };
  },
}));

const ENV_KEYS = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;
const saved: Record<string, string | undefined> = {};

const URL_A = "https://cf-binding-ref.supabase.co";
const URL_B = "https://public-binding-ref.supabase.co";
const KEY_A = "sr-key-value-do-not-log-1234567890";

async function load() {
  vi.resetModules(); // module caches its client
  return import("./supabase-admin");
}

describe("supabase-admin runtime env resolution", () => {
  beforeEach(() => {
    state.ctxEnv = {};
    state.ctxThrows = false;
    state.created = [];
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    vi.restoreAllMocks();
  });

  it("(a) uses Cloudflare env values when process.env is empty", async () => {
    process.env.SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    state.ctxEnv = { SUPABASE_URL: URL_A, SUPABASE_SERVICE_ROLE_KEY: KEY_A };
    const { getSupabaseAdmin } = await load();
    expect(() => getSupabaseAdmin()).not.toThrow();
    expect(state.created).toEqual([{ url: URL_A, key: KEY_A }]);
  });

  it("(b, CFA-444) ctx SUPABASE_URL '' falls back to ctx NEXT_PUBLIC_SUPABASE_URL", async () => {
    // process.env.NEXT_PUBLIC_SUPABASE_URL is inlined as '' by next build.
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    state.ctxEnv = {
      SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_URL: URL_B,
      SUPABASE_SERVICE_ROLE_KEY: KEY_A,
    };
    const { getSupabaseAdmin } = await load();
    expect(() => getSupabaseAdmin()).not.toThrow();
    expect(state.created).toEqual([{ url: URL_B, key: KEY_A }]);
  });

  it("(b2) process.env SUPABASE_URL '' falls back to process.env NEXT_PUBLIC_SUPABASE_URL", async () => {
    state.ctxThrows = true;
    process.env.SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL_B;
    process.env.SUPABASE_SERVICE_ROLE_KEY = KEY_A;
    const { getSupabaseAdmin } = await load();
    getSupabaseAdmin();
    expect(state.created).toEqual([{ url: URL_B, key: KEY_A }]);
  });

  it("(b3) precedence: ctx SUPABASE_URL > ctx NEXT_PUBLIC > process SUPABASE_URL > process NEXT_PUBLIC", async () => {
    process.env.SUPABASE_URL = "https://proc-url.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proc-public.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = KEY_A;
    state.ctxEnv = { NEXT_PUBLIC_SUPABASE_URL: URL_B };
    const { getSupabaseAdmin } = await load();
    getSupabaseAdmin();
    expect(state.created[0].url).toBe(URL_B);
  });

  it("(c) both URLs and key empty: logs names only, no value substrings, throws generic", async () => {
    const SECRETISH = "proc-secret-like-whitespace-free-value";
    process.env.SUPABASE_URL = "   ";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "\t";
    state.ctxEnv = {
      SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_URL: " ",
      UNRELATED: SECRETISH,
    };
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getSupabaseAdmin } = await load();

    let thrown: unknown;
    try {
      getSupabaseAdmin();
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(state.created).toEqual([]);

    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith(
      "supabase-admin: missing or empty env",
      ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    );
    const logged = JSON.stringify([
      errSpy.mock.calls,
      logSpy.mock.calls,
      warnSpy.mock.calls,
      (thrown as Error).message,
    ]);
    for (const v of [SECRETISH, URL_A, URL_B, KEY_A, "supabase.co", "length"]) {
      expect(logged).not.toContain(v);
    }
    // no digits => no lengths printed
    expect(JSON.stringify(errSpy.mock.calls)).not.toMatch(/\d/);
  });

  it("(c2) only the key empty: logs only the key name, never the URL", async () => {
    state.ctxEnv = { SUPABASE_URL: URL_A, SUPABASE_SERVICE_ROLE_KEY: "" };
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { getSupabaseAdmin } = await load();
    expect(() => getSupabaseAdmin()).toThrow();
    expect(errSpy).toHaveBeenCalledWith(
      "supabase-admin: missing or empty env",
      ["SUPABASE_SERVICE_ROLE_KEY"]
    );
    expect(JSON.stringify(errSpy.mock.calls)).not.toContain(URL_A);
  });

  it("(d) trims whitespace from values", async () => {
    state.ctxEnv = {
      SUPABASE_URL: `  ${URL_A}\n`,
      SUPABASE_SERVICE_ROLE_KEY: `\t${KEY_A}  `,
    };
    const { getSupabaseAdmin } = await load();
    getSupabaseAdmin();
    expect(state.created).toEqual([{ url: URL_A, key: KEY_A }]);
  });

  it("(e) getCloudflareContext throwing falls back to process.env", async () => {
    state.ctxThrows = true;
    process.env.SUPABASE_URL = URL_A;
    process.env.SUPABASE_SERVICE_ROLE_KEY = KEY_A;
    const { getSupabaseAdmin } = await load();
    expect(() => getSupabaseAdmin()).not.toThrow();
    expect(state.created).toEqual([{ url: URL_A, key: KEY_A }]);
  });

  it("supabaseAdmin proxy still defers creation to first property access", async () => {
    state.ctxEnv = { SUPABASE_URL: URL_A, SUPABASE_SERVICE_ROLE_KEY: KEY_A };
    const { supabaseAdmin } = await load();
    expect(state.created).toEqual([]);
    expect((supabaseAdmin as unknown as { url: string }).url).toBe(URL_A);
    expect(state.created).toHaveLength(1);
  });
});
