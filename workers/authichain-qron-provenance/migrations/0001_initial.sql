-- QRON provenance registrations table
CREATE TABLE IF NOT EXISTS qron_registrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_url TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  prompt TEXT,
  preset_id TEXT,
  mode TEXT DEFAULT 'static',
  fal_request_id TEXT,
  status TEXT DEFAULT 'pending_mint',
  token_id TEXT,
  tx_hash TEXT,
  chain TEXT,
  contract_address TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reg_user_id ON qron_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_reg_status ON qron_registrations(status);
CREATE INDEX IF NOT EXISTS idx_reg_created ON qron_registrations(created_at);
