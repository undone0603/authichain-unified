# Status: MINIAPP-READY — landing HTML on authichain.com; bot worker optional

**Updated:** 2026-09-20
**Decided:** 2026-04-27 (ecosystem-consolidation Phase 3.3) as SCAFFOLDED / archived
**Cloudflare deployments:** none found under name `authichain-telegram`

## What is live after `authichain-com` deploys

| Surface | URL | Needs bot token? |
|---|---|---|
| Telegram Mini App (Menu Button target) | `https://authichain.com/telegram` (alias `/miniapp`) | No |
| Passport checkout CTA | `https://authichain.com/api/checkout/plan/strainchain_passport` (303 Stripe) | No |
| TruMark / product verify | `https://authichain.com/verify` and `/verify/<id>` | No |

The Mini App is static HTML/JS on the apex worker (`workers/authichain-com`). It does not use Workers Paid, ads, or Telegram Stars. Passport money is the existing Stripe rail.

## What this worker still does (optional webhook)

Substantive `/start`, `/verify`, inline TruMark lookup, D1 + KV — **never deployed**. Use it only if you want chat commands in addition to the Menu Button.

Do **not** register the webhook as `https://authichain.com/api/telegram` — that path is the QRON Nightstamp Next.js route.

Webhook, when this worker is deployed, is `{this-worker-origin}/api/telegram/webhook`. `setChatMenuButton` and `/start` `web_app` both point at `https://authichain.com/telegram`.

## Owner step — BotFather token

This session could not read GitHub Actions secrets (403) and found no `TELEGRAM_*` values in the environment. Do **not** invent a token.

Credential map name (if present in AgentZ): `TELEGRAM_AUTHICHAINBOT_TOKEN`.

Repo / worker names to set when you have the BotFather token:

- GitHub Actions: `TELEGRAM_BOT_TOKEN` (already referenced by `content-publish.yml`)
- Cloudflare worker `authichain-telegram`: `wrangler secret put TELEGRAM_BOT_TOKEN`
- Also: `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_ADMIN_CHAT_ID`, `SITE_URL=https://authichain.com`

**Menu Button works without deploying this worker.** In @BotFather → Bot Settings → Menu Button → set URL `https://authichain.com/telegram`.

Full steps: `docs/integrations/telegram-miniapp.md`.

## Optional deploy of this worker (free Workers plan)

1. Confirm D1 / KV ids in `wrangler.toml` (already present).
2. `wrangler secret put TELEGRAM_BOT_TOKEN` (and the other secrets above).
3. `wrangler deploy` from this directory, **or** wait for `.github/workflows/deploy-workers.yml` on `main` (this worker is already in the matrix).
4. `POST /api/telegram/setup-webhook` with `Authorization: Bearer <TELEGRAM_WEBHOOK_SECRET>` — registers webhook on **this** origin, sets commands, `setChatMenuButton`.

Do not enable Workers Paid add-ons.

Refs: `docs/integrations/telegram-miniapp.md`, `docs/superpowers/plans/worker-status-2026-04-27.md`
