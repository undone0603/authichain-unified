#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const paths = [
  ".github",
  "server",
  "src",
  "libs",
  "packages/libs",
  "README.md",
  "next.config.js",
  "package.json",
  "wrangler.toml",
  "scripts/launch-preflight.mjs",
  "scripts/sync-secrets.sh",
  "scripts/verify-integrations.ts",
  "ops/scripts/sync-secrets.sh",
  "ops/scripts/verify-integrations.ts",
];

let output = "";
try {
  output = execFileSync(
    "git",
    [
      "grep",
      "-nEI",
      "vercel|vercel\\.app|VERCEL_",
      ...paths,
    ],
    { encoding: "utf8" },
  );
} catch (error) {
  if (typeof error === "object" && error && "status" in error && error.status === 1) {
    output = "";
  } else {
    throw error;
  }
}

const offenders = output.split("\n").filter(Boolean);

if (offenders.length > 0) {
  console.error("Active Vercel references are not allowed in Cloudflare-owned paths:");
  for (const offender of offenders) {
    console.error(`- ${offender}`);
  }
  process.exit(1);
}

console.log("No active Vercel references found in Cloudflare-owned paths.");
