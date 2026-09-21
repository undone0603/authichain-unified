# ARCHIVED — authichain-telegram (webhook only)

The **Passport Mini App** is not archived. It is served from `authichain-com` at `/telegram`. See `STATUS.md` and `docs/integrations/telegram-miniapp.md`.

This worker remains the optional `/start` + `/verify` webhook (D1 + KV). It is not required to attach a BotFather Menu Button to `https://authichain.com/telegram`.

**To deploy the webhook:** `wrangler secret put TELEGRAM_BOT_TOKEN` then `wrangler deploy` from this directory (free Workers plan). Then `POST /api/telegram/setup-webhook`. Do not point the webhook at `https://authichain.com/api/telegram`.
