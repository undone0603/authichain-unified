import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  cell,
  decide,
  isGitHubRateLimit,
  listCheckRuns,
  loadConfig,
  restrictedChange,
} from "./merge-autopilot.mjs";

const cfg = loadConfig({
  owner: "undone0603",
  merge_autopilot: {
    enabled: true,
    trusted_authors: ["undone0603", "dependabot[bot]"],
  },
});

const REPO = { full_name: "undone0603/authichain-unified" };
const pr = (over = {}) => ({
  state: "open",
  draft: false,
  user: { login: "undone0603" },
  base: { ref: "main", repo: REPO },
  head: { repo: REPO, sha: "abc" },
  labels: [],
  mergeable: true,
  mergeable_state: "clean",
  ...over,
});
const ok = name => ({
  name,
  status: "completed",
  conclusion: "success",
  head_sha: "abc",
  app: { slug: "github-actions" },
});
const GREEN = [
  ok("Main quality gate"),
  ok("lint"),
  ok("CI"),
  { ...ok("Production launch proof"), conclusion: "skipped" },
];
const NO_STATUS = { state: "pending", total_count: 0 };

describe("merge autopilot decide()", () => {
  it("merges a green, clean, up-to-date PR from a trusted author", () => {
    assert.equal(decide(pr(), GREEN, NO_STATUS, 0, cfg).action, "merge");
  });

  it("requires successful Actions quality evidence on this exact PR head", () => {
    const otherChecks = GREEN.filter(r => r.name !== "Main quality gate");
    for (const gate of [
      null,
      { ...ok("Main quality gate"), conclusion: "skipped" },
      { ...ok("Main quality gate"), conclusion: "neutral" },
      { ...ok("Main quality gate"), status: "in_progress", conclusion: null },
      { ...ok("Main quality gate"), head_sha: "old-head" },
      { ...ok("Main quality gate"), app: { slug: "another-app" } },
    ]) {
      const checks = gate ? [...otherChecks, gate] : otherChecks;
      assert.equal(decide(pr(), checks, NO_STATUS, 0, cfg).action, "wait");
    }
  });

  it("does not merge when its token cannot trigger downstream deployment", () => {
    const result = decide(pr(), GREEN, NO_STATUS, 0, cfg, { canUpdate: false });
    assert.equal(result.action, "wait");
    assert.match(result.reason, /no PAT/);
  });

  it("updates a branch that is behind main instead of merging it", () => {
    assert.deepEqual(decide(pr(), GREEN, NO_STATUS, 3, cfg), {
      action: "update",
      reason: "3 commit(s) behind main",
    });
  });

  it("waits on a behind branch when it has no PAT to update with", () => {
    const d = decide(pr(), GREEN, NO_STATUS, 1, cfg, { canUpdate: false });
    assert.equal(d.action, "wait");
  });

  it("flags conflicts", () => {
    assert.equal(
      decide(pr({ mergeable_state: "dirty" }), GREEN, NO_STATUS, 2, cfg).action,
      "conflict"
    );
    assert.equal(
      decide(pr({ mergeable: false }), GREEN, NO_STATUS, 0, cfg).action,
      "conflict"
    );
  });

  for (const [name, over, why] of [
    ["drafts", { draft: true }, "draft"],
    ["forks", { head: { repo: { full_name: "evil/fork" }, sha: "x" } }, "fork"],
    ["untrusted authors", { user: { login: "stranger" } }, "not trusted"],
    ["hold labels", { labels: [{ name: "hold" }] }, "label hold"],
    [
      "other base branches",
      { base: { ref: "release", repo: REPO } },
      "base is release",
    ],
  ]) {
    it(`skips ${name}`, () => {
      const d = decide(pr(over), GREEN, NO_STATUS, 0, cfg);
      assert.equal(d.action, "skip");
      assert.match(d.reason, new RegExp(why));
    });
  }

  it("waits while checks are pending, red, or missing", () => {
    const pending = [
      ...GREEN,
      { name: "CodeQL", status: "in_progress", conclusion: null },
    ];
    assert.match(
      decide(pr(), pending, NO_STATUS, 0, cfg).reason,
      /pending: CodeQL/
    );
    const red = [
      ...GREEN,
      { ...ok("Typecheck ratchet"), conclusion: "failure" },
    ];
    assert.match(
      decide(pr(), red, NO_STATUS, 0, cfg).reason,
      /red: Typecheck ratchet/
    );
    const cancelled = [...GREEN, { ...ok("lint"), conclusion: "cancelled" }];
    assert.equal(decide(pr(), cancelled, NO_STATUS, 0, cfg).action, "wait");
    assert.match(decide(pr(), [], NO_STATUS, 0, cfg).reason, /no checks/);
  });

  it("ignores its own check run", () => {
    const self = [
      { name: "Merge autopilot", status: "in_progress", conclusion: null },
    ];
    assert.equal(
      decide(pr(), [...GREEN, ...self], NO_STATUS, 0, cfg).action,
      "merge"
    );
  });

  it("respects legacy commit statuses when any exist", () => {
    assert.equal(
      decide(pr(), GREEN, { state: "failure", total_count: 1 }, 0, cfg).action,
      "wait"
    );
    assert.equal(
      decide(pr(), GREEN, { state: "success", total_count: 2 }, 0, cfg).action,
      "merge"
    );
  });

  it("updates a held branch that is behind and never merges it", () => {
    const held = pr({ labels: [{ name: "hold" }], draft: true });
    assert.deepEqual(decide(held, GREEN, NO_STATUS, 4, cfg), {
      action: "update",
      reason: "4 commit(s) behind main; label hold blocks merge",
    });
    assert.equal(
      decide(pr({ labels: [{ name: "hold" }] }), GREEN, NO_STATUS, 0, cfg)
        .action,
      "skip"
    );
  });

  it("waits on a held branch when it has no PAT to update with", () => {
    const d = decide(
      pr({ labels: [{ name: "do-not-merge" }] }),
      GREEN,
      NO_STATUS,
      2,
      cfg,
      { canUpdate: false }
    );
    assert.equal(d.action, "wait");
    assert.match(d.reason, /label do-not-merge/);
  });

  it("does not update a plain draft that is behind", () => {
    assert.equal(
      decide(pr({ draft: true }), GREEN, NO_STATUS, 5, cfg).action,
      "skip"
    );
  });

  it("flags a held branch that conflicts and does not update it", () => {
    assert.equal(
      decide(
        pr({
          labels: [{ name: "hold" }],
          mergeable_state: "dirty",
          draft: true,
        }),
        GREEN,
        NO_STATUS,
        3,
        cfg
      ).action,
      "conflict"
    );
  });

  it("only merges when GitHub reports clean", () => {
    for (const s of ["blocked", "unstable", "has_hooks", "behind"])
      assert.equal(
        decide(pr({ mergeable_state: s }), GREEN, NO_STATUS, 0, cfg).action,
        "wait"
      );
    assert.equal(
      decide(pr({ mergeable: null }), GREEN, NO_STATUS, 0, cfg).action,
      "wait"
    );
  });
});

