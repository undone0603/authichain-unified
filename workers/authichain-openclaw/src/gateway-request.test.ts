import { test } from "node:test";
import assert from "node:assert/strict";
import { gatewayHookRequest } from "./gateway-request.ts";

const access = {
  "CF-Access-Client-Id": "client",
  "CF-Access-Client-Secret": "secret",
};

test("wake requests carry the hook token and Access headers", () => {
  const req = gatewayHookRequest("hook-token", access, { text: "hello" });
  assert.equal(req.path, "/hooks/wake");
  assert.deepEqual(req.payload, { text: "hello", mode: "now" });
  assert.equal(req.headers.Authorization, "Bearer hook-token");
  assert.equal(req.headers["x-openclaw-token"], "hook-token");
  assert.equal(req.headers["CF-Access-Client-Id"], "client");
  assert.equal(req.headers["CF-Access-Client-Secret"], "secret");
});

test("omits Access headers when none are configured", () => {
  const req = gatewayHookRequest("hook-token", {}, { text: "hello" });
  assert.equal(req.headers["CF-Access-Client-Id"], undefined);
  assert.equal(req.headers["CF-Access-Client-Secret"], undefined);
});

test("agent requests dedupe with a header instead of a sessionKey", () => {
  const req = gatewayHookRequest("hook-token", access, {
    text: "hello",
    channel: "telegram",
    to: "me",
    idempotency_key: "abc",
  });
  assert.equal(req.path, "/hooks/agent");
  assert.equal(req.payload.sessionKey, undefined);
  assert.equal(req.headers["Idempotency-Key"], "agentz:abc");
  assert.equal(req.payload.message, "hello");
  assert.equal(req.payload.deliver, true);
  assert.equal(req.payload.channel, "telegram");
  assert.equal(req.payload.to, "me");
});

test("keeps next-heartbeat mode and defaults anything else to now", () => {
  const next = gatewayHookRequest("t", {}, {
    text: "x",
    mode: "next-heartbeat",
  });
  assert.equal(next.payload.mode, "next-heartbeat");
  const other = gatewayHookRequest("t", {}, { text: "x", mode: "later" });
  assert.equal(other.payload.mode, "now");
});
