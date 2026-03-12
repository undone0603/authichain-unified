-- Migration 005: QRON Physical Authentication Bridge
-- Links AuthiChain product certificates to QRON visual fingerprints
-- Enables 5-layer forensic trust scoring per product unit

CREATE TABLE IF NOT EXISTS product_qrons (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          INTEGER     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qron_id             TEXT        NOT NULL,             -- codes.code_id in QRON DB
  qron_image_url      TEXT        NOT NULL,             -- Fal.ai generated image (R2/CDN)
  qron_thumbnail_url  TEXT,
  qron_mode           VARCHAR(30) NOT NULL DEFAULT 'holographic', -- QRON mode used
  generation_seed     TEXT        NOT NULL,             -- keccak256(product_id||nft_token_id||serial_number)
  fingerprint_hash    TEXT        NOT NULL,             -- pHash of generated image
  fingerprint_embed   TEXT,                             -- CLIP embedding vector JSON (cached)
  nft_token_id        TEXT,                             -- QRON NFT on Base
  nft_chain           TEXT        DEFAULT 'base',
  nft_contract        TEXT,
  openart_url         TEXT,                             -- qron.space/openart/{id}
  openart_registered  BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Live trust signals (updated on each scan/claim)
  verified_scan_count INTEGER     NOT NULL DEFAULT 0,
  fake_flag_count     INTEGER     NOT NULL DEFAULT 0,
  suspicious_count    INTEGER     NOT NULL DEFAULT 0,
  trust_score         INTEGER     NOT NULL DEFAULT 100, -- 0-100, recomputed by trigger
  -- Scan geography
  first_scan_country  TEXT,
  last_scan_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id),    -- one QRON per product unit
  UNIQUE (qron_id)
);

CREATE INDEX idx_product_qrons_product_id  ON product_qrons (product_id);
CREATE INDEX idx_product_qrons_trust_score ON product_qrons (trust_score);
CREATE INDEX idx_product_qrons_qron_id     ON product_qrons (qron_id);

-- ── Scan verdicts logged from QRON verify page ──────────────────────────────
CREATE TABLE IF NOT EXISTS qron_scan_verdicts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_qron_id  UUID        NOT NULL REFERENCES product_qrons(id) ON DELETE CASCADE,
  -- The raw visual match result
  fingerprint_sim  NUMERIC(5,4),   -- cosine similarity 0-1 (null if no photo captured)
  fingerprint_pass BOOLEAN,         -- sim >= 0.85
  -- User truth claim
  user_verdict     VARCHAR(20),     -- 'authentic' | 'suspicious' | 'fake' | null
  user_id          UUID,            -- QRON DB user_id (if authenticated)
  qron_reward_wei  NUMERIC(28,0),   -- $QRON reward in wei (18 dec)
  consensus_aligned BOOLEAN,
  -- Metadata
  scan_location    JSONB,           -- {country, region, lat, lng}
  scan_ua          TEXT,
  scanned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qron_scan_verdicts_product ON qron_scan_verdicts (product_qron_id);
CREATE INDEX idx_qron_scan_verdicts_scanned ON qron_scan_verdicts (scanned_at DESC);

-- ── Trust score recompute trigger ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION recompute_qron_trust_score()
RETURNS TRIGGER AS $$
DECLARE
  v_verified  INTEGER;
  v_fake      INTEGER;
  v_sus       INTEGER;
  v_total     INTEGER;
  v_score     INTEGER;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE user_verdict = 'authentic'),
    COUNT(*) FILTER (WHERE user_verdict = 'fake'),
    COUNT(*) FILTER (WHERE user_verdict = 'suspicious'),
    COUNT(*)
  INTO v_verified, v_fake, v_sus, v_total
  FROM qron_scan_verdicts
  WHERE product_qron_id = NEW.product_qron_id;

  IF v_total = 0 THEN
    v_score := 100;
  ELSE
    -- Weighted: authentic=+1, suspicious=-0.5, fake=-2 (normalized 0-100)
    v_score := GREATEST(0, LEAST(100,
      ROUND(50 + (
        (v_verified::NUMERIC - v_fake * 2 - v_sus * 0.5) / GREATEST(v_total, 1)
      ) * 50)
    ));
  END IF;

  UPDATE product_qrons SET
    verified_scan_count = v_verified,
    fake_flag_count      = v_fake,
    suspicious_count     = v_sus,
    trust_score          = v_score,
    last_scan_at         = NOW(),
    updated_at           = NOW()
  WHERE id = NEW.product_qron_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recompute_trust_score
AFTER INSERT ON qron_scan_verdicts
FOR EACH ROW EXECUTE FUNCTION recompute_qron_trust_score();

-- ── Update timestamp trigger ─────────────────────────────────────────────────
CREATE TRIGGER trg_product_qrons_updated_at
BEFORE UPDATE ON product_qrons
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
