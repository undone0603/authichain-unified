-- Goal: scan logging for gs1-resolver + scan-validate.
-- D1: authichain-provenance (ebd8081b-ac13-485a-8b0e-a6cd9c0f7be5)
-- Idempotent. Does not invent scan counts.

CREATE TABLE IF NOT EXISTS seals (
  id TEXT PRIMARY KEY,
  lookup_key TEXT UNIQUE,
  gtin TEXT,
  lot TEXT,
  serial TEXT,
  cert_id TEXT,
  brand TEXT,
  product_name TEXT,
  issuer TEXT,
  chain TEXT,
  contract TEXT,
  tx_hash TEXT,
  status TEXT,
  status_reason TEXT,
  first_country TEXT,
  first_activated_at INTEGER,
  scan_count INTEGER DEFAULT 0,
  last_scan_at INTEGER,
  metadata_json TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY,
  seal_id TEXT,
  at INTEGER,
  country TEXT,
  region TEXT,
  colo TEXT,
  result TEXT,
  reason TEXT,
  FOREIGN KEY (seal_id) REFERENCES seals(id)
);

CREATE INDEX IF NOT EXISTS scans_seal_id_at ON scans (seal_id, at);
CREATE INDEX IF NOT EXISTS seals_lookup_key ON seals (lookup_key);
