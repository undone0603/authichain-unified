// @vitest-environment node
import { describe, expect, it } from "vitest";
import app from "./index";

// The microsite router must answer before every other route. It used to be
// registered after app.get("/"), so <slug>.authichain.com/ returned
// "<h1>AuthiChain</h1>" instead of the lead's page published to MICROSITES_KV
// by agentz/core/microsites.py.

function fakeKv(entries: Record<string, string>) {
  const calls: string[] = [];
  return {
    calls,
    async get(key: string) {
      calls.push(key);
      const value = entries[key];
      if (value === undefined) return null;
      return new Response(value).body;
    },
  };
}

const request = (url: string, env: Record<string, unknown>) =>
  app.request(url, {}, env as never);

describe("microsite KV router", () => {
  it("serves <slug>.authichain.com/ from KV, not the root route", async () => {
    const kv = fakeKv({ "acme/index.html": "<h1>Acme microsite</h1>" });
    const res = await request("https://acme.authichain.com/", {
      MICROSITES_KV: kv,
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<h1>Acme microsite</h1>");
    expect(res.headers.get("content-type")).toBe("text/html; charset=UTF-8");
    expect(res.headers.get("x-served-by")).toBe("authichain-microsite-router");
    expect(kv.calls).toEqual(["acme/index.html"]);
  });

  it("serves other microsite assets with their content type", async () => {
    const kv = fakeKv({ "acme/styles.css": "body{}" });
    const res = await request("https://acme.authichain.com/styles.css", {
      MICROSITES_KV: kv,
    });
    expect(await res.text()).toBe("body{}");
    expect(res.headers.get("content-type")).toBe("text/css");
  });

  it("falls through to the existing routes when the slug has no KV entry", async () => {
    const kv = fakeKv({});
    const root = await request("https://acme.authichain.com/", {
      MICROSITES_KV: kv,
    });
    expect(await root.text()).toBe("<h1>AuthiChain</h1>");
    const health = await request("https://acme.authichain.com/health", {
      MICROSITES_KV: kv,
    });
    expect(await health.json()).toEqual({ status: "ok" });
  });

  it.each(["https://authichain.com/", "https://www.authichain.com/"])(
    "never looks up KV for the apex host %s",
    async url => {
      const kv = fakeKv({
        "authichain/index.html": "x",
        "www/index.html": "x",
      });
      const res = await request(url, { MICROSITES_KV: kv });
      expect(await res.text()).toBe("<h1>AuthiChain</h1>");
      expect(kv.calls).toEqual([]);
    }
  );

  it("falls through without throwing when MICROSITES_KV is not bound", async () => {
    const res = await request("https://acme.authichain.com/health", {});
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
