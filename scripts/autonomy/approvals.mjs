#!/usr/bin/env node
// scripts/autonomy/approvals.mjs
//
// The approval queue. The one place an autonomous loop asks the owner for a
// decision it is not allowed to make alone (docs/OPERATING_CHARTER.md,
// "What always waits for the owner").
//
// A request is a GitHub issue labelled `approval-needed`, keyed by a stable
// string so asking twice never opens two issues. The owner answers by adding
// the label `approved` or `denied`. Only a label added by the owner counts;
// anyone else's label is ignored. Resolved requests are closed with a comment.
//
// CLI (for workflows):
//   node scripts/autonomy/approvals.mjs gate --key <key> --title "<t>" --body "<b>"
//     exit 0  approved   -> the caller may proceed
//     exit 10 pending    -> request is open; caller stands down this run
//     exit 11 denied     -> caller must not proceed
//
//   node scripts/autonomy/approvals.mjs latch --prefix <p> [--trip --title "<t>" --body "<b>"]
//     A latch holds a loop stopped until the owner approves resuming. --trip
//     opens a request keyed <p>-<timestamp> unless one is already open. Exit 0 when no request under <p> is
//     waiting (released), 10 while any is pending or denied (held).
//
// Env: GITHUB_TOKEN (issues:write), GITHUB_REPOSITORY, APPROVAL_OWNER (login).
// Bodies are public: never put emails, amounts, or secrets in them.

export const LABEL = "approval-needed";
const MARK = key => `<!-- approval-key:${key} -->`;

/** Pure. Decide state from the issue and its label events. */
export function decide(issue, events, owner) {
  if (!issue) return "absent";
  const byOwner = events.filter(
    e =>
      e.event === "labeled" &&
      e.actor?.login?.toLowerCase() === owner.toLowerCase() &&
      ["approved", "denied"].includes(e.label?.name)
  );
  const last = byOwner.at(-1);
  if (!last) return "pending";
  // The label must still be on the issue; removing it withdraws the decision.
  const still = (issue.labels ?? []).some(
    l => (typeof l === "string" ? l : l.name) === last.label.name
  );
  return still ? last.label.name : "pending";
}

async function gh(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "authichain-approvals",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok)
    throw new Error(
      `${method} ${path} -> ${res.status} ${(await res.text()).slice(0, 200)}`
    );
  return res.status === 204 ? null : res.json();
}

export async function findRequest({ repo, token, key }) {
  const q = encodeURIComponent(
    `repo:${repo} is:issue in:body "approval-key:${key}"`
  );
  const found = await gh(`/search/issues?q=${q}&per_page=5`, { token });
  return (
    (found.items ?? []).find(i => (i.body ?? "").includes(MARK(key))) ?? null
  );
}

export async function gate({ repo, token, owner, key, title, body }) {
  let issue = await findRequest({ repo, token, key });
  if (issue && issue.state === "closed") {
    const events = await gh(
      `/repos/${repo}/issues/${issue.number}/events?per_page=100`,
      { token }
    );
    const d = decide(issue, events, owner);
    if (d === "approved" || d === "denied") return d;
    issue = null; // closed without a decision: ask again
  }
  if (!issue) {
    for (const [name, color] of [
      [LABEL, "fbca04"],
      ["approved", "0e8a16"],
      ["denied", "b60205"],
    ]) {
      await gh(`/repos/${repo}/labels`, {
        method: "POST",
        token,
        body: { name, color },
      }).catch(() => {});
    }
    await gh(`/repos/${repo}/issues`, {
      method: "POST",
      token,
      body: {
        title: `Approval needed: ${title}`,
        labels: [LABEL],
        assignees: [owner],
        body: `${body}\n\n---\n**To decide:** add the label \`approved\` or \`denied\`. Only the owner's label counts. The loop that asked checks again on its next run.\n\n${MARK(key)}`,
      },
    });
    return "pending";
  }
  const events = await gh(
    `/repos/${repo}/issues/${issue.number}/events?per_page=100`,
    { token }
  );
  const d = decide(issue, events, owner);
  if (d === "approved" || d === "denied") {
    await gh(`/repos/${repo}/issues/${issue.number}/comments`, {
      method: "POST",
      token,
      body: { body: `Recorded: **${d}**. Closing.` },
    });
    await gh(`/repos/${repo}/issues/${issue.number}`, {
      method: "PATCH",
      token,
      body: { state: "closed" },
    });
  }
  return d;
}

