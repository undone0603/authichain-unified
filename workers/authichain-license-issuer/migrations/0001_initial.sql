CREATE TABLE IF NOT EXISTS licenses (
  id                     TEXT PRIMARY KEY,  -- jti (UUID)
  email                  TEXT NOT NULL,
  tier                   TEXT NOT NULL,     -- 'pro' | 'enterprise'
  seats                  INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id     TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL,
  key_hash               TEXT NOT NULL UNIQUE,  -- SHA-256 of the raw key
  status                 TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'revoked' | 'expired'
  expires_at             TEXT,
  created_at             TEXT NOT NULL,
  delivered_at           TEXT
);

CREATE INDEX IF NOT EXISTS idx_licenses_email             ON licenses(email);
CREATE INDEX IF NOT EXISTS idx_licenses_stripe_customer   ON licenses(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_licenses_key_hash          ON licenses(key_hash);
CREATE INDEX IF NOT EXISTS idx_licenses_status            ON licenses(status);

-- Idempotency log for Stripe events
CREATE TABLE IF NOT EXISTS stripe_events (
  stripe_event_id TEXT PRIMARY KEY,
  event_type      TEXT NOT NULL,
  status          TEXT NOT NULL,   -- 'success' | 'error'
  detail          TEXT,
  processed_at    TEXT NOT NULL
);
