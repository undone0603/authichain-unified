#!/usr/bin/env node
/**
 * Fail if a GitHub workflow (or this guard's scan set) reintroduces a Vercel
 * deploy step. Existing helper scripts under scripts/ that mention `vercel`
 * are excluded from CI authority — they are not a deploy path.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const WORKFLOW_DIR = ".github/workflows";

export const FORBIDDEN = [
  /\bvercel\s+deploy\b/i,
  /\bvercel\s+--prod\b/,
  /amondnet\/vercel-action/,
  /vercel\/action@/,
  /uses:\s*amondnet\/vercel-action/i,
];

export function scanWorkflowText(name, text) {
  const hits = [];
  const actionable = text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return false;
      return /^\s*(run:|uses:)/.test(line) || trimmed.startsWith("run:") || trimmed.startsWith("uses:");
    })
    .join("\n");
  for (const re of FORBIDDEN) {
    if (re.test(actionable)) hits.push({ file: name, pattern: String(re) });
  }
  return hits;
}

export async function scanWorkflowDir(dir = WORKFLOW_DIR) {
  const names = (await readdir(dir)).filter((n) => /\.ya?ml$/.test(n));
  const hits = [];
  for (const name of names) {
    const text = await readFile(path.join(dir, name), "utf8");
    hits.push(...scanWorkflowText(name, text));
  }
  return hits;
}

if (process.argv.includes("--run")) {
  const hits = await scanWorkflowDir();
  if (hits.length > 0) {
    console.error("Vercel deploy steps are excluded. Cloudflare is the deploy authority.");
    for (const h of hits) console.error(`  ${h.file}: ${h.pattern}`);
    process.exit(1);
  }
  console.log("vercel-deploy-guard: no Vercel deploy steps in .github/workflows");
}
