import type { Env } from '../index'

export class Telegram {
  constructor(private token: string) {}

  async call(method: string, body: object): Promise<Response> {
    return fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  sendMessage(chat_id: string | number, text: string, parse_mode = 'HTML'): Promise<Response> {
    return this.call('sendMessage', { chat_id, text, parse_mode })
  }
}

/**
 * Notify the admin channel when a new license is issued.
 */
export async function notifyAdminNewLicense(
  env: Env,
  email: string,
  tier: string,
  key: string
): Promise<void> {
  if (!env.TELEGRAM_ADMIN_CHAT_ID || !env.TELEGRAM_BOT_TOKEN) return
  const tg = new Telegram(env.TELEGRAM_BOT_TOKEN)
  const msg = [
    `🔑 <b>New License Issued</b>`,
    ``,
    `Email: <code>${email}</code>`,
    `Tier:  <b>${tier}</b>`,
    `Key:   <code>${key.slice(0, 30)}…</code>`,
  ].join('\n')
  await tg.sendMessage(env.TELEGRAM_ADMIN_CHAT_ID, msg)
}

/**
 * Deliver a license key to the customer via Telegram if they have
 * started a chat with the bot (stored in KV as telegram:<email>).
 * Returns true if delivered via Telegram, false if not found.
 */
export async function deliverKeyViaTelegram(
  env: Env,
  email: string,
  tier: string,
  key: string
): Promise<boolean> {
  const chatId = await env.SESSIONS.get(`tg:${email}`)
  if (!chatId) return false

  const tg = new Telegram(env.TELEGRAM_BOT_TOKEN)
  const msg = [
    `🎉 <b>Your agent-browser Pro License</b>`,
    ``,
    `Thanks for subscribing! Here is your license key:`,
    ``,
    `<code>${key}</code>`,
    ``,
    `Activate it with:`,
    `<code>agent-browser license set ${key}</code>`,
    ``,
    `Or set the environment variable:`,
    `<code>AGENT_BROWSER_LICENSE_KEY=${key}</code>`,
    ``,
    `Tier: <b>${tier}</b> — unlimited concurrent sessions`,
    `Docs: https://github.com/Z-kie/agent-browser`,
  ].join('\n')

  await tg.sendMessage(chatId, msg)
  return true
}
