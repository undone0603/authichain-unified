-- Migration 007: QRON Token Architecture DB Schema
-- Immutable ledger of all QRON fee events: charges, rewards, burns, and treasury flows

CREATE TABLE IF NOT EXISTS fee_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  brand_id   UUID NOT NULL REFERENCES brands(id)    ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id)  ON DELETE SET NULL,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Fee classification
  flow_type TEXT NOT NULL CHECK (
    flow_type IN (
      'authentication_fee',
      'staking_reward',
      'protocol_treasury',
      'burn',
      'referral',
      'discount_applied'
    )
  ),

  -- Token amounts (QRON)
  gross_amount  NUMERIC(20,6) NOT NULL DEFAULT 0 CHECK (gross_amount >= 0),
  discount_amount NUMERIC(20,6) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  net_amount    NUMERIC(20,6) NOT NULL DEFAULT 0 CHECK (net_amount >= 0),

  -- Distribution breakdown
  staker_reward_amount NUMERIC(20,6) DEFAULT 0,
  treasury_amount      NUMERIC(20,6) DEFAULT 0,
  burn_amount          NUMERIC(20,6) DEFAULT 0,

  -- Staking context snapshot
  staking_tier_snapshot    TEXT,
  qron_staked_snapshot     NUMERIC(20,6),
  discount_rate_snapshot   NUMERIC(5,4),

  -- Blockchain reference
  tx_hash      TEXT UNIQUE,
  block_number BIGINT,
  chain_id     INTEGER DEFAULT 1,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'confirmed', 'failed', 'reversed')
  ),

  -- Metadata
  metadata   JSONB DEFAULT '{}',
  notes      TEXT,

  -- Timestamps
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS fee_flows_brand_id_idx   ON fee_flows (brand_id);
CREATE INDEX IF NOT EXISTS fee_flows_product_id_idx ON fee_flows (product_id);
CREATE INDEX IF NOT EXISTS fee_flows_user_id_idx    ON fee_flows (user_id);
CREATE INDEX IF NOT EXISTS fee_flows_flow_type_idx  ON fee_flows (flow_type);
CREATE INDEX IF NOT EXISTS fee_flows_status_idx     ON fee_flows (status);
CREATE INDEX IF NOT EXISTS fee_flows_created_at_idx ON fee_flows (created_at DESC);

-- RLS
ALTER TABLE fee_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own fee flows"
  ON fee_flows FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert fee flows"
  ON fee_flows FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users cannot update fee flows"
  ON fee_flows FOR UPDATE
  USING (false);

-- Comments
COMMENT ON TABLE fee_flows IS 'Immutable ledger of all QRON fee events: charges, rewards, burns, and treasury flows';
COMMENT ON COLUMN fee_flows.flow_type IS 'Category of the fee event';
COMMENT ON COLUMN fee_flows.gross_amount IS 'Full fee before discount in QRON';
COMMENT ON COLUMN fee_flows.net_amount IS 'Fee actually charged after discount in QRON';
COMMENT ON COLUMN fee_flows.burn_amount IS 'QRON burned in this event (deflationary mechanism)';
