import { Telegram } from '../services/telegram'
import type { Env } from '../index'

export async function setupWebhook(request: Request, env: Env): Promise<Response> {
  const auth = request.headers.get('Authorization')
  if (auth !== `Bearer ${env.TELEGRAM_WEBHOOK_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const telegram = new Telegram(env.TELEGRAM_BOT_TOKEN)
  const webhookUrl = `${env.SITE_URL}/api/telegram/webhook`

  await telegram.call('setWebhook', {
    url: webhookUrl,
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ['message', 'inline_query', 'edited_message', 'callback_query'],
    drop_pending_updates: true,
  })

  // Set bot commands so they show up in the Telegram UI
  await telegram.call('setMyCommands', {
    commands: [
      { command: 'start', description: 'Welcome & getting started' },
      { command: 'verify', description: 'Verify a product (usage: /verify <TrueMark ID>)' },
      { command: 'help', description: 'Show available commands' },
      { command: 'status', description: 'Check bot status' },
    ],
  })

  return new Response(
    JSON.stringify({ ok: true, webhook: webhookUrl }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}
