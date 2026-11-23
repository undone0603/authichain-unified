import { describe, expect, it, vi } from "vitest";
import { proxyRuntimeDbAttestation, RUNTIME_ATTESTATION_PATH } from "./runtime-db-attestation-proxy";

const path = "https://authichain.com" + RUNTIME_ATTESTATION_PATH;
const key = "Bearer " + "x".repeat(40);
const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "set-cookie": "must-not-escape=1" },
  });

describe("private OpenNext runtime attestation forwarding", () => {
  it("rejects anonymous or malformed authorization without calling the app", async () => {
    const fetch = vi.fn();
    for (const auth of [undefined, "Bearer short", "Basic invalid"]) {
      const res = await proxyRuntimeDbAttestation(
        new Request(path, { headers: auth ? { authorization: auth } : {} }),
        { fetch },
      );
      expect(res.status).toBe(401);
      expect(res.headers.get("cache-control")).toContain("no-store");
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects every other method, query string, and missing service binding", async () => {
    const fetch = vi.fn();
    for (const method of ["POST", "HEAD", "PUT"]) {
      const res = await proxyRuntimeDbAttestation(
        new Request(path, { method, headers: { authorization: key } }),
        { fetch },
      );
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("GET");
    }
    expect((await proxyRuntimeDbAttestation(new Request(path + "?debug=1", { headers: { authorization: key } }), { fetch })).status).toBe(404);
    expect((await proxyRuntimeDbAttestation(new Request(path, { headers: { authorization: key } }))).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("proxies only the Bearer credential directly to the existing service binding", async () => {
    const fetch = vi.fn(async (upstream: Request) => {
      expect(upstream.url).toBe("https://app.authichain.com" + RUNTIME_ATTESTATION_PATH);
      expect(upstream.method).toBe("GET");
      expect(upstream.headers.get("authorization")).toBe(key);
      expect(upstream.headers.get("accept")).toBe("application/json");
      expect(upstream.headers.get("cookie")).toBeNull();
      expect(upstream.headers.get("x-internal-secret")).toBeNull();
      return json({ verified: true, deployedVersion: "a".repeat(40), connections: {} });
    });
    const res = await proxyRuntimeDbAttestation(new Request(path, {
      headers: { authorization: key, cookie: "session=private", "x-internal-secret": "client-controlled" },
    }), { fetch });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("preserves 401/503 failures without copying upstream cookies", async () => {
    for (const status of [401, 503]) {
      const res = await proxyRuntimeDbAttestation(new Request(path, { headers: { authorization: key } }), {
        fetch: async () => json({ verified: false, error: status === 401 ? "unauthorized" : "attestation_unavailable" }, status),
      });
      expect(res.status).toBe(status);
      expect(res.headers.get("set-cookie")).toBeNull();
    }
  });

  it("fails closed on upstream errors, invalid bodies, mismatched success, and redirects", async () => {
    const upstreams = [
      async () => { throw new Error("secret error message"); },
      async () => new Response("secret value", { status: 200 }),
      async () => json({ verified: false }, 200),
      async () => json({ verified: true }, 503),
      async () => json({ verified: true }, 302),
      async () => json({ verified: true, padding: "X".repeat(9000) }),
    ];
    for (const fetch of upstreams) {
      const res = await proxyRuntimeDbAttestation(new Request(path, { headers: { authorization: key } }), { fetch });
      expect(res.status).toBe(503);
      expect(await res.text()).not.toContain("secret value");
      expect(res.headers.get("cache-control")).toContain("no-store");
    }
  });
});
