-- D1 schema for gs1-resolver. Apply with:
--   wrangler d1 execute authichain-provenance --file=workers/gs1-resolver/src/schema.sql

CREATE TABLE IF NOT EXISTS seals (
  id TEXT PRIMARY KEY,
  lookup_key TEXT NOT NULL UNIQUE,
  gtin TEXT,
  lot TEXT,
  serial TEXT,
  expiry TEXT,
  cert_id TEXT NOT NULL,
  brand TEXT,
  product_name TEXT,
  issuer TEXT,
  fingerprint_sha256 TEXT,
  chain TEXT DEFAULT 'polygon',
  contract TEXT,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'issued',
  status_reason TEXT,
  first_country TEXT,
  first_activated_at INTEGER,
  scan_count INTEGER NOT NULL DEFAULT 0,
  last_scan_at INTEGER,
  revoked_at INTEGER,
  revoke_reason TEXT,
  metadata_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_seals_gtin ON seals(gtin);
CREATE INDEX IF NOT EXISTS idx_seals_cert ON seals(cert_id);
CREATE INDEX IF NOT EXISTS idx_seals_status ON seals(status);

CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY,
  seal_id TEXT NOT NULL,
  at INTEGER NOT NULL,
  country TEXT NOT NULL,
  region TEXT,
  colo TEXT,
  result TEXT NOT NULL,
  reason TEXT,
  FOREIGN KEY (seal_id) REFERENCES seals(id)
);

CREATE INDEX IF NOT EXISTS idx_scans_seal_at ON scans(seal_id, at);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  seal_id TEXT NOT NULL,
  at INTEGER NOT NULL,
  note TEXT,
  country TEXT
);
