import type { Env } from '../index'
import { Telegram } from './telegram'

export async function sendAdminMessage(env: Env, text: string): Promise<void> {
  if (!env.TELEGRAM_ADMIN_CHAT_ID || !env.TELEGRAM_BOT_TOKEN) return
  const tg = new Telegram(env.TELEGRAM_BOT_TOKEN)
  await tg.sendMessage(env.TELEGRAM_ADMIN_CHAT_ID, text)
}

export async function sendDailyRevenueSummary(env: Env): Promise<void> {
  const row = await env.DATABASE
    .prepare(
      `SELECT
         COUNT(*) as total,
         COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
         COUNT(CASE WHEN created_at >= datetime('now', '-1 day') THEN 1 END) as new_today
       FROM licenses`
    )
    .first<{ total: number; active: number; new_today: number }>()

  const msg = [
    `📊 <b>agent-browser License Summary</b>`,
    ``,
    `Total issued : ${row?.total ?? 0}`,
    `Active       : ${row?.active ?? 0}`,
    `New today    : ${row?.new_today ?? 0}`,
  ].join('\n')

  await sendAdminMessage(env, msg)
}
