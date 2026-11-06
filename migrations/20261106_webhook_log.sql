CREATE TABLE IF NOT EXISTS webhook_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  email TEXT,
  amount INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

ALTER TABLE tenants ADD COLUMN pack_credits INTEGER DEFAULT 0;
ALTER TABLE tenants ADD COLUMN plan TEXT DEFAULT 'free';
ALTER TABLE tenants ADD COLUMN stripe_customer_id TEXT;
