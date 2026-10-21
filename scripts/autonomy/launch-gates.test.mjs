import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MANIFEST_PATH,
  evaluateAll,
  evaluateGate,
  evaluateGithubCiEvidence,
  evaluateGitlabCiEvidence,
  evaluateProbes,
  platformOf,
  validateManifest,
} from "./launch-gates.mjs";

const now = new Date("2026-10-21T12:00:00Z");

const okJob = {
  name: "test",
  conclusion: "success",
  steps: [{ conclusion: "success" }, { conclusion: "success" }],
};
const okEntry = {
  workflow: "main.yml",
  run: { id: 1, conclusion: "success", head_sha: "abc" },
  jobs: [okJob],
};
const glOk = (job, over = {}) => ({
  job,
  found: {
    id: 10,
    status: "success",
    duration: 42.5,
    finished_at: "2026-10-20T12:00:00Z",
    pipeline_id: 5,
    sha: "abc",
    ...over,
  },
});

test("shipped manifest is valid", () => {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  assert.deepEqual(validateManifest(manifest), []);
});

test("platform detection", () => {
  assert.equal(platformOf({ GITLAB_CI: "true" }), "gitlab");
  assert.equal(platformOf({}), "github");
});

// ---------------------------------------------------------------- GitHub CI

test("GitHub CI: passes only with executed steps and success", () => {
  assert.equal(evaluateGithubCiEvidence([okEntry]).status, "pass");
});

test("GitHub CI: empty steps array FAILS even when the run says success (#1871)", () => {
  const r = evaluateGithubCiEvidence([
    { ...okEntry, jobs: [{ name: "shard 1", conclusion: "success", steps: [] }] },
  ]);
  assert.equal(r.status, "fail");
  assert.match(r.reasons.join(" "), /empty steps/);
});

test("GitHub CI: job with no executed step fails", () => {
  const r = evaluateGithubCiEvidence([
    { ...okEntry, jobs: [{ name: "b", conclusion: "success", steps: [{ conclusion: "skipped" }] }] },
  ]);
  assert.equal(r.status, "fail");
});

test("GitHub CI: no run, no jobs, failed run, empty evidence all FAIL", () => {
  assert.equal(evaluateGithubCiEvidence([{ workflow: "x.yml", run: null, jobs: [] }]).status, "fail");
  assert.equal(evaluateGithubCiEvidence([{ ...okEntry, jobs: [] }]).status, "fail");
  assert.equal(
    evaluateGithubCiEvidence([{ ...okEntry, run: { id: 2, conclusion: "failure" } }]).status,
    "fail"
  );
  assert.equal(evaluateGithubCiEvidence([]).status, "fail");
  assert.equal(evaluateGithubCiEvidence(undefined).status, "fail");
});

test("GitHub CI: skipped job fails unless allowed", () => {
  const skipped = {
    ...okEntry,
    jobs: [{ name: "s", conclusion: "skipped", steps: [{ conclusion: "success" }] }],
  };
  assert.equal(evaluateGithubCiEvidence([skipped]).status, "fail");
  assert.equal(evaluateGithubCiEvidence([skipped], { allowSkippedJobs: true }).status, "pass");
});

// ---------------------------------------------------------------- GitLab CI

test("GitLab CI: recent successful runs with duration pass", () => {
  const r = evaluateGitlabCiEvidence([glOk("lint"), glOk("tests")], { now, maxAgeDays: 7 });
  assert.equal(r.status, "pass");
});

test("GitLab CI: a job that was never run (manual/skipped) FAILS", () => {
  const r = evaluateGitlabCiEvidence([glOk("lint"), { job: "tests", found: null }], { now });
  assert.equal(r.status, "fail");
  assert.match(r.reasons.join(" "), /tests: no run found/);
});

test("GitLab CI: failed, canceled and zero-duration runs FAIL", () => {
  assert.equal(evaluateGitlabCiEvidence([glOk("a", { status: "failed" })], { now }).status, "fail");
  assert.equal(evaluateGitlabCiEvidence([glOk("a", { status: "canceled" })], { now }).status, "fail");
  const zero = evaluateGitlabCiEvidence([glOk("a", { duration: 0 })], { now });
  assert.equal(zero.status, "fail");
  assert.match(zero.reasons.join(" "), /never executed/);
  assert.equal(evaluateGitlabCiEvidence([glOk("a", { duration: null })], { now }).status, "fail");
});

test("GitLab CI: stale or undated runs FAIL", () => {
  const stale = evaluateGitlabCiEvidence(
    [glOk("a", { finished_at: "2026-10-01T00:00:00Z" })],
    { now, maxAgeDays: 7 }
  );
  assert.equal(stale.status, "fail");
  assert.match(stale.reasons.join(" "), /older than 7 days/);
  assert.equal(evaluateGitlabCiEvidence([glOk("a", { finished_at: null })], { now }).status, "fail");
  assert.equal(evaluateGitlabCiEvidence([], { now }).status, "fail");
  assert.equal(evaluateGitlabCiEvidence(undefined, { now }).status, "fail");
});

