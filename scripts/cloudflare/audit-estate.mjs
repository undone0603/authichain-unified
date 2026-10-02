#!/usr/bin/env node
/**
 * Cloudflare estate integrity audit.
 * Read-only: inventories repo Wrangler declarations and checks the ledger.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = process.cwd();
const ledger = JSON.parse(readFileSync(resolve(root, "config/cloudflare-estate.json"), "utf8"));
const workersRoot = resolve(root, "workers");
const candidates = [];

function walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === "wrangler.toml") candidates.push(full);
  }
}
walk(workersRoot);

const names = new Map();
for (const file of candidates) {
  const text = readFileSync(file, "utf8");
  const match = text.match(/^name\s*=\s*"([^"]+)"/m);
  if (!match) continue;
  const name = match[1];
  const list = names.get(name) ?? [];
  list.push(relative(root, file));
  names.set(name, list);
}

let failed = false;
for (const [name, paths] of [...names.entries()].sort()) {
  if (paths.length > 1) {
    console.error("::error::Duplicate Worker identity \"" + name + "\": " + paths.join(", "));
    failed = true;
  }
}

for (const [name, entry] of Object.entries(ledger.workers)) {
  // A reconcile target must gain its config; an active entry must keep it.
  if ((entry.status === "reconcile" || entry.status === "active") && entry.canonical_path) {
    const path = resolve(root, entry.canonical_path, "wrangler.toml");
    if (!existsSync(path)) {
      console.error("::error::Reconciliation target missing Wrangler config: " + entry.canonical_path);
      failed = true;
    }
  }
}

console.log("Cloudflare estate audit: " + names.size + " unique repo Worker identities across " + candidates.length + " Wrangler declarations.");
console.log("Ledger entries: " + Object.keys(ledger.workers).length + "; external/transitional identities remain explicitly tracked.");
process.exit(failed ? 1 : 0);
