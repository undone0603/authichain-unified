/**
 * Fulfil a $950 EU battery passport gap report order.
 *
 *   npx tsx scripts/battery-gap-report/generate.ts intake.json [--out dir]
 *
 * Reads the customer's intake (see intake.example.json), refuses it unless it
 * is complete and no more models are listed than were paid for, then writes
 * <out>/<slug>-gap-report.md and .html and prints their SHA-256. The owner
 * reviews the report and emails it; this script sends nothing.
 *
 * To issue it as an AgentZ-signed record once KEY_DIR holds the AgentZ key:
 *   KEY_DIR=... node scripts/agent-identity/sign-evidence.mjs --evidence <report>.md
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildGapReport,
  type GapReportIntake,
} from "../../workers/authichain-com/src/battery-gap-report.ts";

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
const outIdx = args.indexOf("--out");
const outDir = outIdx >= 0 ? args[outIdx + 1] : ".";
if (!file) {
  console.error(
    "usage: npx tsx scripts/battery-gap-report/generate.ts intake.json [--out dir]"
  );
  process.exit(2);
}

let report;
try {
  const intake = JSON.parse(readFileSync(file, "utf8")) as GapReportIntake;
  report = buildGapReport(intake);
  const slug =
    intake.company
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "customer";
  mkdirSync(outDir, { recursive: true });
  for (const [ext, body] of [
    ["md", report.markdown],
    ["html", report.html],
  ] as const) {
    const path = join(outDir, `${slug}-gap-report.${ext}`);
    writeFileSync(path, body);
    console.log(`${createHash("sha256").update(body).digest("hex")}  ${path}`);
  }
  for (const m of report.models)
    console.log(
      `  ${m.model}: ${m.counts.have_figure + m.counts.have_reported} have, ${m.counts.missing} missing; ${m.consistency}`
    );
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
