import { Telegram } from '../services/telegram'
import type { Env } from '../index'
import { menuButtonPayload, miniAppUrl, webhookUrlFrom } from '../miniapp'

export async function setupWebhook(request: Request, env: Env): Promise<Response> {
  const auth = request.headers.get('Authorization')
  if (auth !== `Bearer ${env.TELEGRAM_WEBHOOK_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const telegram = new Telegram(env.TELEGRAM_BOT_TOKEN)
  const webhookUrl = webhookUrlFrom(request, env)
  const webAppUrl = miniAppUrl(env)

  await telegram.call('setWebhook', {
    url: webhookUrl,
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ['message', 'inline_query', 'edited_message', 'callback_query'],
    drop_pending_updates: true,
  })

  // Set bot commands so they show up in the Telegram UI
  await telegram.call('setMyCommands', {
    commands: [
      { command: 'start', description: 'Open StrainChain Passport ($49)' },
      { command: 'verify', description: 'Verify a product (usage: /verify <TruMark ID>)' },
      { command: 'help', description: 'Show available commands' },
      { command: 'status', description: 'Check bot status' },
    ],
  })

  // Menu Button opens the apex Mini App. BotFather can set the same URL
  // without this worker if the token is not bound yet.
  await telegram.call('setChatMenuButton', menuButtonPayload(webAppUrl))

  return new Response(
    JSON.stringify({ ok: true, webhook: webhookUrl, miniapp: webAppUrl }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}
