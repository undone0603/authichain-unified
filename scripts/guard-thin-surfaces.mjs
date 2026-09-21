#!/usr/bin/env node
/**
 * Brand workers must not grow a second JWKS issuer or private-key verify.
 * Shared verify lives in packages/verifier and src/lib/dpp-verify.ts.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const WORKERS = "workers";
const ALLOW_VERIFY = new Set([
  "authichain-scan-validate",
  "authichain-qron-provenance",
  "authichain-com",
]);

const FORBIDDEN = [
  /generateJWKS\s*\(/,
  /AUTHICHAIN_ATTESTATION_PRIVATE_KEY/,
  /new\s+SignJWT\s*\(/,
];

async function walk(dir, acc = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== "node_modules" && e.name !== "dist") {
      await walk(p, acc);
    } else if (/\.(ts|js)$/.test(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

export async function scanThinSurfaces(root = WORKERS) {
  const hits = [];
  let brands;
  try {
    brands = await readdir(root, { withFileTypes: true });
  } catch {
    return hits;
  }
  for (const b of brands) {
    if (!b.isDirectory()) continue;
    if (ALLOW_VERIFY.has(b.name)) continue;
    const files = await walk(path.join(root, b.name));
    for (const file of files) {
      const text = await readFile(file, "utf8");
      for (const re of FORBIDDEN) {
        if (re.test(text)) {
          hits.push({ worker: b.name, file, pattern: String(re) });
        }
      }
    }
  }
  return hits;
}

if (process.argv.includes("--run")) {
  const hits = await scanThinSurfaces();
  if (hits.length) {
    console.error("Brand worker reimplements verification. Use shared AuthiChain verify.");
    for (const h of hits) console.error(`  ${h.worker} ${h.file} ${h.pattern}`);
    process.exit(1);
  }
  console.log("thin-surfaces: no brand-local JWKS/issuer/private-key verify");
}
