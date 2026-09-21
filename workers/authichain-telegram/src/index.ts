import { router } from './utils/router'
import { telegramWebhook } from './routes/telegram-webhook'
import { setupWebhook } from './routes/telegram-setup'
import { DEFAULT_MINIAPP_URL } from './miniapp'

export interface Env {
  TELEGRAM_BOT_TOKEN: string
  TELEGRAM_WEBHOOK_SECRET: string
  TELEGRAM_ADMIN_CHAT_ID: string
  SITE_URL: string
  /** Optional override. Default is the apex Mini App on authichain.com. */
  MINIAPP_URL?: string
  /** Optional. If unset, setup-webhook uses this worker's own origin. */
  TELEGRAM_WEBHOOK_URL?: string
  DATABASE: D1Database
  SESSIONS: KVNamespace
}

function redirectMiniApp(): Response {
  return Response.redirect(DEFAULT_MINIAPP_URL, 302)
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return router(request, env, ctx, [
      ['GET', '/', redirectMiniApp],
      ['GET', '/telegram', redirectMiniApp],
      ['POST', '/api/telegram/webhook', telegramWebhook],
      ['POST', '/api/telegram/setup-webhook', setupWebhook],
    ])
  },
}