test("ci gate dispatches on evidence platform; unknown platform FAILS", () => {
  const gate = { id: "ci", type: "ci", jobs: ["lint"], workflows: ["main.yml"], max_age_days: 7 };
  assert.equal(
    evaluateGate(gate, { platform: "gitlab", entries: [glOk("lint")] }, now).status,
    "pass"
  );
  assert.equal(
    evaluateGate(gate, { platform: "github", entries: [okEntry] }, now).status,
    "pass"
  );
  assert.equal(evaluateGate(gate, { platform: "bitbucket", entries: [] }, now).status, "fail");
  assert.equal(evaluateGate(gate, { entries: [okEntry] }, now).status, "fail");
});

// -------------------------------------------------------------------- probes

const probes = [{ url: "https://authichain.com/", expect_status: 200, max_ms: 4000 }];

test("probes: pass when status and latency are in budget", () => {
  const r = evaluateProbes(
    [{ url: "https://authichain.com/", status: 200, location: null, ms: 120 }],
    probes,
    "cloudflareaccess.com"
  );
  assert.equal(r.status, "pass");
});

test("probes: redirect to Cloudflare Access FAILS (#989)", () => {
  const r = evaluateProbes(
    [
      {
        url: "https://authichain.com/",
        status: 302,
        location: "https://strainchainexecutiveteam.cloudflareaccess.com/cdn-cgi/access/login/authichain.com",
        ms: 90,
      },
    ],
    probes,
    "cloudflareaccess.com"
  );
  assert.equal(r.status, "fail");
  assert.match(r.reasons.join(" "), /cloudflareaccess/);
});

test("probes: wrong status, slow, error and missing result all FAIL", () => {
  const f = (res) => evaluateProbes(res, probes, "cloudflareaccess.com").status;
  assert.equal(f([{ url: "https://authichain.com/", status: 503, ms: 10 }]), "fail");
  assert.equal(f([{ url: "https://authichain.com/", status: 200, ms: 9000 }]), "fail");
  assert.equal(f([{ url: "https://authichain.com/", error: "timeout", ms: 10000 }]), "fail");
  assert.equal(f([{ url: "https://other.example/", status: 200, ms: 1 }]), "fail");
  assert.equal(f([]), "fail");
});

// ----------------------------------------------------------- gate framework

test("pending gates always FAIL", () => {
  assert.equal(evaluateGate({ id: "p", type: "pending", ref: "r" }, undefined).status, "fail");
  assert.equal(
    evaluateGate({ id: "p", type: "pending" }, { platform: "github", entries: [okEntry] }).status,
    "fail"
  );
});

test("missing evidence, collector error and unknown type FAIL", () => {
  const g = { id: "c", type: "ci", jobs: ["lint"], workflows: ["main.yml"] };
  assert.equal(evaluateGate(g, undefined).status, "fail");
  assert.equal(evaluateGate(g, { error: "boom" }).status, "fail");
  assert.equal(evaluateGate({ id: "z", type: "nope" }, {}).status, "fail");
});

test("kill_switch stands everything down", () => {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const report = evaluateAll({ ...manifest, kill_switch: true });
  assert.equal(report.state, "stood_down");
  assert.deepEqual(report.gates, []);
});

test("evaluateAll is fail while any gate is pending", () => {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const ciGate = manifest.gates.find((g) => g.id === "ci-executes-and-green");
  const evidence = {
    "ci-executes-and-green": {
      platform: "gitlab",
      entries: ciGate.jobs.map((j) => glOk(j)),
    },
    "public-hosts-reachable": {
      results: manifest.gates
        .find((g) => g.id === "public-hosts-reachable")
        .probes.map((p) => ({ url: p.url, status: 200, location: null, ms: 50 })),
    },
  };
  const report = evaluateAll(manifest, evidence, now);
  assert.equal(report.state, "fail");
  assert.equal(report.gates.find((g) => g.id === "ci-executes-and-green").status, "pass");
  assert.equal(report.gates.find((g) => g.id === "public-hosts-reachable").status, "pass");
});

test("validateManifest rejects duplicate ids, bad types, bad probes and bad ci gates", () => {
  const errs = validateManifest({
    version: 1,
    kill_switch: false,
    gates: [
      { id: "a", title: "A", type: "pending" },
      { id: "a", title: "A2", type: "weird" },
      { id: "b", title: "B", type: "http_probe", probes: [{ url: "http://x", expect_status: "200", max_ms: 0 }] },
      { id: "c", title: "C", type: "ci", jobs: [], workflows: ["m.yml"], max_age_days: 0 },
    ],
  });
  assert.ok(errs.some((e) => /duplicate gate id/.test(e)));
  assert.ok(errs.some((e) => /unknown type/.test(e)));
  assert.ok(errs.some((e) => /https/.test(e)));
  assert.ok(errs.some((e) => /expect_status/.test(e)));
  assert.ok(errs.some((e) => /max_ms/.test(e)));
  assert.ok(errs.some((e) => /jobs must be a non-empty array/.test(e)));
  assert.ok(errs.some((e) => /max_age_days/.test(e)));
});
