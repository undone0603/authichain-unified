import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = name => readFileSync(`.github/workflows/${name}.yml`, "utf8");
const routes = source => source.split("\n").filter(line => line.trim().startsWith("runs-on:"));
const PR_HOSTED_WORKFLOWS = [
  "agentz-ci", "build-workers", "ci", "cloudflare-builds-status",
  "cloudflare-estate-audit", "codeql", "compliance-audit",
  "contract-tests", "honest-launch-gate", "lint", "main",
  "nightstamp-scan-gate", "schema-drift", "security-scan",
  "supabase-baseline", "trust-lab", "typecheck-ratchet",
  "vercel-deploy-guard", "windows-path-safety",
];

const routesPrToHosted = line => {
  const route = line.trim();
  // A mention of ubuntu-24.04 is not enough. The PR branch itself must
  // select hosted execution; unsafe conditions can otherwise pass this test.
  if (route === "runs-on: ubuntu-24.04") return true;
  const hostedPrArm = route.startsWith(
    "runs-on: ${{ github.event_name == 'pull_request' && 'ubuntu-24.04' || "
  ) && route.endsWith(" }}");
  const hostedFallback = (
    route.startsWith("runs-on: ${{ github.event_name != 'pull_request' && ") ||
    route.startsWith("runs-on: ${{ (github.event_name != 'pull_request') && ")
  ) && route.endsWith(" || 'ubuntu-24.04' }}");
  return hostedPrArm || hostedFallback;
};

test("runner selector rejects misleading hosted fallback expressions", () => {
  const unsafe = [
    "runs-on: [self-hosted, Linux, ARM64, authichain-wsl]",
    "runs-on: ${{ github.event_name == 'pull_request' && 'self-hosted' || 'ubuntu-24.04' }}",
    "runs-on: ${{ github.event_name == 'pull_request' && fromJSON('[\"self-hosted\"]') || 'ubuntu-24.04' }}",
    "runs-on: ${{ github.event_name != 'pull_request' && 'self-hosted' || 'self-hosted' }}",
    "runs-on: ${{ github.event_name == 'pull_request' && 'ubuntu-24.04' || 'self-hosted' }} || unsafe-suffix",
  ];
  for (const route of unsafe) {
    assert.equal(routesPrToHosted(route), false, route);
  }
  const safe = [
    "runs-on: ubuntu-24.04",
    "runs-on: ${{ github.event_name == 'pull_request' && 'ubuntu-24.04' || fromJSON('[\"self-hosted\"]') }}",
    "runs-on: ${{ github.event_name != 'pull_request' && fromJSON('[\"self-hosted\"]') || 'ubuntu-24.04' }}",
    "runs-on: ${{ (github.event_name != 'pull_request') && fromJSON('[\"self-hosted\"]') || 'ubuntu-24.04' }}",
  ];
  for (const route of safe) {
    assert.equal(routesPrToHosted(route), true, route);
  }
});

test("reviewed PR-triggered checks cannot select a self-hosted runner", () => {
  for (const name of PR_HOSTED_WORKFLOWS) {
    const source = workflow(name);
    assert.ok(source.includes("pull_request:"), `${name}: PR event missing`);
    const jobRoutes = routes(source);
    assert.ok(jobRoutes.length > 0, `${name}: missing runner selector`);
    for (const route of jobRoutes) {
      assert.ok(routesPrToHosted(route), `${name}: unsafe PR runner: ${route.trim()}`);
    }
  }
});

test("buyer-signals PR job is read-only and does not execute lead collector", () => {
  const source = workflow("buyer-signals");
  assert.ok(source.includes("verify-pr:\n    if: github.event_name == 'pull_request'\n    runs-on: ubuntu-24.04"));
  assert.ok(source.includes("permissions:\n      contents: read\n    steps:"));
  assert.ok(source.includes("run: node --check scripts/growth/buyer-signals.mjs"));
  assert.ok(source.includes("signals:\n    if: github.repository == 'undone0603/authichain-unified' && github.event_name != 'pull_request'"));
});

test("autonomy reconcile cannot execute PR code on ops or mutate unverified host", () => {
  const source = workflow("autonomy-reconcile");
  assert.ok(routesPrToHosted(routes(source)[0]));
  assert.ok(source.includes("github.event_name != 'pull_request' && github.ref == 'refs/heads/main' && vars.AUTHICHAIN_OPS_ISOLATION_ATTESTED == 'true'"));
  assert.ok(source.includes("node scripts/autonomy/reconcile.mjs --check"));
});

test("GovChain compile uses hosted PR runner and deploy stays dispatch-only", () => {
  const source = workflow("deploy-govchain-nft-base");
  assert.ok(routesPrToHosted(routes(source)[0]));
  assert.ok(source.includes("deploy-nft:\n    name: Deploy or grant AuthiChainNFT\n    if: github.event_name == 'workflow_dispatch'"));
});

test("both privileged Dependabot auto-merge workflows remain review-held", () => {
  for (const name of ["automerge-dependabot", "dependabot-auto-merge"]) {
    const source = workflow(name);
    assert.ok(source.includes("pull_request_target:"), name);
    assert.ok(source.includes("AUTHICHAIN_AUTOMERGE_REVIEWED == 'true'"), name);
    assert.ok(routes(source).every(route => route.trim() === "runs-on: ubuntu-24.04"), name);
  }
});

test("Worker PR builds never receive Cloudflare credentials", () => {
  const source = workflow("build-workers");
  assert.ok(!source.includes("secrets.CLOUDFLARE_"));
  assert.ok(source.includes("AUTHICHAIN_OPS_ISOLATION_ATTESTED == 'true'"));
  assert.ok(source.includes("worker-build-${{ github.run_id }}-${{ github.run_attempt }}"));
  const script = readFileSync("scripts/ci/build-workers.mjs", "utf8");
  assert.ok(script.includes('CLOUDFLARE_API_TOKEN: ""'));
  assert.ok(script.includes('CLOUDFLARE_ACCOUNT_ID: ""'));
});
