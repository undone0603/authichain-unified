import { test } from "node:test";
import assert from "node:assert/strict";
import { tryHandleEstateCanonicalVerify } from "./estate-canonical-verify.ts";

test("non-verify paths are ignored", async () => {
  const res = await tryHandleEstateCanonicalVerify(
    new Request("https://qron.space/api/x402", { method: "POST" }),
  );
  assert.equal(res, null);
});

test("GET /api/verify is method_not_allowed", async () => {
  const res = await tryHandleEstateCanonicalVerify(
    new Request("https://qron.space/api/verify", { method: "GET" }),
  );
  assert.ok(res);
  assert.equal(res!.status, 405);
  const body = (await res!.json()) as { decision: string; error: string };
  assert.equal(body.decision, "indeterminate");
  assert.equal(body.error, "method_not_allowed");
});

test("POST /api/verify without jws fails closed with decision_contract", async () => {
  const res = await tryHandleEstateCanonicalVerify(
    new Request("https://qron.space/api/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
  );
  assert.ok(res);
  assert.equal(res!.status, 400);
  assert.equal(res!.headers.get("cache-control"), "no-store");
  const body = (await res!.json()) as Record<string, unknown>;
  assert.equal(body.valid, false);
  assert.equal(body.decision, "indeterminate");
  assert.equal(body.decision_contract, "AuthiChain Verification Decision v1");
  assert.equal(body.error, "jws is required");
});

test("blocked canonical responses stay non-success on the sister apex", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        valid: false,
        decision: "blocked",
        decision_contract: "AuthiChain Verification Decision v1",
        reasons: ["decision_blocked"],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;
  try {
    const res = await tryHandleEstateCanonicalVerify(
      new Request("https://qron.space/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jws: "signed-attestation" }),
      }),
      { AUTHICHAIN_CANONICAL_VERIFY_URL: "https://canonical.example/verify" },
    );
    assert.ok(res);
    assert.equal(res!.status, 409);
    const body = (await res!.json()) as {
      valid: boolean;
      decision: string;
      reasons: string[];
    };
    assert.equal(body.valid, false);
    assert.equal(body.decision, "blocked");
    assert.ok(body.reasons.includes("canonical_response_not_positive"));
  } finally {
    globalThis.fetch = real;
  }
});

test("verified + valid canonical responses pass through as 200", async () => {
  const real = globalThis.fetch;
  const canonical = {
    valid: true,
    decision: "verified",
    decision_contract: "AuthiChain Verification Decision v1",
    reasons: [],
  };
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(canonical), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  try {
    const res = await tryHandleEstateCanonicalVerify(
      new Request("https://qron.space/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jws: "signed-attestation" }),
      }),
    );
    assert.ok(res);
    assert.equal(res!.status, 200);
    assert.deepEqual(await res!.json(), canonical);
  } finally {
    globalThis.fetch = real;
  }
});
