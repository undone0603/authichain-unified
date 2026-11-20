#!/usr/bin/env node
/**
 * Merge train: test a queue of PRs together, then merge them back to back.
 *
 *   node scripts/ops/merge-train.mjs build  <pr> <pr> ...   # trial-merge onto main, push ci/merge-train-<date>
 *   node scripts/ops/merge-train.mjs status <pr> <pr> ...   # train gate + each PR's own gate + mergeability
 *
 * Instead of one CircleCI cycle per PR, the combined code is tested once.
 * Safety is unchanged:
 * - build refuses if any PR conflicts with main or with an earlier PR in the
 *   list (conflicting PRs need a rebase and a separate slot);
 * - status prints merge commands only when the train's main-quality-gate AND
 *   every PR's own gate are green, each pinned with --match-head-commit;
 * - it never merges and never deploys. Run the printed `gh pr merge` lines as
 *   standalone commands, and never merge while a production deploy is pending
 *   (deploys require expected_sha == main's tip).
 *
 * Read-only against GitHub except `git push` of the train branch.
 */
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const REPO = process.env.MERGE_TRAIN_REPO || "undone0603/authichain-unified";
const GATE = "ci/circleci: main-quality-gate";

const sh = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
const gh = args => sh("gh", args);
const git = args => sh("git", args);

export function trainBranch(date = new Date()) {
  return `ci/merge-train-${date.toISOString().slice(0, 10).replace(/-/g, "")}`;
}

export function gateOf(statuses) {
  const hit = statuses.find(s => s.context === GATE);
  return hit ? hit.state : "none";
}

/** Decide whether the train may merge; returns {ok, reasons, commands}. */
export function decide(trainGate, prs) {
  const reasons = [];
  if (trainGate !== "success") reasons.push(`train gate is ${trainGate}`);
  for (const p of prs) {
    if (p.gate !== "success") reasons.push(`#${p.number} own gate is ${p.gate}`);
    if (p.mergeable === false) reasons.push(`#${p.number} is not mergeable`);
    if (p.draft) reasons.push(`#${p.number} is still a draft (gh pr ready ${p.number})`);
  }
  const commands = prs.map(
    p => `gh pr merge ${p.number} -R ${REPO} --squash --delete-branch --match-head-commit ${p.head}`
  );
  return { ok: reasons.length === 0, reasons, commands };
}

function prInfo(n) {
  const j = JSON.parse(gh(["api", `repos/${REPO}/pulls/${n}`]));
  const statuses = JSON.parse(gh(["api", `repos/${REPO}/commits/${j.head.sha}/statuses?per_page=100`]));
  return { number: n, head: j.head.sha, mergeable: j.mergeable, draft: j.draft, gate: gateOf(statuses) };
}

function build(prs) {
  const branch = trainBranch();
  git(["fetch", "-q", "origin", "main", ...prs.map(n => `pull/${n}/head:mt-${n}`)]);
  git(["checkout", "-q", "-B", branch, "origin/main"]);
  for (const n of prs) {
    try {
      git(["merge", "-q", "--no-ff", "--no-edit", "-m", `train: merge #${n}`, `mt-${n}`]);
    } catch {
      git(["merge", "--abort"]);
      throw new Error(`#${n} conflicts with main or an earlier PR; rebase it and give it its own slot`);
    }
  }
  git(["push", "-q", "--force-with-lease", "-u", "origin", branch]);
  console.log(`${branch} = ${git(["rev-parse", "HEAD"])} (main + ${prs.map(n => "#" + n).join(" ")})`);
}

function status(prs) {
  const branch = trainBranch();
  const sha = sh("git", ["ls-remote", "origin", `refs/heads/${branch}`]).split(/\s+/)[0];
  if (!sha) throw new Error(`no ${branch} on origin; run build first`);
  const trainGate = gateOf(JSON.parse(gh(["api", `repos/${REPO}/commits/${sha}/statuses?per_page=100`])));
  const info = prs.map(prInfo);
  const d = decide(trainGate, info);
  console.log(`train ${branch} ${sha.slice(0, 9)} gate=${trainGate}`);
  for (const p of info) console.log(`  #${p.number} ${p.head.slice(0, 9)} gate=${p.gate} mergeable=${p.mergeable} draft=${p.draft}`);
  if (!d.ok) {
    console.log("NOT READY:\n  " + d.reasons.join("\n  "));
    process.exitCode = 2;
    return;
  }
  console.log("READY. Run each line standalone, in order; never during a pending deploy:");
  for (const c of d.commands) console.log(c);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [cmd, ...rest] = process.argv.slice(2);
  const prs = rest.map(Number).filter(Number.isInteger);
  if (!["build", "status"].includes(cmd) || prs.length === 0) {
    console.error("usage: merge-train.mjs build|status <pr> [<pr> ...]");
    process.exit(64);
  }
  (cmd === "build" ? build : status)(prs);
}
