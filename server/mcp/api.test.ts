import { afterEach, describe, expect, it } from "vitest";
import { apiBase, apiCall } from "./api";

const originalFetch = globalThis.fetch;
const originalBase = process.env.AUTHICHAIN_API_BASE;
const originalKey = process.env.AUTHICHAIN_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalBase === undefined) delete process.env.AUTHICHAIN_API_BASE;
  else process.env.AUTHICHAIN_API_BASE = originalBase;
  if (originalKey === undefined) delete process.env.AUTHICHAIN_API_KEY;
  else process.env.AUTHICHAIN_API_KEY = originalKey;
});

describe("authichain API MCP client", () => {
  it("defaults the base to the public site", () => {
    delete process.env.AUTHICHAIN_API_BASE;
    expect(apiBase()).toBe("https://authichain.com");
  });

  it("sends the API key on verify and not on the x402 call", async () => {
    process.env.AUTHICHAIN_API_BASE = "https://authichain.com/";
    process.env.AUTHICHAIN_API_KEY = "ac_live_test";
    const seen: { url: string; key: string | null; payment: string | null }[] = [];
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      seen.push({
        url,
        key: headers.get("X-API-Key"),
        payment: headers.get("X-PAYMENT"),
      });
      return new Response('{"ok":true}', { status: 200 });
    }) as typeof fetch;

    await apiCall("/api/v1/verify", { method: "POST" });
    await apiCall("/api/x402", {
      method: "POST",
      headers: { "X-PAYMENT": "proof" },
    });

    expect(seen[0]).toEqual({
      url: "https://authichain.com/api/v1/verify",
      key: "ac_live_test",
      payment: null,
    });
    expect(seen[1]).toEqual({
      url: "https://authichain.com/api/x402",
      key: null,
      payment: "proof",
    });
  });
});