describe("merge autopilot restricted changes", () => {
  const file = (filename, patch = "@@ -1 +1 @@\n-a\n+b", over = {}) => ({
    filename,
    status: "modified",
    patch,
    ...over,
  });
  const check = files => restrictedChange(files, files.length);
  const NO_PATCH = null;

  it("lets ordinary changes through", () => {
    assert.equal(
      check([
        file("src/app/pricing/page.tsx"),
        file("docs/INDEX.md", NO_PATCH),
      ]),
      null
    );
  });

  for (const path of [
    ".github/autonomy.json",
    ".github/workflows/merge-autopilot.yml",
    ".github/workflows/main.yml",
    ".github/workflows/autonomy-reconcile.yml",
    ".github/workflows/deploy-workers.yml",
    ".github/workflows/b2b-outreach.yml",
    ".github/workflows/set-outreach-secret.yml",
    "scripts/autonomy/merge-autopilot.mjs",
    "scripts/autonomy/launch-mode.mjs",
    "config/launch-gates.json",
    "docs/OPERATING_CHARTER.md",
    "CLAUDE.md",
    "src/lib/plans.ts",
    "src/lib/stripe-construct-event.ts",
    "src/lib/dpp-fulfill-checkout.ts",
    "src/app/api/stripe/webhook/route.ts",
    "server/webhooks/stripe.ts",
    "server/outreach/send-guard.ts",
    "workers/stripe-webhook/src/index.ts",
    "apps/qron-platform/workers/stripe-webhook/src/index.ts",
    "apps/qron-platform/src/app/api/stripe/webhook/route.ts",
    "workers/dpp-fulfillment/src/index.ts",
    "workers/qron-outreach/index.js",
    "workers/resend-relay/src/index.ts",
    "supabase/migrations/20261013000000_x.sql",
  ]) {
    it(`holds ${path}`, () => {
      assert.match(check([file(path)]), /restricted path/);
    });
  }

  it("holds a rename out of a restricted path", () => {
    const f = file("src/lib/old-plans.ts", "", {
      status: "renamed",
      previous_filename: "src/lib/plans.ts",
    });
    assert.match(check([f]), /restricted path src\/lib\/plans\.ts/);
  });

  it("does not let * cross a directory", () => {
    assert.equal(check([file("src/lib/stripe/helpers/format.ts")]), null);
    assert.equal(check([file("docs/CLAUDE.md")]), null);
  });

  it("holds router edits that change a restricted call", () => {
    const patch =
      "@@ -10,3 +10,3 @@\n context\n-  await fulfillDppPaidSession(env, s);\n+  void fulfillDppPaidSession(env, s);";
    assert.match(
      check([file("worker-app/index.ts", patch)]),
      /changes fulfillDppPaidSession in worker-app\/index\.ts/
    );
    assert.match(
      check([
        file(
          "worker/index.ts",
          "@@\n+const sig = req.headers.get('Stripe-Signature')"
        ),
      ]),
      /stripe-signature/i
    );
  });

  it("ignores restricted names on unchanged context lines", () => {
    const patch =
      "@@ -10,3 +10,3 @@\n   await fulfillDppPaidSession(env, s);\n-const a = 1;\n+const a = 2;";
    assert.equal(check([file("worker-app/index.ts", patch)]), null);
  });

  it("fails closed on unreadable code diffs and incomplete lists", () => {
    assert.match(
      check([file("worker-app/index.ts", NO_PATCH)]),
      /not readable/
    );
    assert.match(restrictedChange([file("a.ts")], 2), /incomplete \(1 of 2\)/);
    assert.match(restrictedChange(undefined, 1), /unavailable/);
  });

  it("does not block a lockfile with no patch", () => {
    assert.equal(check([file("pnpm-lock.yaml", NO_PATCH)]), null);
  });
});

