# StrainChain Passport Telegram Mini App

**Brand:** AuthiChain (not “StrainChain Technologies Inc.”).
**Legal entity:** ZACHARY KIETZMAN.
**Money:** Passport $49 via live Stripe `GET /api/checkout/plan/strainchain_passport`.
**Cost:** $0 ads / no Workers Paid / no Telegram Stars. Menu Button is enough.

The May 2025 strainchain-telegram-app PDFs (Inc, $8M Series A, NFT-forward) are archival. Do not ship those claims in bot copy or the Mini App.

## Live URLs (after `authichain-com` deploy)

| Role | URL |
|---|---|
| Mini App (BotFather Menu Button) | https://authichain.com/telegram |
| Alias | https://authichain.com/miniapp |
| Passport checkout | https://authichain.com/api/checkout/plan/strainchain_passport |
| Pricing | https://authichain.com/pricing |
| Verify | https://authichain.com/verify |
| Genetics / passport pages | https://authichain.com/genetics · https://authichain.com/passport |

`/telegram` is served by `workers/authichain-com` (apex + www routes). Preview it in a normal browser; Telegram loads the same HTML in a WebView.

Do **not** point a StrainChain webhook at `https://authichain.com/api/telegram` — that is the QRON Nightstamp handler (`src/app/api/telegram/route.ts`).

## What already exists in `workers/authichain-telegram`

| Piece | Status |
|---|---|
| `POST /api/telegram/webhook` | Implemented: `/start`, `/help`, `/status`, `/verify`, TruMark auto-detect, inline query |
| `POST /api/telegram/setup-webhook` | Implemented: `setWebhook`, `setMyCommands`, **`setChatMenuButton`** (Passport Mini App) |
| `/start` keyboard | `web_app` + live `$49` checkout URL |
| Static Mini App HTML | **Not in this worker** — hosted on authichain.com |
| Cloudflare deploy | Never recorded. Optional. Free plan is enough |

`/start` no longer advertises QRON broadcast/channel templates.

## BotFather — required owner steps

A token is **not** required for the Mini App HTML to go live. It **is** required to attach the Menu Button to a bot and to run `/start` / `/verify`.

This repo’s credential map may already store `TELEGRAM_AUTHICHAINBOT_TOKEN`. Do not invent a token. If GitHub / Cloudflare secrets are empty, create or reuse a bot and paste the token yourself.

### 1. Create or reuse the bot

1. Open [@BotFather](https://t.me/BotFather).
2. `/newbot` **or** `/mybots` and pick the existing AuthiChain bot.
3. Copy the token once. Store it as:
   - GitHub Actions secret `TELEGRAM_BOT_TOKEN` (used by `content-publish.yml`)
   - Cloudflare: `wrangler secret put TELEGRAM_BOT_TOKEN` in `workers/authichain-telegram`
4. Suggested name/username: AuthiChain / a `@…_bot` you control. Description: “StrainChain Passport — publish one cultivar for $49.”

### 2. Menu Button / Mini App URL (no worker, $0)

This is the launch path.

1. @BotFather → `/mybots` → your bot → **Bot Settings** → **Menu Button**.
2. Configure menu button URL: `https://authichain.com/telegram`
3. Button text: `Passport`

Or, with the token (replace `BOT_TOKEN`, never commit it):

```bash
curl -sS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton" \
  -H 'Content-Type: application/json' \
  -d '{"menu_button":{"type":"web_app","text":"Passport","web_app":{"url":"https://authichain.com/telegram"}}}'
```

Optional: `/setdomain` / Bot Settings → Domain to `authichain.com` if BotFather asks for a Mini App domain.

### 3. Optional webhook (chat commands)

Only if you want `/verify` in chat. Free Workers plan; no paid add-ons.

```bash
cd workers/authichain-telegram
# secrets — do not commit values
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_WEBHOOK_SECRET   # random string you choose
wrangler secret put TELEGRAM_ADMIN_CHAT_ID
wrangler secret put SITE_URL                  # https://authichain.com

wrangler deploy
```

Then register the webhook **on this worker’s origin** (workers.dev or a route you add later):

```bash
curl -sS -X POST "https://<this-worker-host>/api/telegram/setup-webhook" \
  -H "Authorization: Bearer ${TELEGRAM_WEBHOOK_SECRET}"
```

`setup-webhook` now:

- `setWebhook` → `{origin}/api/telegram/webhook` (override with `TELEGRAM_WEBHOOK_URL` if needed)
- `setMyCommands` → start / verify / help / status
- `setChatMenuButton` → `MINIAPP_URL` (default `https://authichain.com/telegram`)

Do not enable Cloudflare Workers Paid, Queues, or Containers for this bot.

## Manual checks

1. Open https://authichain.com/telegram in a browser. Primary button goes to Passport checkout (303 → Stripe).
2. Submit an empty TruMark field → https://authichain.com/verify. A filled id → `/verify/<id>`.
3. After Menu Button is set: open the bot in Telegram → menu → Mini App → same checkout.
4. Confirm copy has no Inc / Series A / calendly / “book a call”.

## Secrets checklist (owner)

| Name | Where | Required for |
|---|---|---|
| `TELEGRAM_AUTHICHAINBOT_TOKEN` | AgentZ credential map (if present) | Source of the BotFather token |
| `TELEGRAM_BOT_TOKEN` | GitHub Actions + CF worker secret | Menu Button API, webhook, content-publish |
| `TELEGRAM_WEBHOOK_SECRET` | CF worker secret | Webhook auth |
| `TELEGRAM_ADMIN_CHAT_ID` | CF worker secret | `/admin` only |
| `SITE_URL` | CF worker secret / var | TruMark lookup base (`/api/verify/...`) |

If the token is missing, ship the HTML PR anyway and leave this file as the owner step.
