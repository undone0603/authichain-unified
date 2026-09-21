# AuthiChain Telegram Worker

Optional Cloudflare Worker bot for AuthiChain product verification via Telegram.

**Mini App HTML lives on the apex worker**, not here:

- https://authichain.com/telegram (alias `/miniapp`)
- BotFather Menu Button URL — works **without** deploying this worker
- Setup: `docs/integrations/telegram-miniapp.md`

Users can send a TruMark™ ID (e.g. `TM-1720000000000-ABCD1234`) directly or via `/verify` to authenticate a registered product. `/start` opens the Passport Mini App (`web_app`) and links live `$49` checkout.

Do **not** set the webhook to `https://authichain.com/api/telegram` (QRON Nightstamp).

## Setup

### 1. Create D1 database and KV namespace

```bash
wrangler d1 create authichain-telegram-db
wrangler kv namespace create SESSIONS
```

Copy the IDs into `wrangler.toml`.

### 2. Run D1 migration

```bash
npm run migrate
```

### 3. Set secrets

```bash
wrangler secret put TELEGRAM_BOT_TOKEN       # from @BotFather
wrangler secret put TELEGRAM_WEBHOOK_SECRET  # any random string
wrangler secret put TELEGRAM_ADMIN_CHAT_ID   # your Telegram user/chat ID
wrangler secret put SITE_URL                 # e.g. https://authichain.com
```

### 4. Deploy

```bash
npm run deploy
```

### 5. Register the webhook

```bash
curl -X POST https://authichain-telegram.<your-subdomain>.workers.dev/api/telegram/setup-webhook \
  -H "Authorization: Bearer <TELEGRAM_WEBHOOK_SECRET>"
```

## Architecture

```
src/
  index.ts                    Worker entrypoint + Env interface
  miniapp.ts                  Mini App URL, /start markup, setChatMenuButton payload
  utils/
    router.ts                 Tiny method+path route matcher
    crypto.ts                 X-Telegram-Secret-Token verification
  services/
    telegram.ts               Typed Telegram Bot API wrapper
    db.ts                     D1 message logging + KV session helpers
    commands.ts               /start /help /verify /status + admin gate
    inline.ts                 Inline query handler (live TruMark lookup)
    admin.ts                  Admin notifications + daily digest helper
  routes/
    telegram-webhook.ts       POST /api/telegram/webhook
    telegram-setup.ts         POST /api/telegram/setup-webhook (+ Menu Button)
migrations/
  0001_initial.sql            messages table
```

## Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `TELEGRAM_BOT_TOKEN` | Secret | Bot API auth |
| `TELEGRAM_WEBHOOK_SECRET` | Secret | Request signature validation |
| `TELEGRAM_ADMIN_CHAT_ID` | Secret | Admin-only commands |
| `SITE_URL` | Secret | AuthiChain API base URL for live verification |
| `MINIAPP_URL` | Var | Default `https://authichain.com/telegram` |
| `DATABASE` | D1 | Message logs |
| `SESSIONS` | KV | User session state (24h TTL) |
