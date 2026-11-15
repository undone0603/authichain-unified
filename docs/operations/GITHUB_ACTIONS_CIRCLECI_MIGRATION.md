# GitHub Actions → CircleCI: bounded offline migration

Updated 2026-11-14. This is a controlled **test execution migration**, not a transfer
of job history, GitHub environment secrets, deployment approvals, or release authority.

## Directly executable on the six existing CircleCI jobs

| Existing GitHub Actions source | CircleCI job | Evidence equivalent |
|---|---|---|
| `main.yml` / `lint.yml` (root Vitest) | `test-other` | `pnpm exec vitest run`, in addition to existing filtered workspace tests |
| `windows-path-safety.yml` | `quality` | Exact `scripts/check-windows-paths.sh` index scan |
| `security-scan.yml` on PR/push | `quality` | Gitleaks 8.28.0 tree scan with GitHub-release SHA-256 pin, redacted output |
| `agentz-mcp-verify.yml` | `extras`, `test-workers` | All `tests/test_agentz_*.py` (including its 5 focused Python files), MCP registration import, existing edge/scheduler Node suites |
| `agentz-ci.yml` | `extras` | `agentz/tests`, `tests/test_agentz_*.py`, TinyFish dry-run and missing-key negative test, audit proof |
| `ci.yml` | `extras` | Drizzle migrations and AgentZ Python tests already present; expanded Python coverage |
| `typecheck-ratchet.yml` | `typecheck-ratchet` | Existing exact-head `node scripts/typecheck-ratchet.mjs` |
| `main.yml` (workspace) | `quality`, `test-other`, `build`, `test-workers` | Existing pnpm check, lint, workspace test, build, policy guard |

Each CircleCI job checks `git rev-parse HEAD == CIRCLE_SHA1`; the protected
`ci/circleci: main-quality-gate` only succeeds after all six jobs pass.
The Docker executor, `large` resource class, per-job wall-clock limits,
credential-free configuration and absence of production contexts are retained.
No new CircleCI executors or jobs were added. Existing jobs may consume more
credits as additional tests run; do not promise a 5,000-credit reserve without
independently checking CircleCI billing/usage.

## Explicit exclusions: not equivalently runnable on CircleCI yet

- **CodeQL:** `github/codeql-action` plus GitHub-managed code-security
  state cannot be recreated by claiming generic lint or Gitleaks as a
  CodeQL analysis. Keep CodeQL reporting separate until a tested offline
  CodeQL CLI or equivalent scans all three configured languages.
- **Hardhat contract tests:** path-scoped `contract-tests.yml` is not yet
  moved. Solc download/caching and its trigger conditions require a bounded
  non-secret proof before adding it to an existing executor.
- **Gitleaks weekly history scan:** this migration mirrors the PR/push
  worktree scan, not the Monday full Git history scan.
- **Hosted-scheduled operating loops:** scheduling, notification routing,
  GitHub issue mutation, and their external-effect policies cannot be
  transplanted merely by copying steps. Handle them individually.
- **GitHub branch protection, `production-cloudflare` credentials, protected
  environment approvals, release dispatch, billing/Stripe, secret binding,
  repository mutation, production Worker deployment:** remain in their
  governed systems. Never copy those secrets to a PR CircleCI context.

## Transition rules

1. Do not cancel/retrigger already successful GitHub or CircleCI jobs.
2. Evaluate the **new exact PR head** through all seven CircleCI statuses.
   Any failed new test blocks merge; do not report a skipped test as success.
3. Do not disable GitHub workflows or change required checks before
   verified CircleCI parity. A billing-locked GitHub Actions job is neither
   test evidence nor proof of a code defect.
4. Preserve manual/protected production releases. No deployment on CI merge.
5. Follow up with a separately reviewed migration for non-portable jobs and
   schedule parity. An unverified credential stays unverified even if the
   code checks pass.

Implementation lives in `.circleci/quality-check.sh` and
`.circleci/gitleaks-check.sh`; the six-job aggregation remains in
`.circleci/config.yml`.
