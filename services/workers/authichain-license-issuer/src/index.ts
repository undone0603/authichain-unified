import { router } from './utils/router'
import { stripeWebhook } from './routes/stripe-webhook'
import { licenseVerify } from './routes/license-verify'
import { licenseRevoke } from './routes/license-revoke'

export interface Env {
  // Stripe
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  STRIPE_AGENT_BROWSER_PRO_PRICE_ID: string
  STRIPE_AGENT_BROWSER_ENTERPRISE_PRICE_ID: string

  // License signing (ECDSA P-256 PEM, set via wrangler secret)
  LICENSE_PRIVATE_KEY_PEM: string
  LICENSE_PUBLIC_KEY_PEM: string

  // Telegram (reuses auth token from the main bot)
  TELEGRAM_BOT_TOKEN: string
  TELEGRAM_ADMIN_CHAT_ID: string

  // Persistence
  DATABASE: D1Database   // license records
  SESSIONS: KVNamespace  // short-lived delivery tokens
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return router(request, env, ctx, [
      ['POST', '/api/license/stripe-webhook', stripeWebhook],
      ['GET',  '/api/license/verify',         licenseVerify],
      ['POST', '/api/license/revoke',          licenseRevoke],
    ])
  },
}
