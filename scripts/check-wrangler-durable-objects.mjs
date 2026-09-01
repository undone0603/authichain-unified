#!/usr/bin/env node
// Fails if any wrangler.toml declares a Durable Object migration using
// `new_classes` instead of `new_sqlite_classes`. This account is on the
// Cloudflare Workers free plan, which only supports SQLite-backed Durable
// Object storage — a `new_classes` migration is rejected at deploy time
// with API error code 10097 ("In order to use Durable Objects with a free
// plan, you must create a namespace using a `new_sqlite_classes`
// migration."). See worker-app/wrangler.toml, services/worker-app/wrangler.toml
// and workers/authichain-automation/wrangler.toml for a real instance of
// this failure.
//
// This check catches the mistake at PR time instead of at deploy time.

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const files = execSync("git ls-files -- 'wrangler.toml' '**/wrangler.toml'", {
  cwd: process.cwd(),
  encoding: "utf8",
})
  .split("\n")
  .map(f => f.trim())
  .filter(Boolean)
  .filter(f => !f.includes("node_modules"));

let failed = false;
for (const file of files) {
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    // Match `new_classes = [...]` but not `new_sqlite_classes = [...]`.
    if (/^\s*new_classes\s*=/.test(line)) {
      failed = true;
      console.error(
        `${file}:${i + 1}  uses "new_classes" for a Durable Object migration — ${line.trim()}\n` +
          `  This Cloudflare account is on the free plan, which requires` +
          ` "new_sqlite_classes" instead. Replace new_classes with new_sqlite_classes.`
      );
    }
  });
}

if (failed) {
  console.error(
    "\ncheck-wrangler-durable-objects: one or more wrangler.toml files use a Durable Object migration incompatible with the free plan."
  );
  process.exit(1);
}
console.log(
  `check-wrangler-durable-objects: OK (${files.length} wrangler.toml files scanned, no incompatible Durable Object migrations found).`
);
