# Deploy Runbook

One-command paths for the deploy steps that were blocking full launch. All require
a Cloudflare API token; nothing here stores secrets in the repo.

## 0. Get a Cloudflare API token
https://dash.cloudflare.com/profile/api-tokens → Create Token. Permissions:
`Workers Scripts:Edit`, `D1:Edit`, `Workers KV Storage:Edit`, `Workers Routes:Edit`.

```bash
export CLOUDFLARE_API_TOKEN="..."
export CLOUDFLARE_ACCOUNT_ID="4c1869b90f13f86940aa3747839bf420"   # optional; this is the default
```

## 1. Rotate the leaked credentials (do this first — repo is public)
Generate fresh values for everything in `docs/SECURITY-REMEDIATION-CRITICAL.md`, then:

```bash
export RESEND_API_KEY="re_new..."
export SUPABASE_ANON_KEY="eyJ..."
export STRIPE_SECRET_KEY="sk_live_new..."
export STRIPE_WEBHOOK_SECRET="whsec_new..."
export TELEGRAM_BOT_TOKEN="..."
export TELEGRAM_ADMIN_CHAT_ID="..."
bash scripts/rotate-secrets.sh        # pushes only the vars you set
```
Workers not in this repo (`qron-stripe-webhook`, `qron-daily-ops`, `qrontoken-telegram-bot`)
must be updated from the Cloudflare dashboard with the same fresh values. Also revoke
the OpenAI key and Supabase `service_role` key that remain in git history.

## 2. Deploy the 5 ready workers
```bash
bash scripts/deploy-ready-workers.sh                      # all 5
bash scripts/deploy-ready-workers.sh authichain-chain-data  # or one at a time
```
The script applies D1 migrations (idempotent) before each D1-backed worker goes live.

**First-time D1/KV provisioning** (only if a database doesn't exist yet):
`authichain-license-issuer` ships a helper — `bash workers/authichain-license-issuer/scripts/provision.sh`.
For `authichain-qron-provenance` / `authichain-scan-validate` (shared DB `authichain-provenance`):
```bash
cd workers/authichain-qron-provenance
npx wrangler d1 create authichain-provenance   # only if it doesn't exist; paste the id into wrangler.toml
```

### Or deploy via CI
`.github/workflows/deploy-workers.yml` deploys every `workers/*` on push to `main`
(path-filtered) or via **Actions → Deploy Workers → Run workflow** (optionally one worker).
Requires repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## 3. Remaining founder-only items
See `docs/LAUNCH-READINESS-2026-06-23.md` §"Founder-only":
Stripe production keys + email creds in the deploy env, and an SBIR.gov account
for the NSF pitch.

## Per-worker secret reference
| Worker | Secrets |
|--------|---------|
| authichain-autopilot | `RESEND_API_KEY`, `SUPABASE_ANON_KEY` |
| authichain-chain-data | _(none)_ |
| authichain-license-issuer | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_AGENT_BROWSER_PRO_PRICE_ID`, `STRIPE_AGENT_BROWSER_ENTERPRISE_PRICE_ID`, `LICENSE_PRIVATE_KEY_PEM`, `LICENSE_PUBLIC_KEY_PEM`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID` |
| authichain-qron-provenance | _(none; D1 `authichain-provenance`)_ |
| authichain-scan-validate | _(none; D1 `authichain-provenance`)_ |
