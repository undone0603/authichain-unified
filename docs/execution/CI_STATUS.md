# CI status

Evidence date: 2026-10-22. Commit under test: `main` `caf0f083` plus branch `fix/p1-dpp-fulfill-test-cas-mock`.

## Local baseline (root vitest config, sandbox, Node 22, pnpm 10.28.2)

| Suite                                                                                      | Before fixes (`main`)                                    | After fixes (branch)                                |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------- | --------------------------------------------------- |
| `src` + `protocol` (`npx vitest run src protocol`)                                         | 4 files failed; 11 tests failed, 1,271 passed, 1 skipped | 159 files passed; 1,286 passed, 1 skipped, 0 failed |
| Checkout gate and attestation (4 files)                                                    | 48 passed                                                | 48 passed                                           |
| `src` + `protocol` with !1998 and !1999 (Launch gate removed, 2 new tests)                 | n/a                                                      | 159 files passed; 1,288 passed, 1 skipped, 0 failed |
| Stripe webhook, verify-worker, dpp-fulfillment (7 files)                                   | 68 passed                                                | 68 passed                                           |
| `agentz/tests` (Python venv from `requirements-agentz.txt` plus pytest and pytest-asyncio) | not run                                                  | 284 passed, 1 skipped, 0 failed                     |

All 11 failures were **pre-existing on `main`** (stale tests, not regressions from this work) and none
was a production defect:

| Failing tests                                                                                                                                        | Root cause                                                                                                                                                                                            | Fix (test-only)                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 9 in `src/lib/dpp-fulfill-checkout.test.ts` (`q.eq is not a function`, `q.is is not a function`)                                                     | `ef4d083e` (2026-10-16, CFA-346) made the entitlement write a compare-and-set update in `src/lib/provisioning.ts` (`update().eq().is()/eq().select()`); the test's fake query builder could not chain | Make the mock's `update()` chain awaitable and report one matched row    |
| 1 in `src/app/api/stripe/webhook/route.test.ts` (unpaid session)                                                                                     | `ae38cf56` (2026-10-19) holds `payment_status: "unpaid"` before the Starter amount fallback, logging `stripe_grant_held_unpaid`; the test expected the older refusal warning                          | Assert the hold log and that `provisionPurchase` is not called           |
| 1 test in `workers/authichain-com/src/app-prefixes.test.ts`, and `x402-get-terms.test.ts`, which failed to load (a failed file with no failed tests) | Tests read `wrangler.toml` with `new URL(..., import.meta.url)` under the root jsdom environment                                                                                                      | Add `// @vitest-environment node` (existing convention in 7 other files) |

Type check: the four touched files produce no `tsc` diagnostics. A full-project `tsc` result was not assessed.

## Full baselines (NEXT_ACTIONS N-6, 2026-10-22)

Sandbox with the shape of a GitLab small shared runner: 2 vCPU, 8 GB, Node 22, pnpm 10.28.2, install with `--ignore-scripts` from a warm store.
Tree: `fix/p1-dpp-fulfill-test-cas-mock` at `3076434` (`main` `caf0f083` plus the six commits).

| Command                                                                                   | Result                                                                                                 | Time           |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------- |
| `pnpm exec vitest run` (the root suite, as `lint.yml` runs it)                            | 289 files: 2,879 passed, 1 skipped, **2 failed** (both in `scripts/__tests__/autonomy.test.ts`)        | 403 s          |
| `pnpm run lint:ci`                                                                        | pass: 0 eslint errors, 404 warnings, prettier clean                                                    | 50 s           |
| `pnpm run lint`                                                                           | **never terminates** (recursive script, below); killed with exit 137 after about 100 s                 | n/a            |
| `pnpm run check`                                                                          | pass; only `authichain-worker` has a `check` script (`tsc --noEmit`)                                   | 2 s            |
| `pnpm run build` (`next build --webpack`)                                                 | pass on attempt 1 of 3, "Compiled with warnings", 350 static pages                                     | 441 s          |
| `pnpm run test` (`turbo test`)                                                            | 18 of 19 tasks passed; killed at 900 s while building `apps/qron-platform` (`test` depends on `build`) | over 900 s     |
| node:test suites named in `lint.yml` (`node --test` 167, `tsx --test` 23)                 | pass                                                                                                   | about 7 s      |
| `workers/gs1-resolver` tests                                                              | pass                                                                                                   | 4 s            |
| `pnpm test:contracts` (Hardhat)                                                           | 6 passing                                                                                              | 6 s            |
| `check-workflow-cannot-fail`, `check-deploy-invariants`, `check-wrangler-durable-objects` | pass                                                                                                   | under 1 s each |
| `check-node-test-runners`                                                                 | **fail** (below)                                                                                       | under 1 s      |
| gitleaks 8.28.0, `.gitleaks.toml`, working tree                                           | no leaks                                                                                               | 8 s            |

New failures found by running the whole suite (all pre-existing on `main`, none a production defect):

