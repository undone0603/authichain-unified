# GitLab launch runbook

Status: GitLab CI is the live pipeline for this repository while GitHub Actions is billing-locked.
Deploy jobs are INERT until the two CI/CD variables below exist.

## What runs today (no credentials needed)

- Push pipelines on branches and `main`: install, lint/typecheck, tests (2 shards), build, quality gate.
- Scheduled pipelines: `launch_gate` and `production_health` (read-only checks against the public site).

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

## Alternative with no token stored in GitLab

Cloudflare Workers Builds can connect a GitLab repository directly (Free plan: 3,000 build minutes/month, versus 400 shared-runner minutes/month on GitLab Free).

## Rollback

Revert the merge request, or run `npx wrangler rollback` for the affected worker.
