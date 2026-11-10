-- Idempotent Stripe dunning tables
-- Apply with: wrangler d1 execute authichain-db --file=schema/dunning.sql

CREATE TABLE IF NOT EXISTS dunning (
  ref_id TEXT PRIMARY KEY,
  tenant_id TEXT, -- future multi-tenant; NULL for solo now
  attempts INTEGER NOT NULL DEFAULT 0,
  next_at INTEGER,
  status TEXT,
  customer_email TEXT,
  stripe_customer_id TEXT,
  created_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_dunning_status_next_at ON dunning (status, next_at);
CREATE INDEX IF NOT EXISTS idx_dunning_tenant ON dunning (tenant_id);

CREATE TABLE IF NOT EXISTS dunning_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_id TEXT,
  tenant_id TEXT,
  status TEXT,
  attempts INTEGER,
  ts INTEGER
);

CREATE INDEX IF NOT EXISTS idx_dunning_log_ref ON dunning_log (ref_id);
