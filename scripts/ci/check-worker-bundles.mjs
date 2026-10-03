#!/usr/bin/env node
// Bundle drift check for the Workers that Cloudflare Workers Builds deploys on
// every push to main (govchain-us, qron-space). PM-197.
//
// For each worker in worker-bundle-hashes.json it builds index.js the way
// Workers Builds does (`wrangler deploy --dry-run` in workers/<name>, pinned
// wrangler, no credentials) and fails if:
//   - the sha256 differs from the recorded one (a bundle change nobody
//     acknowledged in worker-bundle-hashes.json), or
//   - the bundle pulls in a file that none of the worker's `watch` patterns
//     cover (edits to it would not trigger a Workers Build), or
//   - workers/<name>/package.json pins a different wrangler than recorded.
// With --live it also GETs the version serving 100% of traffic and fails if
// its index.js differs from this build (e.g. an older build finishing last).
// Read-only: the only Cloudflare calls are GETs, and the token is never printed.
//
//   node scripts/ci/check-worker-bundles.mjs [--live] [--no-expected] [worker...]
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const sha256 = buf => createHash("sha256").update(buf).digest("hex");

// Workers Builds watch-path semantics: `*` alone matches anything; otherwise a
// single `*` is allowed at the start or the end of the rule.
export function matchesWatch(path, pattern) {
  if (pattern === "*") return true;
  if (pattern.endsWith("*")) return path.startsWith(pattern.slice(0, -1));
  if (pattern.startsWith("*")) return path.endsWith(pattern.slice(1));
  return path === pattern;
}

export function uncoveredInputs(inputs, watch) {
  return inputs.filter(p => !watch.some(w => matchesWatch(p, w)));
}

function build(worker, wranglerVersion) {
  const cwd = join(ROOT, "workers", worker);
  const out = mkdtempSync(join(tmpdir(), `bundle-${worker}-`));
  const meta = join(out, "meta.json");
  const env = { ...process.env };
  delete env.CLOUDFLARE_API_TOKEN;
  delete env.CLOUDFLARE_ACCOUNT_ID;
  execFileSync(
    "npx",
    [
      "--yes",
      `wrangler@${wranglerVersion}`,
      "deploy",
      "--dry-run",
      "--outdir",
      out,
      "--metafile",
      meta,
    ],
    { cwd, env, stdio: ["ignore", "ignore", "inherit"] }
  );
  const buf = readFileSync(join(out, "index.js"));
  const inputs = Object.keys(JSON.parse(readFileSync(meta, "utf8")).inputs).map(
    p => relative(ROOT, resolve(cwd, p)).split("\\").join("/")
  );
  return {
    sha: sha256(buf),
    bytes: buf.length,
    inputs: [...new Set(inputs)].sort(),
  };
}

async function cf(path) {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token)
    throw new Error(
      "--live needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN"
    );
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}${path}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.success)
    throw new Error(
      `GET ${path.split("?")[0]} -> HTTP ${r.status} ${JSON.stringify(j.errors ?? [])}`
    );
  return j.result;
}

async function liveBundle(worker) {
  const { deployments } = await cf(`/workers/scripts/${worker}/deployments`);
  const versions = deployments?.[0]?.versions ?? [];
  if (versions.length !== 1 || versions[0].percentage !== 100) {
    return {
      split:
        versions.map(v => `${v.version_id}@${v.percentage}%`).join(", ") ||
        "none",
    };
  }
  const id = versions[0].version_id;
  // Not /workers/scripts/<name>/content/v2?version=<id>: that ignores
  // `version` and returns the most recently uploaded version, which is not
  // necessarily the one serving traffic.
  const v = await cf(
    `/workers/workers/${worker}/versions/${id}?include=modules`
  );
  const mod = v.modules?.find(m => m.name === v.main_module) ?? v.modules?.[0];
  if (!mod) throw new Error(`${worker} ${id}: no modules returned`);
  const buf = Buffer.from(mod.content_base64, "base64");
  return { id, sha: sha256(buf), bytes: buf.length };
}

async function main() {
  const argv = process.argv.slice(2);
  const live = argv.includes("--live");
  const expected = !argv.includes("--no-expected");
  const cfg = JSON.parse(
    readFileSync(join(ROOT, "scripts/ci/worker-bundle-hashes.json"), "utf8")
  );
  const only = argv.filter(a => !a.startsWith("--"));
  const workers = only.length ? only : Object.keys(cfg.workers);
  const lines = [];
  let failed = false;
  const fail = msg => {
    failed = true;
    lines.push(`FAIL ${msg}`);
  };

  for (const worker of workers) {
    const want = cfg.workers[worker];
    if (!want) {
      fail(`${worker}: not in worker-bundle-hashes.json`);
      continue;
    }
    const pkg = JSON.parse(
      readFileSync(join(ROOT, "workers", worker, "package.json"), "utf8")
    );
    const pinned = pkg.devDependencies?.wrangler ?? pkg.dependencies?.wrangler;
    if (pinned && pinned !== cfg.wrangler)
      fail(
        `${worker}: package.json pins wrangler ${pinned}, hashes file records ${cfg.wrangler}`
      );

    const got = build(worker, cfg.wrangler);
    lines.push(
      `${worker}: built ${got.bytes} B sha256 ${got.sha} (wrangler ${cfg.wrangler})`
    );
    if (expected && got.sha !== want.sha256) {
      fail(
        `${worker}: bundle changed (recorded ${want.sha256}, ${want.bytes} B). If intended, set sha256/bytes in scripts/ci/worker-bundle-hashes.json to the values above.`
      );
    }
    const missing = uncoveredInputs(got.inputs, want.watch);
    if (missing.length)
      fail(
        `${worker}: bundle inputs not covered by watch paths (edits would not trigger a Workers Build): ${missing.join(", ")}`
      );

    if (live) {
      const l = await liveBundle(worker);
      if (l.split)
        fail(`${worker}: live traffic is not on a single version (${l.split})`);
      else if (l.sha !== got.sha)
        fail(
          `${worker}: live version ${l.id} is ${l.bytes} B sha256 ${l.sha}, not this build`
        );
      else lines.push(`${worker}: live version ${l.id} matches`);
    }
  }

  const text = lines.join("\n");
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, "```\n" + text + "\n```\n");
  process.exitCode = failed ? 1 : 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch(e => {
    console.error(`FAIL ${e.message}`);
    process.exitCode = 1;
  });
}
