-- AuthiChain / AgentZ Database Schema
-- Compiled for Supabase Implementation

-- 1. Products Table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT,
  authenticity_score NUMERIC DEFAULT 100,
  storymode_url TEXT,
  story_video_url TEXT,
  qr_id TEXT UNIQUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Scan Events Table
CREATE TABLE IF NOT EXISTS scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  business_id UUID,
  wallet TEXT,
  lat NUMERIC,
  lng NUMERIC,
  city TEXT,
  authenticity_score NUMERIC,
  reward_amount NUMERIC,
  signature TEXT,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Businesses Table
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  vertical TEXT,
  city TEXT,
  state TEXT,
  onboarding_status TEXT DEFAULT 'pending',
  monthly_scans NUMERIC DEFAULT 0,
  retention_score NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Campaigns Table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  campaign_type TEXT,
  reward_amount NUMERIC,
  active BOOLEAN DEFAULT TRUE,
  rules JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Redemptions Table
CREATE TABLE IF NOT EXISTS redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT NOT NULL,
  business_id UUID,
  qron_amount NUMERIC NOT NULL,
  discount_value NUMERIC,
  siphon_fee NUMERIC DEFAULT 0.05,
  status TEXT DEFAULT 'pending_verification',
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Public Reports Table
CREATE TABLE IF NOT EXISTS public_reports (
  id TEXT PRIMARY KEY, -- e.g., 'authenticity_index'
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_products_qr_id ON products(qr_id);
CREATE INDEX IF NOT EXISTS idx_scan_events_product_id ON scan_events(product_id);
CREATE INDEX IF NOT EXISTS idx_scan_events_wallet ON scan_events(wallet);

-- 7. Training Signals Table (V3 Intelligence Loop)
CREATE TABLE IF NOT EXISTS training_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  duration_s NUMERIC,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);
