import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AUTHICHAIN_API_V1_PATHS,
  isAuthichainApiV1Path,
  tryHandleApiV1,
} from "./api-v1-routes";

function recorder(name: string) {
  const seen: Request[] = [];
  return {
    seen,
    binding: {
      fetch: async (r: Request) => {
        seen.push(r);
        return new Response(JSON.stringify({ from: name }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  };
}

function req(path: string, init?: RequestInit) {
  return new Request(`https://authichain.com${path}`, init);
}

describe("isAuthichainApiV1Path", () => {
  it("matches exactly the authichain-api endpoints", () => {
    expect(isAuthichainApiV1Path("/api/v1/.well-known/jwks.json")).toBe(true);
    expect(isAuthichainApiV1Path("/api/v1/verify")).toBe(true);
    expect(isAuthichainApiV1Path("/api/v1/qr/generate")).toBe(true);
  });

  it("does not claim edge-router or non-v1 API paths", () => {
    for (const p of [
      "/api/v1/attestation",
      "/api/v1/attestation/verify",
      "/api/v1/attestations/verify",
      "/api/v1/agent-verify",
      "/api/v1/verify/extra",
      "/api/v1",
      "/api/leads/capture",
      "/api/lead-capture",
      "/api/checkout",
      "/api/x402",
      "/.well-known/jwks.json",
    ]) {
      expect(isAuthichainApiV1Path(p), p).toBe(false);
    }
  });

  it("stays in sync with authichain-api's own endpoint list", () => {
    const src = readFileSync(
      new URL("../../authichain-api/index.js", import.meta.url),
      "utf8"
    );
    const block = src.slice(src.lastIndexOf("endpoints: ["));
    const listed = [
      ...block.slice(0, block.indexOf("]")).matchAll(/"(\/api\/v1\/[^"]+)"/g),
    ].map(m => m[1]);
    expect(listed.length).toBeGreaterThan(0);
    expect([...AUTHICHAIN_API_V1_PATHS].sort()).toEqual([...listed].sort());
  });
});

describe("tryHandleApiV1", () => {
  it("returns null when API_WORKER is not bound", async () => {
    expect(await tryHandleApiV1(req("/api/v1/verify"), {})).toBeNull();
  });

  it("forwards the original request (method, URL, body) unchanged", async () => {
    const api = recorder("api");
    const res = await tryHandleApiV1(
      req("/api/v1/verify", { method: "POST", body: '{"id":"x"}' }),
      { API_WORKER: api.binding }
    );
    expect(res?.status).toBe(200);
    expect(api.seen).toHaveLength(1);
    expect(api.seen[0].method).toBe("POST");
    expect(api.seen[0].url).toBe("https://authichain.com/api/v1/verify");
    expect(await api.seen[0].text()).toBe('{"id":"x"}');
  });
});
