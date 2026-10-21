# GitLab launch runbook

Status: GitLab CI is the live pipeline for this repository while GitHub Actions is billing-locked.
Production deploys run through Cloudflare Workers Builds (see "Live: Cloudflare Workers Builds" below).
The GitLab CI deploy jobs are INERT until the two CI/CD variables below exist.

## What runs today (no credentials needed)

- Scheduled pipelines: `launch_gate` and `production_health` (read-only checks against the public site, seconds each).
- Push pipelines: nothing heavy runs automatically. GitLab Free gives 400 shared-runner minutes/month and the monorepo-wide lint alone ran past 6 minutes, so `lint`, `workspace_check` (`pnpm run check`), `tests` (`pnpm run test`) and `production_build` are manual, non-blocking jobs: open the pipeline and press play.
- Install uses the cached pnpm store (`pnpm install --frozen-lockfile --prefer-offline`); no `node_modules` artifact is uploaded (it exceeded the artifact size limit, 413).

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
