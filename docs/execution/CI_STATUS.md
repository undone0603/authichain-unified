# CI status

Evidence date: 2026-10-22. Commit under test: `main` `caf0f083` plus branch `fix/p1-dpp-fulfill-test-cas-mock`.

## Local baseline (root vitest config, sandbox, Node 22, pnpm 10.28.2)

| Suite | Before fixes (`main`) | After fixes (branch) |
| ----- | --------------------- | -------------------- |
| `src` + `protocol` (`npx vitest run src protocol`) | 4 files failed; 11 tests failed, 1,271 passed, 1 skipped | 159 files passed; 1,286 passed, 1 skipped, 0 failed |
| Checkout gate and attestation (4 files) | 48 passed | 48 passed |
| `src` + `protocol` with !1998 and !1999 (Launch gate removed, 2 new tests) | n/a | 159 files passed; 1,288 passed, 1 skipped, 0 failed |
| Stripe webhook, verify-worker, dpp-fulfillment (7 files) | 68 passed | 68 passed |

All 11 failures were **pre-existing on `main`** (stale tests, not regressions from this work) and none
was a production defect:

| Failing tests | Root cause | Fix (test-only) |
| ------------- | ---------- | --------------- |
| 9 in `src/lib/dpp-fulfill-checkout.test.ts` (`q.eq is not a function`, `q.is is not a function`) | `ef4d083e` (2026-10-16, CFA-346) made the entitlement write a compare-and-set update in `src/lib/provisioning.ts` (`update().eq().is()/eq().select()`); the test's fake query builder could not chain | Make the mock's `update()` chain awaitable and report one matched row |
| 1 in `src/app/api/stripe/webhook/route.test.ts` (unpaid session) | `ae38cf56` (2026-10-19) holds `payment_status: "unpaid"` before the Starter amount fallback, logging `stripe_grant_held_unpaid`; the test expected the older refusal warning | Assert the hold log and that `provisionPurchase` is not called |
| 2 in `workers/authichain-com` (`x402-get-terms`, `app-prefixes`) | Tests read `wrangler.toml` with `new URL(..., import.meta.url)` under the root jsdom environment | Add `// @vitest-environment node` (existing convention in 7 other files) |

Type check: the four touched files produce no `tsc` diagnostics. A full-project `tsc` result was not assessed.

**Not run yet:** `pnpm test` (turbo), `pnpm lint`, `pnpm build`, `agentz/tests` (Python), `pnpm test:contracts`,
`workers/gs1-resolver` node tests, `*.node-test.mjs` files.

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

## Proposed change (not yet made)

Add a GitLab job that runs `pnpm exec vitest run src protocol workers` (about 2 minutes of test time locally; install and
cache extra), triggered on merge requests that touch those paths and on schedule, so it stays within the minute budget.
Tracked as NEXT_ACTIONS N-2.