export async function openRequests({ repo, token, prefix }) {
  const q = encodeURIComponent(
    `repo:${repo} is:issue is:open label:${LABEL} in:body "approval-key:${prefix}"`
  );
  const found = await gh(`/search/issues?q=${q}&per_page=20`, { token });
  return (found.items ?? []).filter(i =>
    (i.body ?? "").includes(`approval-key:${prefix}`)
  );
}

/** Pure. Given decisions for open latch requests, is the loop held? */
export function latchHeld(decisions) {
  return decisions.some(d => d !== "approved");
}

export async function latch({
  repo,
  token,
  owner,
  prefix,
  trip,
  title,
  body,
  now = Date.now(),
}) {
  let open = await openRequests({ repo, token, prefix });
  // One open request at a time; a fresh trip after an approval asks again
  // under a new key, so an old approval never silently covers a new trip.
  if (trip && open.length === 0) {
    await gate({ repo, token, owner, key: `${prefix}-${now}`, title, body });
    return "held";
  }
  const decisions = [];
  for (const issue of open) {
    const events = await gh(
      `/repos/${repo}/issues/${issue.number}/events?per_page=100`,
      { token }
    );
    const d = decide(issue, events, owner);
    decisions.push(d);
    // Approved releases the latch. Denied stays open and keeps holding.
    if (d === "approved") {
      await gh(`/repos/${repo}/issues/${issue.number}/comments`, {
        method: "POST",
        token,
        body: { body: "Approved. The loop resumes on its next run. Closing." },
      });
      await gh(`/repos/${repo}/issues/${issue.number}`, {
        method: "PATCH",
        token,
        body: { state: "closed" },
      });
    }
  }
  if (trip && !latchHeld(decisions)) {
    // Tripped again right as the last request was approved: ask again.
    await gate({ repo, token, owner, key: `${prefix}-${now}`, title, body });
    return "held";
  }
  return latchHeld(decisions) ? "held" : "released";
}

function arg(name, argv) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main(argv) {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.APPROVAL_OWNER || repo?.split("/")[0];
  if (argv[0] === "latch") {
    const prefix = arg("prefix", argv);
    if (!repo || !token || !prefix) {
      console.error(
        "GITHUB_REPOSITORY, GITHUB_TOKEN and --prefix are required"
      );
      return 2;
    }
    const r = await latch({
      repo,
      token,
      owner,
      prefix,
      trip: argv.includes("--trip"),
      title: arg("title", argv) ?? prefix,
      body: arg("body", argv) ?? "",
    });
    console.log(`latch ${prefix}: ${r}`);
    return r === "released" ? 0 : 10;
  }
  if (argv[0] !== "gate") {
    console.error("usage: approvals.mjs gate|latch ...");
    return 2;
  }
  const key = arg("key", argv);
  if (!repo || !token || !key) {
    console.error("GITHUB_REPOSITORY, GITHUB_TOKEN and --key are required");
    return 2;
  }
  const d = await gate({
    repo,
    token,
    owner,
    key,
    title: arg("title", argv) ?? key,
    body: arg("body", argv) ?? "",
  });
  console.log(`approval ${key}: ${d}`);
  return d === "approved" ? 0 : d === "denied" ? 11 : 10;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then(
    c => process.exit(c),
    e => {
      console.error(e);
      process.exit(1);
    }
  );
}
