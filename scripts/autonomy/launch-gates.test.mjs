import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MANIFEST_PATH,
  evaluateAll,
  evaluateCiEvidence,
  evaluateGate,
  evaluateProbes,
  validateManifest,
} from "./launch-gates.mjs";

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

test("shipped manifest is valid", () => {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  assert.deepEqual(validateManifest(manifest), []);
});

test("CI: passes only with executed steps and success", () => {
  assert.equal(evaluateCiEvidence([okEntry]).status, "pass");
});

test("CI: empty steps array FAILS even when the run says success (#1871)", () => {
  const r = evaluateCiEvidence([
    { ...okEntry, jobs: [{ name: "shard 1", conclusion: "success", steps: [] }] },
  ]);
  assert.equal(r.status, "fail");
  assert.match(r.reasons.join(" "), /empty steps/);
});

test("CI: job with no executed step fails", () => {
  const r = evaluateCiEvidence([
    { ...okEntry, jobs: [{ name: "b", conclusion: "success", steps: [{ conclusion: "skipped" }] }] },
  ]);
  assert.equal(r.status, "fail");
});

test("CI: no run, no jobs, failed run all FAIL", () => {
  assert.equal(evaluateCiEvidence([{ workflow: "x.yml", run: null, jobs: [] }]).status, "fail");
  assert.equal(evaluateCiEvidence([{ ...okEntry, jobs: [] }]).status, "fail");
  assert.equal(
    evaluateCiEvidence([{ ...okEntry, run: { id: 2, conclusion: "failure" } }]).status,
    "fail"
  );
  assert.equal(evaluateCiEvidence([]).status, "fail");
  assert.equal(evaluateCiEvidence(undefined).status, "fail");
});

test("CI: skipped job fails unless allowed", () => {
  const skipped = {
    ...okEntry,
    jobs: [{ name: "s", conclusion: "skipped", steps: [{ conclusion: "success" }] }],
  };
  assert.equal(evaluateCiEvidence([skipped]).status, "fail");
  assert.equal(evaluateCiEvidence([skipped], { allowSkippedJobs: true }).status, "pass");
});

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

test("pending gates always FAIL", () => {
  assert.equal(evaluateGate({ id: "p", type: "pending", ref: "r" }, undefined).status, "fail");
  assert.equal(evaluateGate({ id: "p", type: "pending" }, { entries: [okEntry] }).status, "fail");
});

test("missing evidence, collector error and unknown type FAIL", () => {
  const g = { id: "c", type: "github_ci", workflows: ["main.yml"] };
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
  const evidence = {
    "ci-executes-and-green": { entries: [okEntry] },
    "public-hosts-reachable": {
      results: manifest.gates
        .find((g) => g.id === "public-hosts-reachable")
        .probes.map((p) => ({ url: p.url, status: 200, location: null, ms: 50 })),
    },
  };
  const report = evaluateAll(manifest, evidence);
  assert.equal(report.state, "fail");
  assert.equal(report.gates.find((g) => g.id === "ci-executes-and-green").status, "pass");
  assert.equal(report.gates.find((g) => g.id === "public-hosts-reachable").status, "pass");
});

test("validateManifest rejects duplicate ids, bad types and bad probes", () => {
  const errs = validateManifest({
    version: 1,
    kill_switch: false,
    gates: [
      { id: "a", title: "A", type: "pending" },
      { id: "a", title: "A2", type: "weird" },
      { id: "b", title: "B", type: "http_probe", probes: [{ url: "http://x", expect_status: "200", max_ms: 0 }] },
    ],
  });
  assert.ok(errs.some((e) => /duplicate gate id/.test(e)));
  assert.ok(errs.some((e) => /unknown type/.test(e)));
  assert.ok(errs.some((e) => /https/.test(e)));
  assert.ok(errs.some((e) => /expect_status/.test(e)));
  assert.ok(errs.some((e) => /max_ms/.test(e)));
});
