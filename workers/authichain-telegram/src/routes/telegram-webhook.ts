import { verifySecret } from '../utils/crypto'
import { Telegram } from '../services/telegram'
import { handleCommand } from '../services/commands'
import { handleInline } from '../services/inline'
import { DB, type TelegramUpdate } from '../services/db'
import type { Env } from '../index'

export async function telegramWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  if (!verifySecret(request, env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response('Unauthorized', { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = await request.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  const telegram = new Telegram(env.TELEGRAM_BOT_TOKEN)

  // Log all updates asynchronously — never blocks response
  ctx.waitUntil(DB.logMessage(env, update))

  if (update.inline_query) {
    return handleInline(env, telegram, update)
  }

  if (update.message?.text) {
    return handleCommand(env, telegram, update)
  }

  // Acknowledge all other update types (edited messages, reactions, etc.)
  return new Response('OK')
}
