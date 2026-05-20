-- Scan validation results table
CREATE TABLE IF NOT EXISTS qron_scan_results (
  id TEXT PRIMARY KEY,
  qron_registration_id TEXT NOT NULL,
  asset_url TEXT NOT NULL,
  decoded_payload TEXT,
  confidence REAL,
  scannable INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scan_reg_id ON qron_scan_results(qron_registration_id);
