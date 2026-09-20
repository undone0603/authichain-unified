-- ============================================================
-- AuthiChain Revenue Engine — missing tables follow-up
-- 20260717150000_revenue_engine_missing_tables.sql
--
-- The original 20260706000001_revenue_engine_tables.sql migration was
-- never applied (it also used invalid `CREATE POLICY IF NOT EXISTS`
-- syntax, which is not valid PostgreSQL and would have failed outright).
-- As a result:
--   - /api/seal and /api/provenance have always failed (insert into a
--     nonexistent table).
--   - The already-shipped, paid x402 /api/v1/agent-verify endpoint has
--     always returned verified:false for every seal, because it reads
--     from the nonexistent auth_seals table.
--
-- This migration creates ONLY the tables that don't already exist and
-- don't collide with anything: auth_seals, verification_events,
-- provenance_batches, usage_events. It deliberately does NOT touch
-- `certificates` (already exists, in active use by the admin
-- certification workflow, with an incompatible column shape) or
-- `subscriptions` (already exists, in active use by the legacy
-- Drizzle-backed billing system, also with an incompatible shape).
-- ============================================================

-- ------------------------------------------------------------
-- 1. auth_seals
-- Stores every product seal generated via /api/seal
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_seals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  batch_id text,
  brand text NOT NULL,
  qr_payload text NOT NULL,
  polygon_tx text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_seals_brand ON auth_seals (brand);
CREATE INDEX IF NOT EXISTS idx_auth_seals_product_id ON auth_seals (product_id);

-- ------------------------------------------------------------
-- 2. verification_events
-- Every scan/verification of a seal (valid, invalid, or expired)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seal_id uuid REFERENCES auth_seals(id) ON DELETE SET NULL,
  brand text NOT NULL,
  scan_context jsonb DEFAULT '{}',
  status text NOT NULL CHECK (status IN ('valid', 'invalid', 'expired')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_events_seal_id ON verification_events (seal_id);
CREATE INDEX IF NOT EXISTS idx_verification_events_brand ON verification_events (brand);
CREATE INDEX IF NOT EXISTS idx_verification_events_created_at ON verification_events (created_at DESC);

-- ------------------------------------------------------------
-- 3. provenance_batches
-- StrainChain dispensary batch provenance trails
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provenance_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispensary_id text NOT NULL,
  batch_id text NOT NULL,
  brand text NOT NULL,
  qr_payload text NOT NULL,
  events jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provenance_batches_dispensary_id ON provenance_batches (dispensary_id);
CREATE INDEX IF NOT EXISTS idx_provenance_batches_batch_id ON provenance_batches (batch_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_provenance_batches_unique ON provenance_batches (dispensary_id, batch_id);

-- ------------------------------------------------------------
-- 4. usage_events
-- Per-event log for usage-based billing and analytics
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid,
  event_type text NOT NULL,
  event_ref uuid,
  brand text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_brand ON usage_events (brand);
CREATE INDEX IF NOT EXISTS idx_usage_events_event_type ON usage_events (event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events (created_at DESC);

-- ------------------------------------------------------------
-- Row Level Security
-- Public read on auth_seals (QR verification) and verification_events
-- (transparency/audit trail); all writes go through service_role
-- (Next.js API routes / Workers), which bypasses RLS.
-- provenance_batches and usage_events have no public policy — same
-- "RLS enabled, zero policies = service_role only" pattern already used
-- by `certificates` and `subscriptions` in this database.
-- ------------------------------------------------------------
ALTER TABLE auth_seals ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE provenance_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'auth_seals' AND policyname = 'Public can read auth_seals'
  ) THEN
    CREATE POLICY "Public can read auth_seals" ON auth_seals FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'verification_events' AND policyname = 'Public can read verification_events'
  ) THEN
    CREATE POLICY "Public can read verification_events" ON verification_events FOR SELECT USING (true);
  END IF;
END $$;
