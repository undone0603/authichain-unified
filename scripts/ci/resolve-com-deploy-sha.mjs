#!/usr/bin/env node
/**
 * Decide whether expected_sha may be published for the protected
 * marketing Worker.
 *
 * Passes when expected_sha is current main HEAD, or an ancestor of main
 * whose intervening commits only touch the ancestor allowlist (ops
 * config and docs that are not bundled). Always returns the expected SHA
 * so callers check out and publish that commit, not HEAD.
 *
 * The allowlist is fail-closed: any file not on it — including every
 * Worker import, JSON/MD asset, wrangler input, and root tsconfig —
 * blocks the ancestor path. A denylist of "protected" trees cannot stay
 * complete as the bundle grows.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SHA = /^[a-f0-9]{40}$/;
const WORKER_DIR = "workers/authichain-com";
const CODE_EXT = new Set([".ts", ".tsx", ".mts", ".js", ".mjs", ".cjs"]);
const RESOLVE_EXT = [
  ".ts",
  ".tsx",
  ".mts",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
];

export const SAFE_ANCESTOR_PATHS = [".github/autonomy.json", "docs/"];

export function pathMatches(file, prefixes) {
  const name = String(file || "");
  return prefixes.some((p) =>
    p.endsWith("/")
      ? name === p.slice(0, -1) || name.startsWith(p)
      : name === p
  );
}

export function isSafeAncestorChange(file) {
  return pathMatches(file, SAFE_ANCESTOR_PATHS);
}

export function resolveDeploySha({
  expectedSha,
  mainSha,
  isAncestor,
  changedFiles,
}) {
  const expected = String(expectedSha || "").toLowerCase();
  const main = String(mainSha || "").toLowerCase();
  if (!SHA.test(expected) || !SHA.test(main)) {
    throw new Error(
      "deploy SHA check: expected_sha and main HEAD must be 40-character lowercase hex"
    );
  }
  if (expected === main) {
    return { sha: expected, path: "exact-head" };
  }
  if (!isAncestor) {
    throw new Error(
      `deploy SHA check: ${expected} is not current main HEAD (${main}) and is not an ancestor of main`
    );
  }
  const files = Array.isArray(changedFiles)
    ? changedFiles.map((f) => String(f || "").trim()).filter(Boolean)
    : [];
  if (files.length === 0) {
    throw new Error(
      "deploy SHA check: ancestor of main, but git diff was empty; fail closed"
    );
  }
  const blocked = files.filter((file) => !isSafeAncestorChange(file));
  if (blocked.length) {
    throw new Error(
      "deploy SHA check: ancestor of main, but paths outside the ancestor allowlist changed: " +
        blocked.join(", ")
    );
  }
  return { sha: expected, path: "ancestor" };
}

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

export function inspectGit({
  expectedSha,
  mainRef = "origin/main",
  cwd = process.cwd(),
} = {}) {
  const mainSha = git(["rev-parse", "--verify", mainRef], cwd).toLowerCase();
  let isAncestor = false;
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", expectedSha, mainRef], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    isAncestor = true;
  } catch (err) {
    if (err && err.status === 1) {
      isAncestor = false;
    } else {
      const detail = String(err?.stderr || err?.message || err).trim();
      throw new Error(
        "deploy SHA check: git merge-base --is-ancestor failed: " + detail
      );
    }
  }
  const changedFiles = git(
    ["diff", "--name-only", expectedSha, mainSha],
    cwd
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return { mainSha, isAncestor, changedFiles };
}

function posixRel(root, abs) {
  return path.relative(root, abs).split(path.sep).join("/");
}

function specifiers(source) {
  const out = [];
  const re =
    /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;
  let match;
  while ((match = re.exec(source))) out.push(match[1]);
  return out;
}

function resolveSpecifier(root, fromFile, spec) {
  if (!spec || spec.startsWith("node:") || spec.startsWith("cloudflare:")) {
    return null;
  }
  if (!spec.startsWith(".") && !spec.startsWith("/")) return null;
  const base = spec.startsWith("/")
    ? path.join(root, spec)
    : path.resolve(path.dirname(fromFile), spec);
  const candidates = [];
  const push = (candidate) => {
    const normalized = path.normalize(candidate);
    if (!candidates.includes(normalized)) candidates.push(normalized);
  };
  push(base);
  const ext = path.extname(base);
  if (ext === ".js" || ext === ".mjs") {
    push(base.replace(/\.mjs$/, ".mts").replace(/\.js$/, ".ts"));
    push(base.replace(/\.js$/, ".tsx"));
  } else if (!ext) {
    for (const extra of RESOLVE_EXT) push(base + extra);
    for (const extra of [".ts", ".mjs", ".js"]) {
      push(path.join(base, "index" + extra));
    }
  }
  const rootReal = path.resolve(root);
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    if (candidate.includes(`${path.sep}node_modules${path.sep}`)) continue;
    const rel = path.relative(rootReal, candidate);
    if (rel.startsWith("..") || path.isAbsolute(rel)) continue;
    return candidate;
  }
  return null;
}

function nearestTsconfig(root, startDir) {
  let dir = startDir;
  const rootReal = path.resolve(root);
  while (true) {
    const candidate = path.join(dir, "tsconfig.json");
    if (existsSync(candidate)) return posixRel(root, candidate);
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    if (path.relative(rootReal, parent).startsWith("..")) return null;
    dir = parent;
  }
}

function wranglerMain(root, workerDir) {
  const tomlRel = path.posix.join(workerDir, "wrangler.toml");
  const tomlPath = path.join(root, tomlRel);
  const toml = readFileSync(tomlPath, "utf8");
  const match = toml.match(/^main\s*=\s*"([^"]+)"/m);
  if (!match) {
    throw new Error("deploy SHA check: wrangler.toml has no main entry");
  }
  return path.join(root, workerDir, match[1]);
}

/**
 * Files wrangler actually ships for authichain-com: the relative-import
 * closure of wrangler `main`, plus wrangler.toml, the Worker package.json,
 * and the nearest tsconfig.json (root today; there is no Worker-local one).
 */
