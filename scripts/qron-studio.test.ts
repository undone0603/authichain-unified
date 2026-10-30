// @vitest-environment node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const cli = fileURLToPath(new URL("./qron-studio.ts", import.meta.url));
const payload = "https://authichain.com/qron/r/qron-studio-demo";
const directories: string[] = [];

afterEach(() => {
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function outputDirectory(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "qron-svg-gate-"));
  directories.push(dir);
  return dir;
}

function runCli(out: string, args: string[] = []) {
  const result = spawnSync(
    process.execPath,
    ["--import", import.meta.resolve("tsx"), cli, "--payload", payload, "--count", "1", "--seed", "1", "--quiet", "--out", out, ...args],
    {
      encoding: "utf8",
      timeout: 60_000,
      // Exercise the real launch-failure path without needing a browser download.
      env: { ...process.env, QRON_CHROMIUM_PATH: path.join(out, "missing-chromium") },
    }
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stdout + result.stderr).toBe(0);
  return {
    report: JSON.parse(readFileSync(path.join(out, "report.json"), "utf8")),
    provenance: JSON.parse(readFileSync(path.join(out, "provenance.json"), "utf8")),
  };
}

function expectPngOnly(out: string, result: ReturnType<typeof runCli>) {
  const { report, provenance } = result;
  expect(report.summary.accepted).toBe(1);
  expect(report.summary.svgVerified).toBe(0);
  expect(report.summary.svgWithheld).toBe(1);
  expect(report.designs[0].validation.pass).toBe(true);
  expect(report.designs[0].svgCheck.status).toBe("skipped");
  expect(report.designs[0].files.svg).toBeNull();
  expect(report.designs[0].hashes.svg).toBeNull();
  expect(existsSync(path.join(out, report.designs[0].files.png))).toBe(true);
  expect(readdirSync(path.join(out, "designs")).filter((name) => name.endsWith(".svg"))).toEqual([]);
  expect(provenance.anchored).toBe(false);
  expect(provenance.records[0].svg_sha256).toBeNull();
  expect(provenance.records[0].validation.svg).toBe("skipped");
}

describe("qron-studio SVG export release gate", () => {
  it("withholds disabled SVGs and removes a stale SVG on a repeat run", () => {
    const out = outputDirectory();
    const first = runCli(out, ["--no-verify-svg"]);
    expectPngOnly(out, first);
    expect(first.report.summary.svgCheck).toContain("disabled (--no-verify-svg)");

    const stale = path.join(out, first.report.designs[0].files.png.replace(/\.png$/, ".svg"));
    writeFileSync(stale, "<svg>unverified previous export</svg>");
    expect(existsSync(stale)).toBe(true);
    expectPngOnly(out, runCli(out, ["--no-verify-svg"]));
    expect(existsSync(stale)).toBe(false);
  }, 60_000);

  it("withholds SVGs when Chromium cannot launch", () => {
    const out = outputDirectory();
    const result = runCli(out);
    expectPngOnly(out, result);
    expect(result.report.summary.svgCheck).toContain("chromium launch failed:");
  }, 60_000);
});
