import type { Env } from '../index'
import type { Telegram } from './telegram'

export async function notifyAdmin(env: Env, telegram: Telegram, message: string): Promise<void> {
  if (!env.TELEGRAM_ADMIN_CHAT_ID) return
  await telegram.sendMessage(env.TELEGRAM_ADMIN_CHAT_ID, message, { parse_mode: 'HTML' })
}

export async function sendDailyDigest(env: Env, telegram: Telegram): Promise<void> {
  const result = await env.DATABASE
    .prepare(
      `SELECT COUNT(*) as total,
              COUNT(CASE WHEN created_at >= datetime('now', '-1 day') THEN 1 END) as last_24h
       FROM messages`
    )
    .first<{ total: number; last_24h: number }>()

  const msg = [
    `📊 <b>Daily Digest</b>`,
    `Total messages: ${result?.total ?? 0}`,
    `Last 24h: ${result?.last_24h ?? 0}`,
  ].join('\n')

  await notifyAdmin(env, telegram, msg)
}
