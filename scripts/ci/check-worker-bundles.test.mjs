import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchesWatch, uncoveredInputs } from "./check-worker-bundles.mjs";

test("matchesWatch follows Workers Builds wildcard rules", () => {
  assert.equal(matchesWatch("anything/at/all.ts", "*"), true);
  assert.equal(
    matchesWatch("workers/govchain-us/src/index.ts", "workers/govchain-us/*"),
    true
  );
  assert.equal(
    matchesWatch("workers/govchain-usx/src/index.ts", "workers/govchain-us/*"),
    false
  );
  assert.equal(
    matchesWatch("workers/_shared/estate-mcp.test.ts", "*.test.ts"),
    true
  );
  assert.equal(matchesWatch("src/lib/plans.ts", "src/lib/plans.ts"), true);
  assert.equal(matchesWatch("src/lib/plans.tsx", "src/lib/plans.ts"), false);
});

test("uncoveredInputs reports bundle files outside the watch list", () => {
  const watch = [
    "workers/qron-space/*",
    "workers/_shared/*",
    "src/lib/plans.ts",
  ];
  assert.deepEqual(
    uncoveredInputs(
      [
        "workers/qron-space/src/index.ts",
        "src/lib/plans.ts",
        "src/lib/x402.ts",
      ],
      watch
    ),
    ["src/lib/x402.ts"]
  );
});

test("worker-bundle-hashes.json is well formed", () => {
  const cfg = JSON.parse(
    readFileSync(
      new URL("./worker-bundle-hashes.json", import.meta.url),
      "utf8"
    )
  );
  assert.match(
    cfg.wrangler,
    /^\d+\.\d+\.\d+$/,
    "wrangler must be an exact version"
  );
  for (const [name, w] of Object.entries(cfg.workers)) {
    assert.match(w.sha256, /^[0-9a-f]{64}$/, `${name} sha256`);
    assert.ok(Number.isInteger(w.bytes) && w.bytes > 0, `${name} bytes`);
    assert.ok(
      w.watch.includes(`workers/${name}/*`),
      `${name} watch must include its own dir`
    );
  }
});
