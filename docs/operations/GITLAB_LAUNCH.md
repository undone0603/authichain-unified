# GitLab launch runbook

Status: GitLab CI is the live pipeline for this repository while GitHub Actions is billing-locked.
Production deploys run through Cloudflare Workers Builds (see "Live: Cloudflare Workers Builds" below).
The GitLab CI deploy jobs are INERT until the two CI/CD variables below exist.

## What runs today (no credentials needed)

- Scheduled pipelines: `launch_gate` and `production_health` (read-only checks against the public site, seconds each).
- Quality gates (added 2026-10-22, NEXT_ACTIONS N-2). They run on merge requests and on non-default branches, never on default-branch pushes:

  | Job | What it runs | When | Blocks the pipeline |
  | --- | --- | --- | --- |
  | `static_checks` | `check-workflow-cannot-fail`, `check-deploy-invariants`, `check-wrangler-durable-objects` (node and git only, no install) | every merge request and branch | yes |
  | `secret_scan_gate` | gitleaks 8.28.0 over the tree, `.gitleaks.toml`, download verified against the release checksum. No Cloudflare variables needed | every merge request and branch | yes |
  | `node_test_runner_coverage` | `check-node-test-runners` | every merge request and branch | no (warning, red on `main`, see below) |
  | `quality_gate` | `pnpm run lint:ci`, `pnpm run check` (type-check of `worker/`), the whole root Vitest suite (JUnit report), and the node:test suites `lint.yml` runs | merge requests whose diff touches code paths (the list is `.paths_quality` in `.gitlab-ci.yml`) | yes (exit 77 is a warning, see below) |
  | `build_gate` | `next build --webpack` | merge requests that touch `src`, `protocol`, `workers`, `shared`, `public`, `content` or the build config | yes |

  `next.config.js` sets `typescript.ignoreBuildErrors`, so `build_gate` proves the app compiles and bundles; it does not type-check it. The type-check gate covers `worker/` only, because that is the only workspace with a `check` script.
- Still manual and non-blocking (press play in the pipeline): `lint` (now `pnpm run lint:ci`; the old `pnpm run lint` recursed forever, see below), `workspace_check`, `tests` (`turbo test`: it builds `apps/qron-platform` and ran past 15 minutes), `production_build` (superseded by `build_gate` for merge requests; kept for branches with no merge request).
- Install uses the cached pnpm store (`pnpm install --frozen-lockfile --prefer-offline`); no `node_modules` artifact is uploaded (it exceeded the artifact size limit, 413). The gates add `--ignore-scripts` (no husky, no agent-browser native-binary download); the manual jobs keep the plain install.

### Spending the 400 minutes

Measured on 2026-10-22 in a 2 vCPU, 8 GB Linux sandbox, which is the shape of a GitLab.com small shared runner. The sandbox had a warm pnpm store, so install time on GitLab is **not measured**: allow 1 to 3 minutes per installing job.

| Step | Time |
| --- | --- |
| `lint:ci` (eslint + prettier) | 50 s |
| `pnpm run check` | 2 s |
| Root Vitest, whole suite (289 files, 2,882 tests) | 403 to 410 s |
| node:test and tsx suites | about 7 s |
| `next build --webpack` | 441 s |
| `static_checks`, `secret_scan_gate` | seconds each, plus image pull |

So a merge request that changes application code costs roughly 8 minutes for `quality_gate` and 7.5 for `build_gate`, plus two installs: about 20 minutes, or about 19 such pipelines a month. A docs-only or CI-only merge request skips both heavy gates (`.gitlab-ci.yml` itself counts as code, so edits to it do run them). A newer push cancels the older pipeline's running gates (`workflow:auto_cancel`), but a retry still costs a full run.

Controls, none of which needs a commit:

- `GATE_OFF=1` (Settings > CI/CD > Variables) stops every automatic gate. Use it if the month's minutes run low.
- `GATE_SCHEDULE=full` on a pipeline schedule runs all gates against `main` on that schedule; without the variable, existing schedules still run only the launch checks.
- Vitest spends about two thirds of its time creating jsdom environments (289 times, 237 s). Vitest's own hint is `pool: 'vmThreads'` or `isolate: false`. That trades test isolation for time, so it is not changed here; measure it before adopting.

### Known red on `main` (reported as warnings, not hidden)

- `scripts/__tests__/autonomy.test.ts` (2 tests) fails because `.github/workflows/deploy-manufacturer-status.yml` is not classified in `.github/autonomy.json`. The file is the autonomy switchboard, so the lane is the owner's decision (a `workflow_dispatch`-only deploy like it sits next to `deploy-qron-ai-api.yml` and `deploy-govchain-nft-base.yml` in the `manual` lane). `quality_gate` runs that file last and exits 77, which `allow_failure.exit_codes` turns into a warning. Once the workflow is classified, delete `KNOWN_RED_TEST` and the last step.
- `check-node-test-runners` fails because `workers/_shared/estate-qron-resolve.test.ts` and `workers/authichain-com/src/x402-health-route.test.ts` are node:test files that nothing in CI runs. The check reads `.github/workflows` and package `test` scripts, so the fix is there (add them to the `lint.yml` node:test step or to a workspace `test` script). Delete `allow_failure` on `node_test_runner_coverage` when that lands.
- Until the test-only PR that repairs 11 stale tests merges, `quality_gate` is red on `main` itself (4 files, 11 tests: `dpp-fulfill-checkout`, the Stripe webhook route, `app-prefixes`, `x402-get-terms`). With that PR applied the only failures are the two autonomy tests above.

