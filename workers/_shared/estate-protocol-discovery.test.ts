import { test } from "node:test";
import assert from "node:assert/strict";
import { tryHandleEstateProtocolDiscovery } from "./estate-protocol-discovery.ts";

test("non-discovery paths are ignored", async () => {
  const res = await tryHandleEstateProtocolDiscovery(
    new Request("https://qron.space/api/verify", { method: "GET" }),
  );
  assert.equal(res, null);
});

test("POST /protocol/jwks.json is method_not_allowed", async () => {
  const res = await tryHandleEstateProtocolDiscovery(
    new Request("https://strainchain.io/protocol/jwks.json", { method: "POST" }),
  );
  assert.ok(res);
  assert.equal(res!.status, 405);
  const body = (await res!.json()) as { error: string };
  assert.equal(body.error, "method_not_allowed");
});

test("GET /.well-known/jwks.json proxies the canonical issuer", async () => {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ keys: [{ kid: "canonical" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const res = await tryHandleEstateProtocolDiscovery(
    new Request("https://govchain.us/.well-known/jwks.json", { method: "GET" }),
    { AUTHICHAIN_PROTOCOL_ORIGIN: "https://authichain.com" },
    fetchImpl,
  );
  assert.ok(res);
  assert.equal(res!.status, 200);
  assert.equal(res!.headers.get("x-protocol-origin"), "https://authichain.com");
  assert.equal(calls[0], "https://authichain.com/.well-known/jwks.json");
  const body = (await res!.json()) as { keys: Array<{ kid: string }> };
  assert.equal(body.keys[0]?.kid, "canonical");
});

test("GET /protocol/issuer.json/ trailing slash still proxies", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ ready: true, signing: true }), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "public, max-age=60" },
    });
  const res = await tryHandleEstateProtocolDiscovery(
    new Request("https://qron.space/protocol/issuer.json/", { method: "GET" }),
    undefined,
    fetchImpl,
  );
  assert.ok(res);
  assert.equal(res!.status, 200);
  assert.equal(res!.headers.get("cache-control"), "public, max-age=60");
  const body = (await res!.json()) as { signing: boolean };
  assert.equal(body.signing, true);
});

test("upstream failure is 502 and does not invent a JWKS", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new Error("network");
  };
  const res = await tryHandleEstateProtocolDiscovery(
    new Request("https://qron.space/protocol/jwks.json", { method: "GET" }),
    undefined,
    fetchImpl,
  );
  assert.ok(res);
  assert.equal(res!.status, 502);
  const body = (await res!.json()) as { error: string };
  assert.equal(body.error, "protocol_origin_unreachable");
  assert.equal("keys" in body, false);
});
