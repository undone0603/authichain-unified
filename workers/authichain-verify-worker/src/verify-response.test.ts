// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { type Env } from "./index";

// RES-145 / PM-394: /api/verify must not present 0x4da4…72BE as AuthiChain's
// contract. Nobody has shown we control it, so polygon.contract is null.
const env = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  NEXT_PUBLIC_SITE_URL: "https://authichain.com",
} as Env;

describe("/api/verify polygon block", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns polygon.contract null for the published demonstration record", async () => {
    // No network in tests: JWKS and RPC reads fail closed.
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const res = await worker.fetch(
      new Request("https://authichain.com/api/verify?id=polygon-anchor-1"),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { polygon?: { contract?: unknown } };
    expect(body.polygon).toBeDefined();
    expect(body.polygon!.contract).toBeNull();
    expect(JSON.stringify(body)).not.toMatch(/0x4da4D2675e52374639C9c954f4f653887A9972BE/i);
  });
});
