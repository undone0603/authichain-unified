import type { Env } from '../index'

export type LicenseTier = 'pro' | 'enterprise'
export type LicenseStatus = 'active' | 'revoked' | 'expired'

export interface LicenseRecord {
  id: string
  email: string
  tier: LicenseTier
  seats: number
  stripe_customer_id: string
  stripe_subscription_id: string
  key_hash: string       // SHA-256 of the raw key (never store the key itself)
  status: LicenseStatus
  expires_at: string | null
  created_at: string
  delivered_at: string | null
}

export const DB = {
  async createLicense(env: Env, record: Omit<LicenseRecord, 'created_at' | 'delivered_at'>): Promise<void> {
    await env.DATABASE
      .prepare(
        `INSERT INTO licenses
           (id, email, tier, seats, stripe_customer_id, stripe_subscription_id,
            key_hash, status, expires_at, created_at, delivered_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
      )
      .bind(
        record.id,
        record.email,
        record.tier,
        record.seats,
        record.stripe_customer_id,
        record.stripe_subscription_id,
        record.key_hash,
        record.status,
        record.expires_at,
        new Date().toISOString()
      )
      .run()
  },

  async markDelivered(env: Env, id: string): Promise<void> {
    await env.DATABASE
      .prepare(`UPDATE licenses SET delivered_at = ? WHERE id = ?`)
      .bind(new Date().toISOString(), id)
      .run()
  },

  async getByHash(env: Env, keyHash: string): Promise<LicenseRecord | null> {
    return env.DATABASE
      .prepare(`SELECT * FROM licenses WHERE key_hash = ? LIMIT 1`)
      .bind(keyHash)
      .first<LicenseRecord>()
  },

  async getByStripeCustomer(env: Env, customerId: string): Promise<LicenseRecord | null> {
    return env.DATABASE
      .prepare(`SELECT * FROM licenses WHERE stripe_customer_id = ? LIMIT 1`)
      .bind(customerId)
      .first<LicenseRecord>()
  },

  async revoke(env: Env, id: string): Promise<void> {
    await env.DATABASE
      .prepare(`UPDATE licenses SET status = 'revoked' WHERE id = ?`)
      .bind(id)
      .run()
  },

  async logEvent(env: Env, stripeEventId: string, eventType: string, status: string, detail: string): Promise<void> {
    await env.DATABASE
      .prepare(
        `INSERT OR IGNORE INTO stripe_events (stripe_event_id, event_type, status, detail, processed_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(stripeEventId, eventType, status, detail, new Date().toISOString())
      .run()
  },

  async isEventProcessed(env: Env, stripeEventId: string): Promise<boolean> {
    const row = await env.DATABASE
      .prepare(`SELECT 1 FROM stripe_events WHERE stripe_event_id = ? LIMIT 1`)
      .bind(stripeEventId)
      .first()
    return row !== null
  },
}