describe("merge autopilot config", () => {
  it("is off unless enabled is exactly true", () => {
    assert.equal(loadConfig({ owner: "o" }).enabled, false);
    assert.deepEqual(loadConfig({ owner: "O" }).trustedAuthors, ["o"]);
  });

  it("the live manifest block parses and trusts the owner", () => {
    const m = JSON.parse(readFileSync(".github/autonomy.json", "utf8"));
    const c = loadConfig(m);
    assert.ok(c.trustedAuthors.includes(m.owner.toLowerCase()));
    assert.equal(c.mergeMethod, "squash");
  });
});

describe("merge autopilot summary", () => {
  it("keeps API text inside one table cell", () => {
    assert.equal(cell("a|b\nc"), "a\\|b c");
    assert.equal(cell("x\\|y"), "x\\\\\\|y");
  });
});

describe("merge autopilot rate limit", () => {
  it("recognizes a primary or secondary limit and ignores other 403s", () => {
    assert.equal(
      isGitHubRateLimit(403, "API rate limit exceeded for installation"),
      true
    );
    assert.equal(
      isGitHubRateLimit(429, "You have exceeded a secondary rate limit"),
      true
    );
    assert.equal(
      isGitHubRateLimit(403, "Resource not accessible by integration"),
      false
    );
    assert.equal(isGitHubRateLimit(404, "rate limit"), false);
  });
});

describe("merge autopilot complete CI evidence", () => {
  it("observes a failure after the first 100 checks", async () => {
    const requests = [];
    const checks = await listCheckRuns(
      "owner/repo",
      "abc",
      "test-token",
      async path => {
        requests.push(path);
        return {
          check_runs:
            requests.length === 1
              ? Array.from({ length: 100 }, (_, n) => ok(`check-${n}`))
              : [
                  ok("Main quality gate"),
                  { ...ok("late security check"), conclusion: "failure" },
                ],
        };
      }
    );
    assert.equal(requests.length, 2);
    assert.match(requests[0], /filter=latest&per_page=100&page=1$/);
    assert.match(requests[1], /page=2$/);
    assert.match(
      decide(pr(), checks, NO_STATUS, 0, cfg).reason,
      /late security check/
    );
  });

  it("rejects unreadable or truncated evidence", async () => {
    await assert.rejects(
      listCheckRuns("o/r", "abc", "test-token", async () => ({})),
      /unavailable/
    );
    await assert.rejects(
      listCheckRuns("o/r", "abc", "test-token", async () => ({
        check_runs: Array.from({ length: 100 }, () => ok("check")),
      })),
      /pagination limit/
    );
  });
});
