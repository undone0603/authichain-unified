/**
 * Production route lock. The landing worker already returns freeCalls on
 * GET /api/x402/health. The edge wildcard authichain.com/api/x402* is more
 * specific than authichain.com/*, so without an exact route that URL is the
 * edge router, which has no free tier. Catalog stays on the edge.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const toml = readFileSync(
  join(import.meta.dirname, "..", "wrangler.toml"),
  "utf8"
);

function patterns(text: string): string[] {
  return [...text.matchAll(/^pattern = "([^"]+)"/gm)].map((m) => m[1]!);
}

test("apex /api/x402/health is an exact landing route", () => {
  const list = patterns(toml);
  const required = [
    "authichain.com/api/x402/health",
    "authichain.com/api/x402/health/",
    "authichain.govchain.us/api/x402/health",
    "authichain.govchain.us/api/x402/health/",
  ];
  for (const pattern of required) {
    assert.ok(list.includes(pattern), pattern);
  }
  const health = list.indexOf("authichain.com/api/x402/health");
  const wildcard = list.indexOf("authichain.com/*");
  assert.ok(health >= 0 && wildcard > health);
  assert.equal(list.includes("authichain.com/api/x402/catalog"), false);
  assert.equal(list.includes("authichain.com/api/checkout"), false);
});
