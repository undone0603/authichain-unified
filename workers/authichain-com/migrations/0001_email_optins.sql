-- authichain-db (Cloudflare D1, ebd8081b-ac13-485a-8b0e-a6cd9c0f7be5). AuthiChain-owned, not QRON-v2 Supabase.
-- Optional email opt-in from the free checks (/is-this-real, /dpp-check).
-- Stores only: email, consent timestamp, confirmation status (+ a SHA-256 hash of the
-- double opt-in token, needed to confirm; never the raw token).
-- Retention: unconfirmed rows older than 30 days are deleted on every new opt-in write
-- (src/email-optin.ts PURGE_SQL). Manual equivalent:
--   DELETE FROM email_optins WHERE status = 'pending' AND consent_at < datetime('now','-30 days');
-- MARKETING RULE: only status = 'confirmed' rows may ever be sent updates.
-- email_optin_rate: per-IP rate limit (SHA-256 of IP, 1-hour window), purged after 1 day.
-- Rollback: DROP TABLE IF EXISTS email_optins; DROP TABLE IF EXISTS email_optin_rate;
CREATE TABLE IF NOT EXISTS email_optins (
  email TEXT PRIMARY KEY,
  consent_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed')),
  token_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_email_optins_status_consent ON email_optins (status, consent_at);
CREATE TABLE IF NOT EXISTS email_optin_rate (
  ip_hash TEXT PRIMARY KEY,
  window_start TEXT NOT NULL,
  hits INTEGER NOT NULL
);
