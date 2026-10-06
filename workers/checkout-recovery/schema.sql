CREATE TABLE IF NOT EXISTS entitlements (
  session_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  sku TEXT NOT NULL,
  generations INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  credit_cents INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  sku TEXT NOT NULL,
  amount INTEGER NOT NULL,
  paid INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
