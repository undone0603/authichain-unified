# Deploy Runbook

One-command paths for the deploy steps that were blocking full launch. Cloudflare
is the only active deploy target; nothing here stores secrets in the repo.

## 0. Get a Cloudflare API token

https://dash.cloudflare.com/profile/api-tokens → Create Token. Permissions:
`Workers Scripts:Edit`, `D1:Edit`, `Workers KV Storage:Edit`, `Workers Routes:Edit`,
`Zone.Cache Purge` (zone `authichain.com` — required for Actions → Purge Cloudflare cache).

```bash
export CLOUDFLARE_API_TOKEN="..."
export CLOUDFLARE_ACCOUNT_ID="4c1869b90f13f86940aa3747839bf420"   # optional; this is the default
export NEXT_PUBLIC_APP_URL="https://authichain.com"
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

For the root Cloudflare deploy workflow, also set the repository variable
`CLOUDFLARE_DEPLOY_ENABLED=true`. Scheduled GitHub Actions that call internal
cron endpoints use `vars.APP_URL` (defaults to `https://authichain.com`) and
`CRON_SECRET`; no Vercel secrets are required.

`deploy-cloudflare.yml` publishes `authichain-edge-router` from `worker-app/`.
`pnpm run build` is Next (`next build --webpack`) and does **not** emit repo-root
`dist/`; the workflow stubs `dist/` so wrangler `assets.directory` exists. JWKS
is served by the Worker script, not those assets.

## 3. Remaining founder-only items

See `docs/operations/LAUNCH-READINESS-2026-06-23.md` §"Founder-only":
Stripe production keys + email creds in the deploy env, and an SBIR.gov account
for the NSF pitch.

Bind `AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64` on `authichain-edge-router` after
that worker publishes, or `GET /.well-known/jwks.json` returns 503.

## 4. Cache Purge is a 401 — do not wait on it

`CLOUDFLARE_API_TOKEN` returns `10000 Authentication error` on
`POST /zones/.../purge_cache`. Do **not** block launch on Zone.Cache Purge.

Live JWKS (never cached as landing HTML):

`GET https://authichain.com/protocol/jwks.json`

Canonical `/.well-known/jwks.json` stays HIT HTML until someone Custom-Purges
in the dashboard. Same for `/api/checkout/dpp`.

Attestation key: `deploy-cloudflare.yml` runs `wrangler secret put
AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64` after publish (Workers Scripts:Edit
already works). If the GitHub secret is set, that value is used; otherwise a
v0.1 Ed25519 key is generated once and stored only on the worker.

## 5. Production launch proof (no private key in Actions)

The Worker private key is never copied into GitHub Actions. Launch proof:

1. `GET https://authichain.com/protocol/issuer.json` — public readiness (`ready`, `signing`, `kid`).
2. `POST https://authichain.com/protocol/launch-proof` — constrained v0.1 JWS. Auth is a GitHub Actions OIDC token (`aud=https://authichain.com`, repo `undone0603/authichain-unified`) or `Authorization: Bearer $CRON_SECRET`.
3. CI independently verifies the compact JWS against live JWKS. Tamper tests stay local.

`AUTHICHAIN_ATTESTATION_KEY_ID` must match the live JWKS kid. `AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64` in Actions is optional.

## Per-worker secret reference

| Worker                     | Secrets                                                                                                                                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| authichain-autopilot       | `RESEND_API_KEY`, `SUPABASE_ANON_KEY`                                                                                                                                                                                              |
| authichain-chain-data      | _(none)_                                                                                                                                                                                                                           |
| authichain-license-issuer  | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_AGENT_BROWSER_PRO_PRICE_ID`, `STRIPE_AGENT_BROWSER_ENTERPRISE_PRICE_ID`, `LICENSE_PRIVATE_KEY_PEM`, `LICENSE_PUBLIC_KEY_PEM`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID` |
| authichain-qron-provenance | _(none; D1 `authichain-provenance`)_                                                                                                                                                                                               |
| authichain-scan-validate   | _(none; D1 `authichain-provenance`)_                                                                                                                                                                                               |
| authichain-agentz          | `AGENT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (alias `SUPABASE_SERVICE_KEY`; names used by `agentz.core.credentials.get`)                                                                                            |
| authichain-openclaw        | `OPENCLAW_GATEWAY_URL` (owner-set reachable host), `OPENCLAW_API_KEY`, `AGENTZ_API_KEY` (`AGENT_SECRET`). `AGENTZ_API_URL` defaults to `https://agentz.authichain.com`                                                             |
