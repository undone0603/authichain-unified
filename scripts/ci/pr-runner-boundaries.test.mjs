import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = name => readFileSync(`.github/workflows/${name}.yml`, "utf8");
const routes = source =>
  source.split("\n").filter(line => line.trim().startsWith("runs-on:"));

const routesPrToHosted = line => {
  const route = line.trim();
  // A mention of ubuntu-24.04 is not enough. The PR branch itself must
  // select hosted execution; unsafe conditions can otherwise pass this test.
  if (route === "runs-on: ubuntu-24.04") return true;
  const hostedPrArm =
    route.startsWith(
      "runs-on: ${{ github.event_name == 'pull_request' && 'ubuntu-24.04' || "
    ) && route.endsWith(" }}");
  // An extra || arm would catch the false PR condition before the fallback.
  const hostedFallback =
    (route.startsWith("runs-on: ${{ github.event_name != 'pull_request' && ") ||
      route.startsWith(
        "runs-on: ${{ (github.event_name != 'pull_request') && "
      )) &&
    route.endsWith(" || 'ubuntu-24.04' }}") &&
    route.split("||").length === 2;
  return hostedPrArm || hostedFallback;
};

test("runner selector rejects misleading hosted fallback expressions", () => {
  const unsafe = [
    "runs-on: [self-hosted, Linux, ARM64, authichain-wsl]",
    "runs-on: ${{ github.event_name == 'pull_request' && 'self-hosted' || 'ubuntu-24.04' }}",
    "runs-on: ${{ github.event_name == 'pull_request' && fromJSON('[\"self-hosted\"]') || 'ubuntu-24.04' }}",
    "runs-on: ${{ github.event_name != 'pull_request' && 'self-hosted' || 'self-hosted' }}",
    "runs-on: ${{ github.event_name == 'pull_request' && 'ubuntu-24.04' || 'self-hosted' }} || unsafe-suffix",
    "runs-on: ${{ github.event_name != 'pull_request' && 'x' || 'self-hosted' || 'ubuntu-24.04' }}",
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

test("buyer-signals PR job is read-only and does not execute lead collector", () => {
  const source = workflow("buyer-signals");
  const [verify, rest] = source.split("  signals:\n");
  assert.ok(verify.includes("verify-pr:"));
  assert.ok(verify.includes("if: github.event_name == 'pull_request'"));
  assert.ok(verify.includes("persist-credentials: false"));
  assert.ok(verify.includes("permissions:\n      contents: read"));
  assert.ok(verify.includes("run: node --check scripts/growth/buyer-signals.mjs"));
  assert.ok(!verify.includes("run: node scripts/growth/buyer-signals.mjs"));
  assert.ok(
    rest.includes(
      "if: github.repository == 'undone0603/authichain-unified' && github.event_name != 'pull_request'"
    )
  );
  assert.ok(rest.includes("run: node scripts/growth/buyer-signals.mjs"));
});

test("fork pull requests still fall back to hosted ubuntu-24.04 on CI Main", () => {
  const source = workflow("main");
  assert.ok(source.includes("pull_request:"));
  assert.match(
    source,
    /github\.event\.pull_request\.head\.repo\.full_name == github\.repository\) && fromJSON\('\["self-hosted","Linux","ARM64","authichain-wsl"\]'\) \|\| 'ubuntu-24.04'/
  );
});

test("autonomy reconcile apply stays off pull_request and needs isolation attestation", () => {
  const source = workflow("autonomy-reconcile");
  assert.ok(source.includes("node scripts/autonomy/reconcile.mjs --check"));
  assert.ok(
    source.includes(
      "github.event_name != 'pull_request' && github.ref == 'refs/heads/main' && vars.AUTHICHAIN_OPS_ISOLATION_ATTESTED == 'true'"
    )
  );
});

test("GovChain deploy stays dispatch-only", () => {
  const source = workflow("deploy-govchain-nft-base");
  assert.match(source, /deploy-nft:\n(?:    name: .*\n)?    if: github\.event_name == 'workflow_dispatch'/);
});

test("both privileged Dependabot auto-merge workflows remain review-held", () => {
  for (const name of ["automerge-dependabot", "dependabot-auto-merge"]) {
    const source = workflow(name);
    assert.ok(source.includes("pull_request_target:"), name);
    // A job disabled outright is stricter than one gated on the review variable.
    assert.ok(
      source.includes("AUTHICHAIN_AUTOMERGE_REVIEWED == 'true'") ||
        /\n    if: \$\{\{ false \}\}/.test(source),
      name
    );
  }
});

test("core PR checkouts do not persist git credentials", () => {
  for (const name of [
    "agentz-ci",
    "autonomy-reconcile",
    "build-workers",
    "ci",
    "cloudflare-estate-audit",
    "codeql",
    "compliance-audit",
    "contract-tests",
    "honest-launch-gate",
    "lint",
    "main",
    "nightstamp-scan-gate",
    "schema-drift",
    "security-scan",
    "supabase-baseline",
    "trust-lab",
    "typecheck-ratchet",
    "vercel-deploy-guard",
    "windows-path-safety",
  ]) {
    const lines = workflow(name).split("\n");
    const checkouts = lines.flatMap((line, i) =>
      line.includes("uses: actions/checkout@") ? [i] : []
    );
    assert.ok(checkouts.length > 0, name);
    for (const i of checkouts) {
      // Exact indentation: a misindented key is not a step input.
      const indent =
        lines[i].match(/^ */)[0].length +
        (lines[i].trimStart().startsWith("- ") ? 2 : 0);
      const pad = " ".repeat(indent);
      const step = lines.slice(i + 1, i + 6);
      const withAt = step.indexOf(`${pad}with:`);
      assert.ok(withAt >= 0, `${name}:${i + 1} missing with`);
      assert.ok(
        step.slice(withAt + 1).includes(`${pad}  persist-credentials: false`),
        `${name}:${i + 1}`
      );
    }
  }
});

test("jobs without a top-level token limit request a read-only token", () => {
  for (const name of ["ci", "contract-tests"]) {
    assert.match(
      workflow(name),
      /\n    permissions:\n      contents: read\n/,
      name
    );
  }
});

test("Worker PR base ref is not expanded into a shell command", () => {
  const source = workflow("build-workers");
  assert.ok(!source.includes("origin ${{ github.base_ref }}"));
  assert.ok(source.includes("BASE_REF: ${{ github.base_ref }}"));
});

test("Worker PR builds never receive Cloudflare credentials", () => {
  const source = workflow("build-workers");
  assert.ok(!source.includes("secrets.CLOUDFLARE_"));
  assert.ok(
    source.includes(
      "worker-build-${{ github.run_id }}-${{ github.run_attempt }}"
    )
  );
  const script = readFileSync("scripts/ci/build-workers.mjs", "utf8");
  assert.ok(script.includes('CLOUDFLARE_API_TOKEN: ""'));
  assert.ok(script.includes('CLOUDFLARE_ACCOUNT_ID: ""'));
});