export function collectAuthichainComBundleInputs(root = process.cwd()) {
  const entry = wranglerMain(root, WORKER_DIR);
  const seen = new Set();
  const missing = [];
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift();
    const key = posixRel(root, file);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!CODE_EXT.has(path.extname(file))) continue;
    const source = readFileSync(file, "utf8");
    for (const spec of specifiers(source)) {
      const resolved = resolveSpecifier(root, file, spec);
      if (!resolved) {
        if (spec.startsWith(".") || spec.startsWith("/")) {
          missing.push({ from: key, spec });
        }
        continue;
      }
      const rel = posixRel(root, resolved);
      if (!seen.has(rel)) queue.push(resolved);
    }
  }
  if (missing.length) {
    throw new Error(
      "deploy SHA check: unresolved Worker import(s): " +
        missing.map((m) => `${m.from} -> ${m.spec}`).join(", ")
    );
  }
  seen.add(path.posix.join(WORKER_DIR, "wrangler.toml"));
  const pkg = path.posix.join(WORKER_DIR, "package.json");
  if (existsSync(path.join(root, pkg))) seen.add(pkg);
  const tsconfig = nearestTsconfig(root, path.join(root, WORKER_DIR));
  if (tsconfig) seen.add(tsconfig);
  return [...seen].sort();
}

export function logMatch(result, mainSha) {
  if (result.path === "exact-head") {
    console.log(
      `Deploy SHA check passed (exact HEAD): expected_sha ${result.sha} is current main HEAD.`
    );
    return;
  }
  console.log(
    `Deploy SHA check passed (ancestor): expected_sha ${result.sha} is an ancestor of main ${mainSha}; git diff has no paths outside the ancestor allowlist. Checking out and deploying expected_sha, not HEAD.`
  );
}

function writeOutput(result) {
  const payload = `sha=${result.sha}\npath=${result.path}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, payload);
  if (process.env.GITHUB_ENV) {
    appendFileSync(process.env.GITHUB_ENV, `SHA_MATCH_PATH=${result.path}\n`);
  }
}

function main(env = process.env, cwd = process.cwd()) {
  const expectedSha = env.TARGET_SHA || env.EXPECTED_SHA || "";
  const mainRef = env.MAIN_REF || "origin/main";
  const inspected = inspectGit({ expectedSha, mainRef, cwd });
  const result = resolveDeploySha({
    expectedSha,
    mainSha: inspected.mainSha,
    isAncestor: inspected.isAncestor,
    changedFiles: inspected.changedFiles,
  });
  logMatch(result, inspected.mainSha);
  writeOutput(result);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error("::error::" + err.message);
    process.exitCode = 1;
  }
}
