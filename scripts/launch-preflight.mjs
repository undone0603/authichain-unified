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
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PUBLISHABLE_KEY",
  "RESEND_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

/** Satisfied if any of the listed names is set (next.config.js bridges unprefixed → NEXT_PUBLIC_*). */
const requiredEnvAnyOf = [
  ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"],
];

/** ADR-001 primary auth — warn until Clerk is wired into runtime routes. */
const recommendedEnv = [
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
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

function hasAny(names) {
  return names.some((name) => Boolean(process.env[name]));
}

loadDotEnv();

for (const file of requiredFiles) {
  if (!exists(file)) failures.push(`missing required file: ${file}`);
}

for (const name of requiredEnv) {
  if (!process.env[name]) failures.push(`missing production environment variable: ${name}`);
}

for (const names of requiredEnvAnyOf) {
  if (!hasAny(names)) {
    failures.push(`missing production environment variable: ${names.join(" or ")}`);
  }
}

for (const name of recommendedEnv) {
  if (!process.env[name]) {
    warnings.push(
      `missing recommended auth variable: ${name} (ADR-001 Clerk; not yet required by runtime)`,
    );
  }
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
