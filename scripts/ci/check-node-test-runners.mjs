#!/usr/bin/env node
// Used by .github/workflows/lint.yml. Fails when a tracked node:test file is
// not named by anything CI runs.
//
// vitest.config.ts excludes every node:test file, so each one needs another
// runner: its workspace package's `test` script (main.yml runs them through
// `pnpm test`), a command in a workflow, or a root script a workflow calls.
// Five files sat outside all three until #1490, and the Hardhat suite failed
// to load until its plugin was declared (#1493); nothing noticed either.
//
// Coverage is decided from the text of those commands. A file counts as
// covered when a command names it, a test-file glob in a command matches it,
// or a bare `--test` in a package script / `hardhat test` would pick it up.
// It is a static check: it proves a runner exists, not that it passes.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Same pattern vitest.config.ts uses to exclude these files.
const NODE_TEST_IMPORT = /(?:from\s+|require\(\s*)["']node:test["']/;
const TEST_FILE = /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/;

/** Pure. True when the source imports node:test. */
export function isNodeTestSource(text) {
  return NODE_TEST_IMPORT.test(text);
}

/**
 * Pure. Converts a repo-relative glob (`*`, `**`, `?`) to an anchored
 * RegExp. `*` and `?` stay within one path segment, as in the shell.
 */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*" && glob[i + 1] === "*") {
      // "**/" matches zero or more directories; a trailing "**" matches
      // everything below.
      if (glob[i + 2] === "/") {
        re += "(?:.*/)?";
        i += 2;
      } else {
        re += ".*";
        i += 1;
      }
    } else if (ch === "*") {
      re += "[^/]*";
    } else if (ch === "?") {
      re += "[^/]";
    } else {
      re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${re}$`);
}

const SCRIPT_REF = /\b(?:pnpm|npm|yarn)\s+(?:run\s+)?([\w:.-]+)/g;

/**
 * Pure. Inlines the package scripts that `command` calls (`pnpm run x`,
 * `pnpm x`, `npm run x`, `yarn x`), recursively, so a `test` script that
 * delegates to `test:unit` is read as both.
 */
export function expandScriptRefs(command, scripts, seen = new Set()) {
  let out = command;
  for (const [, name] of command.matchAll(SCRIPT_REF)) {
    if (seen.has(name) || typeof scripts[name] !== "string") continue;
    seen.add(name);
    out += ` && ${expandScriptRefs(scripts[name], scripts, seen)}`;
  }
  return out;
}

/**
 * Pure. Returns the repo-relative path patterns a shell command runs, with
 * relative paths resolved against `baseDir` (repo-relative, "" for the
 * root). Only test-file arguments count, globs included (`src/*.test.ts`),
 * so a `paths:` filter such as `workers/**` covers nothing.
 *
 * With `bareTest`, a `--test` segment with no file arguments covers
 * everything under `baseDir`. Leave it off for workflow text, where a
 * folded `run: >-` puts `node --test` and its files on separate lines.
 * A `hardhat test` segment with no file arguments covers `hardhatTestsDir`.
 */
export function commandPatterns(
  command,
  baseDir,
  { hardhatTestsDir, bareTest = false } = {}
) {
  const patterns = [];
  const resolve = rel => path.posix.normalize(path.posix.join(baseDir, rel));
  for (const segment of command.split(/&&|\|\||[;|\n]/)) {
    const tokens = segment
      .trim()
      .split(/\s+/)
      .map(t => t.replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    const fileArgs = tokens.filter(
      t => !t.startsWith("-") && TEST_FILE.test(t)
    );
    for (const t of fileArgs) patterns.push(resolve(t));
    if (fileArgs.length > 0) continue;
    if (bareTest && tokens.includes("--test")) {
      patterns.push(resolve("**"));
    } else if (hardhatTestsDir && /\bhardhat\s+test\b/.test(segment)) {
      patterns.push(path.posix.join(resolve(hardhatTestsDir), "**"));
    }
  }
  return patterns;
}

/** Pure. Drops YAML comment lines, which often describe commands in prose. */
export function stripYamlComments(text) {
  return text
    .split("\n")
    .filter(line => !/^\s*#/.test(line))
    .join("\n");
}

/** Pure. The files no pattern matches, in input order. */
export function uncoveredFiles(files, patterns) {
  const res = patterns.map(globToRegExp);
  return files.filter(f => !res.some(re => re.test(f)));
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

/** Tracked test files that import node:test, repo-relative. */
export function listNodeTestFiles(root) {
  const out = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return out
    .split("\0")
    .filter(f => TEST_FILE.test(f) && !f.split("/").includes("node_modules"))
    .filter(f => {
      try {
        return isNodeTestSource(readFileSync(path.join(root, f), "utf8"));
      } catch {
        return false;
      }
    });
}

/** Workspace package dirs from pnpm-workspace.yaml (`dir` and `dir/*`). */
function workspaceDirs(root) {
  const lines = readFileSync(
    path.join(root, "pnpm-workspace.yaml"),
    "utf8"
  ).split("\n");
  const start = lines.findIndex(l => /^packages:\s*$/.test(l));
  if (start === -1) return [];
  const dirs = [];
  for (const line of lines.slice(start + 1)) {
    const m = line.match(/^\s+-\s+["']?([^"'\s]+)["']?\s*$/);
    if (!m) break;
    const entry = m[1];
    if (entry.endsWith("/*")) {
      const parent = entry.slice(0, -2);
      let children = [];
      try {
        children = readdirSync(path.join(root, parent), {
          withFileTypes: true,
        });
      } catch {
        continue;
      }
      for (const c of children) {
        if (c.isDirectory()) dirs.push(`${parent}/${c.name}`);
      }
    } else {
      dirs.push(entry);
    }
  }
  return dirs.filter(d => existsSync(path.join(root, d, "package.json")));
}

function hardhatTestsDir(root) {
  const config = path.join(root, "hardhat.config.ts");
  if (!existsSync(config)) return undefined;
  const m = readFileSync(config, "utf8").match(/\btests:\s*["'`]([^"'`]+)/);
  return m ? m[1] : undefined;
}

function workflowTexts(root) {
  const texts = [];
  const dirs = [path.join(root, ".github", "workflows")];
  const actions = path.join(root, ".github", "actions");
  if (existsSync(actions)) {
    for (const a of readdirSync(actions)) dirs.push(path.join(actions, a));
  }
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (/\.ya?ml$/.test(f))
        texts.push(readFileSync(path.join(dir, f), "utf8"));
    }
  }
  return texts;
}

/** Every path pattern CI runs, repo-relative. */
export function ciPatterns(root) {
  const options = { hardhatTestsDir: hardhatTestsDir(root) };
  const rootScripts = readJson(path.join(root, "package.json")).scripts ?? {};
  const workflows = workflowTexts(root).map(stripYamlComments);
  const patterns = [];

  for (const text of workflows) {
    // Workflows run from the repo root; `working-directory:` is not read,
    // so a file named relative to another directory shows up as uncovered
    // (a false alarm, never a false pass).
    patterns.push(
      ...commandPatterns(expandScriptRefs(text, rootScripts), "", options)
    );
  }

  // main.yml's `pnpm test` is `turbo test --filter=!.`: every workspace
  // package's own `test` script.
  const runsWorkspaceTests = workflows.some(t =>
    /\bpnpm\s+(?:run\s+)?test(?![\w:-])/.test(t)
  );
  if (runsWorkspaceTests) {
    for (const dir of workspaceDirs(root)) {
      const scripts =
        readJson(path.join(root, dir, "package.json")).scripts ?? {};
      if (typeof scripts.test !== "string") continue;
      patterns.push(
        ...commandPatterns(expandScriptRefs(scripts.test, scripts), dir, {
          bareTest: true,
        })
      );
    }
  }
  return patterns;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd();
  const files = listNodeTestFiles(root);
  const missing = uncoveredFiles(files, ciPatterns(root));
  if (missing.length > 0) {
    console.error(
      "check-node-test-runners: these node:test files are excluded from Vitest " +
        "(vitest.config.ts) and nothing in CI runs them:"
    );
    for (const f of missing) console.error(`  - ${f}`);
    console.error(
      "Add each to its workspace package's `test` script, or to the " +
        '"Check node:test suites with no workspace runner" step in ' +
        ".github/workflows/lint.yml."
    );
    process.exit(1);
  }
  console.log(
    `check-node-test-runners: OK (${files.length} node:test files, each named by a CI runner).`
  );
}
