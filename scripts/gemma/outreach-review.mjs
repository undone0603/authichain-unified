#!/usr/bin/env node
// scripts/gemma/outreach-review.mjs
//
// Weekdays, an hour before B2B outreach: Gemma reviews the email templates in
// scripts/b2b-cold-outreach.ts and suggests clearer, more personal versions in
// one `gemma` issue. It reads template source only (already public in this
// repo), never prospect data, and never touches the send path, caps or gates.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FOOTER,
  TRUTH_RULES,
  chat,
  clip,
  config,
  say,
  upsertIssue,
} from "./lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SOURCE = join(ROOT, "scripts", "b2b-cold-outreach.ts");
export const TEMPLATES = ["govchainEmail", "strainchaineEmail", "qronEmail"];
export const TITLE = "Gemma: outreach draft suggestions";

export const SYSTEM = [
  "You improve cold B2B email templates written in TypeScript template literals.",
  TRUTH_RULES,
  "Keep every ${...} placeholder exactly as written; they are filled per prospect.",
  "Do not add or remove the unsubscribe footer, physical address or links; other code adds them.",
  "Shorter and more specific beats longer. One clear ask per email.",
].join(" ");

/** Source text of each named template function, from `function name(` to the next top-level function. */
export function extractTemplates(src, names = TEMPLATES) {
  const out = {};
  for (const name of names) {
    const start = src.indexOf(`\nfunction ${name}(`);
    if (start === -1) continue;
    const next = src.indexOf("\nfunction ", start + 1);
    const nextDoc = src.indexOf("\n/**", start + 1);
    const ends = [next, nextDoc].filter(i => i > start);
    const end = ends.length ? Math.min(...ends) : src.length;
    out[name] = src.slice(start + 1, end).trim();
  }
  return out;
}

export function buildPrompt(name, source) {
  return [
    `Template function: ${name}`,
    "",
    "```ts",
    clip(source, 5000),
    "```",
    "",
    "Reply in markdown with exactly these parts:",
    "1. What would make a busy recipient ignore this email, quoting the current text.",
    "2. A rewritten subject line.",
    "3. A rewritten body as plain text, keeping every ${...} placeholder.",
  ].join("\n");
}

async function main() {
  const cfg = config();
  const templates = extractTemplates(readFileSync(SOURCE, "utf8"));
  const sections = [];
  for (const [name, source] of Object.entries(templates)) {
    try {
      const answer = await chat({
        url: cfg.url,
        model: cfg.model,
        system: SYSTEM,
        user: buildPrompt(name, source),
      });
      sections.push(`## \`${name}\`\n\n${answer}`);
    } catch (e) {
      sections.push(`## \`${name}\`\n\n_Skipped: ${e.message}_`);
    }
  }
  const body = `Updated ${new Date().toISOString().slice(0, 10)}. Suggestions for the templates in \`scripts/b2b-cold-outreach.ts\`; the send gates, caps and breaker are unchanged.\n\n${sections.join("\n\n")}${FOOTER}`;
  if (cfg.dry || !cfg.token || !cfg.repo) {
    say(body);
    return 0;
  }
  const r = await upsertIssue({
    repo: cfg.repo,
    token: cfg.token,
    title: TITLE,
    body,
  });
  say(`outreach review: issue #${r.number} ${r.action}`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(
    c => process.exit(c),
    e => {
      console.error(e);
      process.exit(1);
    }
  );
}
