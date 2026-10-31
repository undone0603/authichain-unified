#!/usr/bin/env node
/**
 * Compile workers/* without publishing.
 *
 * pull_request / push: only the workers/* directories in the diff. A change
 * under workers/_shared also builds the sisters that import it. A diff that
 * only touches this script or its workflow builds the gs1-resolver canary,
 * so the script is proven when it lands.
 * workflow_dispatch: one directory, or every worker that has a wrangler
 * config except Containers (authichain-agentz) and the archived dirs.
 *
 * The wrangler invocation stays in this file. check-deploy-invariants treats
 * that text inside a workflow as a push-to-main deploy.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expandSharedWorkerDirs } from "./select-autodeploy-workers.mjs";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

export const CONFIGS = ["wrangler.toml", "wrangler.json", "wrangler.jsonc"];

/** Left out of a full dispatch. Still compiled when a diff or a dispatch names them. */
export const SKIP_BY_DEFAULT = new Set([
  "authichain-agentz",
  "passport-demo",
  "qron-portfolio",
  "first-dollar-desk",
]);

export const CANARY_WORKER = "gs1-resolver";

export const TOOLING_PATHS = new Set([
  "scripts/ci/build-workers.mjs",
  "scripts/ci/build-workers.test.mjs",
  ".github/workflows/build-workers.yml",
]);

/** Pure. Split a `git diff --name-only` list into worker dirs and tooling. */
export function splitDiff(paths) {
  const workerDirs = new Set();
  let toolingChanged = false;
  for (const file of paths) {
    if (TOOLING_PATHS.has(file)) toolingChanged = true;
    if (!file.startsWith("workers/")) continue;
    const seg = file.split("/")[1];
    if (seg) workerDirs.add(seg);
  }
  return { workerDirs: [...workerDirs], toolingChanged };
}

/**
 * Pure. `requested === null` builds every config except SKIP_BY_DEFAULT.
 * A list builds those names when they have a wrangler config. `_shared`
 * expands to the sisters that import it. An empty list plus a tooling
 * change builds the canary.
 */
export function workersToBuild(
  buildable,
  requested,
  { toolingChanged = false } = {}
) {
  const have = new Set(buildable);
  if (requested == null) {
    return [...buildable].filter(name => !SKIP_BY_DEFAULT.has(name)).sort();
  }
  const expanded = expandSharedWorkerDirs(requested).filter(
    name => name !== "_shared"
  );
  const picked = [...new Set(expanded)].filter(name => have.has(name));
  if (picked.length === 0 && toolingChanged && have.has(CANARY_WORKER)) {
    return [CANARY_WORKER];
  }
  return picked.sort();
}

/** Pure. Null means "do not diff; the caller asked for the full set". */
export function diffRange(event, { before } = {}) {
  if (event === "workflow_dispatch") return null;
  if (event === "pull_request") return ["FETCH_HEAD", "HEAD"];
  if (before && !/^0+$/.test(before)) return [before, "HEAD"];
  return ["HEAD~1", "HEAD"];
}

/**
 * Pure. `paths` is the diff. `dispatchWorker` is the workflow_dispatch input.
 */
export function plan({ event, dispatchWorker, paths, buildable }) {
  if (event === "workflow_dispatch") {
    const one = dispatchWorker?.trim();
    return workersToBuild(buildable, one ? [one] : null);
  }
  const { workerDirs, toolingChanged } = splitDiff(paths ?? []);
  return workersToBuild(buildable, workerDirs, { toolingChanged });
}

export function listBuildable(root = ROOT) {
  const workers = path.join(root, "workers");
  return readdirSync(workers, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => CONFIGS.some(file => existsSync(path.join(workers, name, file))))
    .sort();
}

function changedPaths(range) {
  const out = execFileSync(
    "git",
    [
      "diff",
      "--name-only",
      range[0],
      range[1],
      "--",
      "workers/",
      ...TOOLING_PATHS,
    ],
    { cwd: ROOT, encoding: "utf8" }
  );
  return out.split("\n").filter(Boolean);
}

function compileWorker(name) {
  const cwd = path.join(ROOT, "workers", name);
  const config = CONFIGS.find(file => existsSync(path.join(cwd, file)));
  console.log(`[build] ${name} (${config})`);
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "wrangler",
      "deploy",
      "--dry-run",
      "--outdir",
      "dist",
      "--minify",
      "--config",
      config,
    ],
    { cwd, stdio: "inherit", env: process.env }
  );
  return result.status === 0;
}

function main() {
  const event = process.env.GITHUB_EVENT_NAME ?? "";
  const buildable = listBuildable();
  const range = diffRange(event, { before: process.env.DIFF_BEFORE ?? "" });
  const paths = range ? changedPaths(range) : [];
  const names = plan({
    event,
    dispatchWorker: process.env.DISPATCH_WORKER ?? "",
    paths,
    buildable,
  });

  if (
    event === "workflow_dispatch" &&
    (process.env.DISPATCH_WORKER ?? "").trim() &&
    names.length === 0
  ) {
    console.error(
      `::error::Unknown worker '${process.env.DISPATCH_WORKER}'. It has no wrangler config under workers/.`
    );
    process.exit(1);
  }
  if (names.length === 0) {
    console.log("[build] no workers to compile");
    return;
  }
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
    console.error(
      "::error::CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID is empty. Refusing a hollow pass."
    );
    process.exit(1);
  }

  const failed = [];
  for (const name of names) {
    if (!compileWorker(name)) failed.push(name);
  }
  if (failed.length) {
    console.error(`[build] failed: ${failed.join(", ")}`);
    process.exit(1);
  }
  console.log(`[build] compiled ${names.length}: ${names.join(", ")}`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