### `pnpm run lint` recurses (found 2026-10-22)

The root `lint` script runs `_lint` (`turbo lint --single-package`), and turbo's `lint` task for the root package runs the root `lint` script again (`turbo lint --single-package --dry=json` prints `lint -> pnpm run _lint`). Each pass forks the next, so it never finishes: in an 8 GB sandbox it was killed (exit 137) after about 100 s with over a hundred processes running. The earlier note that the monorepo-wide lint "ran past 6 minutes" is probably this. The `lint` job here now runs `lint:ci`. The scripts in `package.json` are not changed; making `_lint` call `eslint` directly (or dropping the turbo hop) is the real fix and is the owner's call.

### Not gated here

`pnpm test:contracts` (Hardhat; fetches solc on first run), the `workers/gs1-resolver` node tests (4 s), and a root-level `tsc` (not assessed, and `ignoreBuildErrors` suggests it is not clean). All three are cheap to add once someone decides they should block.

## One owner step to enable deploys

Add these in GitLab: Settings > CI/CD > Variables (masked, protected):

- `CLOUDFLARE_API_TOKEN` - Cloudflare API token limited to Workers Scripts:Edit for this account.
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account id.

## What the deploy jobs do

- `secret_scan` - gitleaks over the tree being deployed (same pinned version as the GitHub workflow).
- `deploy_manufacturer_status` - `wrangler deploy` of `workers/manufacturer-status` on every push to `main`.
- `deploy_authichain_com` - `wrangler deploy` of `workers/authichain-com` when its paths change, or from a manual pipeline (CI/CD > Pipelines > Run pipeline on `main`).

## Intentionally not ported (stay owner-controlled)

- Secret binding steps from `deploy-authichain-com.yml` (Stripe key, x402 pay-to, facilitator, USDC asset).
- Outreach, revenue, autopilot, telegram and payout workers, and every flow gated by `OWNER_LIVE_SEND`, `PAYOUTS_ENABLED`, `DUNNING_ENABLED` or `CONTENT_PUBLISH_MANUAL_LIVE_OK`.
- No GitHub secret values are copied to GitLab. Only the two Cloudflare variables above are needed.

## Live: Cloudflare Workers Builds (no token stored in GitLab)

Since 2026-10-21, Cloudflare Workers Builds deploys from this repository's GitLab `main`. Merge on either side:
GitHub merges reach GitLab through the pull mirror, and GitLab merges reach GitHub through the push mirror.
(Unverified: the 2026-10-22 audit, `docs/execution/BLOCKERS.md` B-2 in PR #1995, found only the pull mirror (`mirror: true`) and no bridge back to GitHub, and decided that GitHub stays primary. Check Settings > Repository > Mirroring repositories before relying on a GitLab merge reaching GitHub.)
A failed build never replaces the live version.

- `authichain-app`, `govchain-us`, `qron-space`: build on pushes to `main` (Markdown and `docs/*` skipped for app and qron-space).
- `authichain-com`: when `workers/authichain-com/**`, `workers/_shared/**`, `content/microsites/**`, `scripts/sync-microsite-packs.mjs`, `src/lib/plans.ts` or `src/lib/checkout-gate.ts` change.
- `gs1-resolver`, `authichain-dashboard`: when their own folder or `workers/_shared/**` changes. `verifier-web`: when `apps/verifier-web/**` changes.
- 28 more workers build only when `workers/<name>/**` changes (Markdown-only changes skipped):
  `authichain-api`, `authichain-api-gateway`, `authichain-gateway`, `authichain-bridge`, `authichain-infra`,
  `authichain-chain-data`, `authichain-license-issuer`, `authichain-qron-provenance`, `authichain-scan-validate`,
  `authichain-verify-worker`, `auth`, `analytics`, `ai-classification`, `bitcoin-auth`, `blockchain`,
  `dpp-fulfillment`, `qron-image-gen`, `strainchain-io`, `chipchain-io`, `fanchain-io`, `glowchain-io`,
  `harvestchain-io`, `luxechain-io`, `partchain-io`, `provenchain-io`, `rxchain-io`, `threadchain-io`,
  `watchchain-io` (deploys the `watchchain-io-vertical` script).
- A change only under `workers/_shared/**` does not redeploy those 28; touch the worker's own folder.

Not connected on purpose:

- `qfs-adapter` (its wrangler.toml forbids it, see #952).
- `manufacturer-status` (never deployed; use the `deploy_manufacturer_status` CI job above for its first deploy).
- Outreach, revenue, autopilot, telegram, agent and payout workers. `authichain-automation` still builds from GitHub.
- If the two CI/CD variables are added later, `deploy_authichain_com` would deploy authichain-com a second time on the same push; disable one of the two.

GitLab trial: the Ultimate trial ends 2026-11-20. Pull mirroring is a paid GitLab feature, so after that GitHub merges stop reaching GitLab.
Before then, upgrade GitLab or reconnect the Workers Builds triggers to GitHub.

## Rollback

Revert the merge request, or run `npx wrangler rollback` for the affected worker.
