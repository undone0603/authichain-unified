import { test } from "node:test";
import assert from "node:assert/strict";
import { tryHandleEstateQronResolve } from "./estate-qron-resolve.ts";

const OBJECT_PATH = "/qron/r/qron%3Aurl%3A71cead6b";

test("non-resolve paths are ignored", async () => {
  const res = await tryHandleEstateQronResolve(
    new Request("https://qron.space/api/verify", { method: "GET" }),
  );
  assert.equal(res, null);
});

test("POST /qron/r is method_not_allowed", async () => {
  const res = await tryHandleEstateQronResolve(
    new Request(`https://strainchain.io${OBJECT_PATH}`, { method: "POST" }),
  );
  assert.ok(res);
  assert.equal(res!.status, 405);
  const body = (await res!.json()) as { error: string; decision_contract: string };
  assert.equal(body.error, "method_not_allowed");
  assert.equal(body.decision_contract, "AuthiChain Verification Decision v1");
});

test("GET /qron/r proxies the canonical resolver and keeps the encoded id", async () => {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push(String(input));
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("accept"), "application/json");
    return new Response(
      JSON.stringify({
        valid: true,
        decision: "verified",
        decision_contract: "AuthiChain Verification Decision v1",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  const res = await tryHandleEstateQronResolve(
    new Request(`https://qron.space${OBJECT_PATH}?x=1`, {
      method: "GET",
      headers: { accept: "application/json" },
    }),
    { AUTHICHAIN_PROTOCOL_ORIGIN: "https://authichain.com" },
    fetchImpl,
  );
  assert.ok(res);
  assert.equal(res!.status, 200);
  assert.equal(res!.headers.get("x-qron-resolve-origin"), "https://authichain.com");
  assert.equal(calls[0], `https://authichain.com${OBJECT_PATH}?x=1`);
  const body = (await res!.json()) as { decision: string };
  assert.equal(body.decision, "verified");
});

test("HEAD /qron/r returns the upstream status and no body", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response("secret-body", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  const res = await tryHandleEstateQronResolve(
    new Request(`https://govchain.us${OBJECT_PATH}`, { method: "HEAD" }),
    undefined,
    fetchImpl,
  );
  assert.ok(res);
  assert.equal(res!.status, 200);
  assert.equal(await res!.text(), "");
});

test("an unreachable canonical resolver is Decision v1 indeterminate", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new Error("down");
  };
  const res = await tryHandleEstateQronResolve(
    new Request(`https://govchain.us${OBJECT_PATH}`, { method: "GET" }),
    undefined,
    fetchImpl,
  );
  assert.ok(res);
  assert.equal(res!.status, 502);
  const body = (await res!.json()) as {
    valid: boolean;
    decision: string;
    error: string;
  };
  assert.equal(body.valid, false);
  assert.equal(body.decision, "indeterminate");
  assert.equal(body.error, "qron_resolve_unreachable");
});
