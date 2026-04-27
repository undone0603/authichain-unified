import { router } from './utils/router'
import { telegramWebhook } from './routes/telegram-webhook'
import { setupWebhook } from './routes/telegram-setup'

export interface Env {
  TELEGRAM_BOT_TOKEN: string
  TELEGRAM_WEBHOOK_SECRET: string
  TELEGRAM_ADMIN_CHAT_ID: string
  SITE_URL: string
  DATABASE: D1Database
  SESSIONS: KVNamespace
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return router(request, env, ctx, [
      ['POST', '/api/telegram/webhook', telegramWebhook],
      ['POST', '/api/telegram/setup-webhook', setupWebhook],
    ])
  },
}
