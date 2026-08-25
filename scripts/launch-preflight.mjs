#!/usr/bin/env node
/**
 * Production launch preflight. Read-only: validates local files and env names.
 * It never prints secret values and never changes external systems.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const warnings = [];
const requiredFiles = [
  "package.json",
  "next.config.js",
  "src/app/page.tsx",
  "server/routers.ts",
  "drizzle/schema.ts",
  "vercel.json",
];
const requiredEnv = [
  "DATABASE_URL",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PUBLISHABLE_KEY",
  "RESEND_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function loadDotEnv() {
  for (const filename of [".env.local", ".env", ".env.production"]) {
    const filenamePath = path.join(root, filename);
    if (!fs.existsSync(filenamePath)) continue;
    const text = fs.readFileSync(filenamePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
      }
    }
  }
}

loadDotEnv();

for (const file of requiredFiles) {
  if (!exists(file)) failures.push(`missing required file: ${file}`);
}

for (const name of requiredEnv) {
  if (!process.env[name]) failures.push(`missing production environment variable: ${name}`);
}

if (!exists(".next")) {
  warnings.push(".next is missing; run pnpm next:build before deployment.");
}
if (!exists("dist")) {
  warnings.push("dist is missing; this is expected for Vercel, but required for the standalone SPA path.");
}
if (process.env.REQUIRE_OUTREACH_APPROVAL === "false") {
  failures.push("REQUIRE_OUTREACH_APPROVAL=false is unsafe for first production launch.");
}

console.log("AuthiChain launch preflight");
console.log(`Root: ${root}`);
for (const warning of warnings) console.log(`WARN  ${warning}`);
for (const failure of failures) console.log(`FAIL  ${failure}`);

if (failures.length) {
  console.error(`\nPreflight failed with ${failures.length} blocker(s).`);
  process.exit(1);
}

console.log("\nPreflight passed. External credential rotation and deployment verification are still required.");
