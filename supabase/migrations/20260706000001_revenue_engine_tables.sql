-- ============================================================
-- AuthiChain Revenue Engine — Supabase Migration
-- 20260706000001_revenue_engine_tables.sql
-- Apply: supabase db push  (or supabase migration up)
-- ============================================================

-- ------------------------------------------------------------
-- 1. auth_seals
-- Stores every product seal generated via /seal
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
-- Every scan of a QR code (valid or invalid)
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
-- 3. certificates
-- NFT certificate minting records
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  seal_id uuid REFERENCES auth_seals(id) ON DELETE SET NULL,
  rarity_score numeric CHECK (rarity_score >= 0 AND rarity_score <= 100),
  polygon_nft_tx text,
  brand text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certificates_brand ON certificates (brand);
CREATE INDEX IF NOT EXISTS idx_certificates_product_id ON certificates (product_id);

-- ------------------------------------------------------------
-- 4. provenance_batches
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
-- 5. subscriptions
-- Stripe subscription records, upserted on webhook events
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  plan_id text NOT NULL,
  brand text NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions (email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_brand ON subscriptions (brand);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions (status);

-- ------------------------------------------------------------
-- 6. usage_events
-- Per-event log for usage-based billing and analytics
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_ref uuid,
  brand text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_brand ON usage_events (brand);
CREATE INDEX IF NOT EXISTS idx_usage_events_event_type ON usage_events (event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events (created_at DESC);

-- ------------------------------------------------------------
-- Row Level Security (RLS) policies
-- Enable RLS on all tables; service_role bypasses automatically
-- ------------------------------------------------------------
ALTER TABLE auth_seals ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE provenance_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- Public read on auth_seals for QR verification
CREATE POLICY IF NOT EXISTS "Public can read auth_seals" ON auth_seals
  FOR SELECT USING (true);

-- Public read on certificates for marketplace
CREATE POLICY IF NOT EXISTS "Public can read certificates" ON certificates
  FOR SELECT USING (true);

-- All writes go through service_role (Workers / server-side)
-- No additional policies needed for inserts.