1. **`scripts/__tests__/autonomy.test.ts`, 2 tests.** `.github/workflows/deploy-manufacturer-status.yml` exists (106 workflow files) but is not
   classified in `.github/autonomy.json` (105 are). It is `workflow_dispatch` only, which matches the `manual` lane that holds
   `deploy-qron-ai-api.yml` and `deploy-govchain-nft-base.yml`. `.github/autonomy.json` is the autonomy switchboard, so the lane is the owner's decision
   (NEXT_ACTIONS N-12); nothing was edited.
2. **`check-node-test-runners` fails.** `workers/_shared/estate-qron-resolve.test.ts` and `workers/authichain-com/src/x402-health-route.test.ts` are
   node:test files that no CI step runs (N-13).
3. **`pnpm run lint` recurses.** The root `lint` script runs `_lint` (`turbo lint --single-package`); turbo's `lint` task for the root package runs the
   root `lint` script again (`turbo lint --single-package --dry=json` prints `lint -> pnpm run _lint`), so each pass forks the next. The GitLab `lint`
   job ran it, which is probably the "ran past 6 minutes" in `docs/operations/GITLAB_LAUNCH.md`. `lint:ci` is the working command (N-11).
4. `next.config.js` sets `typescript.ignoreBuildErrors`, so a passing build proves compilation and bundling, not types. A root-level `tsc` was not assessed.

Side effects of running these commands in a checkout, restored and not committed: `turbo` appends a "Turborepo agent rules" block to `AGENTS.md` when it
detects an agent, and `pnpm test:contracts` deletes the tracked `artifacts/contracts/AuthiChainNFT.sol/AuthiChainNFT.json` and writes untracked
`artifacts/` and `cache/` files.

## GitLab CI as configured on `main`

`.gitlab-ci.yml` stages: validate, test, build, verify, deploy.

- `lint`, `workspace_check`, `tests`, `production_build`: **manual, `allow_failure: true`**, never on schedule or MR
  (400 shared-runner minutes per month budget, per the file header).
- `launch_gate`, `production_health`, `dogfood_record`: **run automatically on the two schedules** (06:20 and 18:20 UTC);
  manual otherwise. `production_health` makes read-only requests to `https://authichain.com`.
- `secret_scan` and the Cloudflare deploy jobs only run when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exist
  as CI variables. Without them there is **no secret scan on any pipeline**.

Observed pipelines (latest 30): 9 `duo_workflow` success, 11 `push` skipped, 6 `push` failed, 2 `push` success,
1 canceled, 1 `web` success. The newest failures are `main` @ `caf0f083` (pipeline `2974628977`) and five on
`phase-f-dogfood`. `main` pipeline `2974628977` is red only because of the external commit status `Workers Builds: govchain-us` (Cloudflare); its 8 CI
jobs are all manual and did not run. The `phase-f-dogfood` failures were not examined (BLOCKERS B-5).

## GitHub checks on PRs #1995 and #1996 (2026-10-22)

All 11 checks on each PR (Typecheck and lint, Tests shards 1 and 2, Production build, lint, Typecheck ratchet, Schema and AgentZ checks, Main
quality gate) failed within 2 to 4 seconds. The job annotation reads "The job was not started because your account is locked due to a billing
issue." These are not test results (BLOCKERS B-4). Local runs in this document remain the only test evidence for both PRs.

## Gaps found

1. **The GitLab `tests` job does not run the main suite.** It runs `pnpm run test`, which is `turbo test --filter=!.`.
   That reaches only the 9 workspace packages that define a `test` script, not the root vitest suite
   (159 files under `src` and `protocol` alone). GitHub's `lint.yml` line 75 runs `pnpm exec vitest run`; GitLab has no equivalent.
   The three failure groups above were therefore not caught by GitLab CI, and GitHub's full-suite run cannot execute while
   Actions is billing-locked (issue #1871).
2. **No security stage in normal pipelines** (see `secret_scan` condition above) and no dependency-audit job.
3. **Docs disagree with config.** `AUTHICHAIN_EXECUTION_PLAN.md` says `launch_gate`, `production_health` and `dogfood_record`
   are Manual jobs under `humanHold=true`. The file shows them scheduled-automatic. `humanHold` is a Stripe grant flag
   (`workers/stripe-webhook/src/grant-map.ts`), not a CI setting. The plan file was not edited here.
4. Worker packages (`stripe-webhook`, `authichain-verify-worker`, `dpp-fulfillment`) have test files but no `test` script,
   so they only run through the root config.

## Gates (drafted in PR #1997, not yet run on GitLab)

The whole root suite takes 403 s, not the 2 minutes estimated earlier for `src` and `protocol` alone. PR #1997 adds merge-request gates sized for the
400-minute budget: `static_checks`, `secret_scan_gate` (no Cloudflare variables), `quality_gate` (`lint:ci`, `check`, the root suite, the node:test
suites) and `build_gate`. It reports the two autonomy tests as a warning (exit 77) instead of going red. Its script was executed locally from the YAML:
exit 77 on this branch, red on bare `main` until #1995 merges. NEXT_ACTIONS N-2 stays open until a real GitLab pipeline id is recorded here.
