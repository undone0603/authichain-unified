CREATE INDEX IF NOT EXISTS idx_seals_cert_nocase
  ON seals(cert_id COLLATE NOCASE);
