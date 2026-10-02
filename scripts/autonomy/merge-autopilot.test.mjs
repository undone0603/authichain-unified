import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { cell, decide, loadConfig } from "./merge-autopilot.mjs";

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
const ok = name => ({ name, status: "completed", conclusion: "success" });
const GREEN = [
  ok("lint"),
  ok("CI"),
  { ...ok("Production launch proof"), conclusion: "skipped" },
];
const NO_STATUS = { state: "pending", total_count: 0 };

describe("merge autopilot decide()", () => {
  it("merges a green, clean, up-to-date PR from a trusted author", () => {
    assert.equal(decide(pr(), GREEN, NO_STATUS, 0, cfg).action, "merge");
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
  });
});
