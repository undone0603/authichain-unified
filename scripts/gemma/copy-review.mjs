#!/usr/bin/env node
// scripts/gemma/copy-review.mjs
//
// Daily: Gemma reads the live pricing and landing pages and writes concrete
// copy suggestions for the paid offers into one `gemma` issue. It changes no
// page and no price; a person applies what they like in a reviewed PR.

import {
  FOOTER,
  TRUTH_RULES,
  chat,
  clip,
  config,
  htmlToText,
  say,
  upsertIssue,
} from "./lib.mjs";

export const TITLE = "Gemma: conversion copy suggestions";

export const PAGES = [
  { name: "authichain.com home", url: "https://authichain.com/" },
  { name: "authichain.com pricing", url: "https://authichain.com/pricing" },
  { name: "qron.space pricing", url: "https://qron.space/pricing" },
  { name: "strainchain.io pricing", url: "https://strainchain.io/pricing" },
];

export const SYSTEM = [
  "You are a conversion copywriter reviewing a small B2B product's live pages.",
  "The paid offers are: QRON Starter Pack $29, Creator Pack $99, EU DPP Readiness $299, StrainChain Passport $49, Farm Plan $149/month.",
  TRUTH_RULES,
  "Be specific and brief. Quote the exact current text you would change.",
].join(" ");

export function buildPrompt(page, text) {
  return [
    `Page: ${page.name} (${page.url})`,
    "",
    "Visible text:",
    clip(text, 6000),
    "",
    "Reply in markdown with exactly these parts:",
    "1. The three biggest things stopping a visitor from buying, each quoting the current text.",
    "2. A rewritten headline and a rewritten primary call to action.",
    "3. One A/B test worth running, with the metric that would decide it.",
  ].join("\n");
}

export function renderIssue(sections, date = new Date()) {
  const head = `Updated ${date.toISOString().slice(0, 10)}. Each section is one live page; apply only what is true, in a reviewed PR.`;
  return `${head}\n\n${sections.join("\n\n")}${FOOTER}`;
}

async function main() {
  const cfg = config();
  const sections = [];
  for (const page of PAGES) {
    let section;
    try {
      const res = await fetch(page.url, {
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = htmlToText(await res.text());
      const answer = await chat({
        url: cfg.url,
        model: cfg.model,
        system: SYSTEM,
        user: buildPrompt(page, text),
      });
      section = `## ${page.name}\n\n${answer}`;
    } catch (e) {
      section = `## ${page.name}\n\n_Skipped: ${e.message}_`;
    }
    sections.push(section);
  }
  const body = renderIssue(sections);
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
  say(`copy review: issue #${r.number} ${r.action}`);
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
