-- Migration 0011: Add QRON Physical Authentication Tables

CREATE TABLE IF NOT EXISTS product_qrons (
  id                  TEXT PRIMARY KEY,
  product_id          INTEGER NOT NULL REFERENCES products(id),
  product_name        TEXT NOT NULL,
  brand               TEXT,
  category            TEXT,
  qron_mode           TEXT NOT NULL,
  generation_seed     TEXT NOT NULL,
  qron_image_url      TEXT NOT NULL,
  qron_thumbnail_url  TEXT,
  fingerprint_hash    TEXT NOT NULL,
  trust_score         INTEGER DEFAULT 0,
  nft_token_id        TEXT,
  openart_url         TEXT,
  openart_registered  INTEGER DEFAULT 0,
  verified_scan_count INTEGER DEFAULT 0,
  fake_flag_count     INTEGER DEFAULT 0,
  first_scan_country  TEXT,
  metadata            TEXT,
  created_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qron_scan_verdicts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  qron_id           TEXT NOT NULL REFERENCES product_qrons(id),
  user_id           INTEGER,
  scanned_image_url TEXT,
  similarity_score  REAL,
  verdict           TEXT NOT NULL,
  details           TEXT,
  location_country  TEXT,
  ip_address        TEXT,
  user_agent        TEXT,
  scanned_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
