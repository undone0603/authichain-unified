import type { Env } from '../index'

export interface TelegramUpdate {
  message?: {
    chat: { id: number }
    from: { id: number; username?: string; first_name?: string }
    text?: string
  }
  inline_query?: { id: string; query: string; from: { id: number } }
  [key: string]: unknown
}

export const DB = {
  async logMessage(env: Env, update: TelegramUpdate): Promise<void> {
    await env.DATABASE
      .prepare(
        `INSERT INTO messages (chat_id, user_id, text, raw) VALUES (?, ?, ?, ?)`
      )
      .bind(
        update.message?.chat.id ?? null,
        update.message?.from.id ?? null,
        update.message?.text ?? null,
        JSON.stringify(update)
      )
      .run()
  },

  async getSession(env: Env, userId: number): Promise<Record<string, unknown> | null> {
    const raw = await env.SESSIONS.get(`session:${userId}`)
    return raw ? JSON.parse(raw) : null
  },

  async setSession(env: Env, userId: number, data: Record<string, unknown>): Promise<void> {
    await env.SESSIONS.put(`session:${userId}`, JSON.stringify(data), {
      expirationTtl: 60 * 60 * 24, // 24 hours
    })
  },
}
