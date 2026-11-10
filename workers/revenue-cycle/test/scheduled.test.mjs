import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.ts";

async function runScheduled(statuses, failureAt = -1) {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const requests = [];
  const logs = [];
  let task;
  globalThis.fetch = async (url, init) => {
    requests.push({ url, method: init.method, redirect: init.redirect });
    if (requests.length === failureAt) throw new Error("network unavailable");
    return { status: statuses[requests.length - 1] ?? 200 };
  };
  console.log = line => logs.push(JSON.parse(line));
  try {
    await worker.scheduled({}, {}, { waitUntil(promise) { task = promise; } });
    await task;
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
  return { requests, logs };
}

test("healthy public rails only trigger wait_buyer, not purchase", async () => {
  const { requests, logs } = await runScheduled([200, 200, 204]);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].action, "wait_buyer");
  assert.equal(logs[0].rails_ok, true);
  assert.deepEqual(requests.map(x => x.method), ["GET", "GET", "HEAD"]);
  assert.ok(requests.every(x => x.redirect === "manual"));
  assert.ok(requests.every(x => x.url.startsWith("https://authichain.com/")));
});

test("redirect or wrong checkout status fails closed", async () => {
  const { logs } = await runScheduled([302, 200, 204]);
  assert.equal(logs[0].action, "fix_rails");
  assert.equal(logs[0].rails_ok, false);
  assert.match(logs[0].reason, /starter_checkout/);
});

test("network errors fail closed without suppressing other probes", async () => {
  const { logs, requests } = await runScheduled([200, 200, 204], 2);
  assert.equal(requests.length, 3);
  assert.equal(logs[0].action, "fix_rails");
  assert.match(logs[0].reason, /network unavailable/);
});

test("unpaid HTTP endpoint is informational only", async () => {
  const response = await worker.fetch();
  assert.equal(response.status, 200);
  assert.match(await response.text(), /scheduled only/);
});
