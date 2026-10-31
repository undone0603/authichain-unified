-- authichain-db: email_optins gains country (ISO 3166-1 alpha-2, optional) and a
-- per-row random unsubscribe token, and status gains 'unsubscribed'.
-- SQLite cannot alter a CHECK constraint, so the table is rebuilt and rows are copied.
-- Rollback (loses country/unsub data and any 'unsubscribed' rows' status):
--   CREATE TABLE email_optins_old (email TEXT PRIMARY KEY, consent_at TEXT NOT NULL,
--     status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed')), token_hash TEXT);
--   INSERT INTO email_optins_old SELECT email, consent_at, status, token_hash FROM email_optins WHERE status IN ('pending','confirmed');
--   DROP TABLE email_optins; ALTER TABLE email_optins_old RENAME TO email_optins;
--   CREATE INDEX IF NOT EXISTS idx_email_optins_status_consent ON email_optins (status, consent_at);
CREATE TABLE email_optins_new (
  email TEXT PRIMARY KEY,
  consent_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','unsubscribed')),
  token_hash TEXT,
  country TEXT CHECK (country IS NULL OR (length(country) = 2 AND country GLOB '[A-Z][A-Z]')),
  unsub_token TEXT
);
INSERT INTO email_optins_new (email, consent_at, status, token_hash, unsub_token)
  SELECT email, consent_at, status, token_hash, lower(hex(randomblob(32))) FROM email_optins;
DROP TABLE email_optins;
ALTER TABLE email_optins_new RENAME TO email_optins;
CREATE INDEX IF NOT EXISTS idx_email_optins_status_consent ON email_optins (status, consent_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_optins_unsub_token ON email_optins (unsub_token);
