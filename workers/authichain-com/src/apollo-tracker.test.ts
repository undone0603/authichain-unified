// AE-20261002-CFD-09: no Apollo visitor tracker on any authichain.com page.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./index.ts";

type Env = Parameters<typeof worker.fetch>[1];
const ENV = {
  APP_WORKER: {
    fetch: async () =>
      new Response(
        "<!doctype html><html><head></head><body>app</body></html>",
        {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }
      ),
  },
} as unknown as Env;

const PATHS = [
  "/",
  "/contact",
  "/battery-passport",
  "/battery-passport/sample-audit",
  "/pricing",
  "/dpp",
  "/dapp", // proxied to the app worker; the wrapper must not add Apollo there either
];

for (const path of PATHS) {
  test(`${path}: no Apollo script and no Apollo CSP allowance`, async () => {
    const res = await worker.fetch(
      new Request(`https://authichain.com${path}`),
      ENV
    );
    const html = await res.text();
    assert.ok(!html.includes("assets.apollo.io"), path);
    assert.ok(!html.includes("6ab2b3b358b37e000c06b0fa"), path);
    assert.ok(!html.includes("trackingFunctions"), path);
    assert.ok(
      !(res.headers.get("content-security-policy") ?? "").includes("apollo"),
      path
    );
  });
}
