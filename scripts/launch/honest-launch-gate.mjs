#!/usr/bin/env node
// Honest launch gate. Read-only. Exit 0 green, 1 red.
// Live probes skipped when HONEST_GATE_LIVE=0.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname;
const SURFACES = [
  "src/lib/plans.ts",
  "workers/dpp-fulfillment/src/index.ts",
  "scripts/dpp-outreach/email-template.txt",
];
const BANNED = [
  /saves lives/i,
  /Made in USA certified/i,
  /FTC[- ]compliant Made/i,
  /EU DPP Readiness Audit/i,
  /one-time EU DPP readiness audit/i,
];

function scan(text, file) {
  const hits = [];
  for (const re of BANNED) {
    const match = text.match(re);
    if (!match) continue;
    hits.push({ file, phrase: match[0] });
  }
  return hits;
}

async function probe(url, expect) {
  const started = Date.now();
  try {
    const res = await fetch(url, { redirect: "follow" });
    const body = await res.text();
    const ok =
      res.status === expect.status &&
      (!expect.includes || body.toLowerCase().includes(expect.includes.toLowerCase())) &&
      (!expect.excludes || !body.toLowerCase().includes(expect.excludes.toLowerCase()));
    return { url, status: res.status, ok, ms: Date.now() - started };
  } catch (err) {
    return { url, ok: false, error: String(err), ms: Date.now() - started };
  }
}

const findings = [];
for (const surface of SURFACES) {
  const file = join(ROOT, surface);
  findings.push(...scan(await readFile(file, "utf8"), surface));
}

const live = process.env.HONEST_GATE_LIVE !== "0";
const probes = live
  ? await Promise.all([
      probe("https://authichain.com/.well-known/jwks.json", {
        status: 200,
        includes: "lue84wJNZjRSQ2IcOamnl9JNlOtuaD0Go4amAL6ccIE",
      }),
      probe("https://authichain.com/checkout/starter", {
        status: 200,
        includes: "$29",
      }),
      probe("https://authichain.com/checkout/dpp_readiness", {
        status: 200,
        excludes: "EU DPP Readiness Audit",
      }),
      probe("https://authichain.com/verify", {
        status: 200,
        includes: "in development",
      }),
    ])
  : [];

const report = {
  gate: "honest-launch",
  at: new Date().toISOString(),
  claim_hits: findings.length,
  findings,
  probes,
  ok: findings.length === 0 && probes.every((item) => item.ok),
};
console.log(JSON.stringify(report));
if (!report.ok) process.exit(1);
