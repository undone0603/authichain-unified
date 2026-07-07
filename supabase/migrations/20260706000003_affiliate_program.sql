-- =============================================================
-- Migration: 20260706000003_affiliate_program.sql
-- Full affiliate program: affiliates, referrals, commissions, payouts
-- + subscription indexes from 20260706000002
-- =============================================================

-- -----------------------------------------------
-- 1. SUBSCRIPTION INDEXES (previously 000002)
-- -----------------------------------------------
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer
  ON subscriptions (stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_email
  ON subscriptions (email);

CREATE INDEX IF NOT EXISTS idx_subscriptions_brand
  ON subscriptions (brand);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON subscriptions (status);

-- -----------------------------------------------
-- 2. AFFILIATES TABLE
-- Stores affiliate accounts. One row per partner.
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS affiliates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  company         TEXT,
  ref_code        TEXT NOT NULL UNIQUE,           -- e.g. "acme-corp"
  brand           TEXT NOT NULL DEFAULT 'authichain.com',
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.20, -- 20%
  tier            TEXT NOT NULL DEFAULT 'standard' CHECK (tier IN ('standard','silver','gold','platinum')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','banned','pending')),
  stripe_connect_account_id TEXT,                -- Stripe Connect for automated payouts
  paypal_email    TEXT,                          -- PayPal fallback
  total_clicks    INTEGER NOT NULL DEFAULT 0,
  total_conversions INTEGER NOT NULL DEFAULT 0,
  total_revenue_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_commissions_earned_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_commissions_paid_usd   NUMERIC(12,2) NOT NULL DEFAULT 0,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE affiliates IS 'Affiliate partner accounts for the AuthiChain referral program';

-- -----------------------------------------------
-- 3. AFFILIATE CLICKS TABLE
-- Tracks every link click with UTM / metadata.
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id    UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  ref_code        TEXT NOT NULL,
  brand           TEXT,
  ip_hash         TEXT,                          -- hashed for privacy
  user_agent      TEXT,
  landing_page    TEXT,
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  converted       BOOLEAN NOT NULL DEFAULT FALSE,
  session_id      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_affiliate ON affiliate_clicks(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_ref_code  ON affiliate_clicks(ref_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_session   ON affiliate_clicks(session_id);

-- -----------------------------------------------
-- 4. REFERRALS TABLE
-- One row per completed signup/trial driven by an affiliate.
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS referrals (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id            UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  ref_code                TEXT NOT NULL,
  referred_email          TEXT NOT NULL,
  referred_user_id        UUID,                  -- links to auth.users if they sign up
  stripe_customer_id      TEXT,                  -- set on first payment
  stripe_subscription_id  TEXT,
  brand                   TEXT NOT NULL,
  plan_id                 TEXT,
  status                  TEXT NOT NULL DEFAULT 'signup' CHECK (status IN ('click','signup','trial','active','churned','refunded')),
  first_payment_at        TIMESTAMPTZ,
  first_payment_usd       NUMERIC(12,2),
  click_id                UUID REFERENCES affiliate_clicks(id),
  metadata                JSONB DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_affiliate    ON referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referrals_email        ON referrals(referred_email);
CREATE INDEX IF NOT EXISTS idx_referrals_customer     ON referrals(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status       ON referrals(status);

-- -----------------------------------------------
-- 5. COMMISSIONS TABLE
-- One row per billable commission event.
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS commissions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id            UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referral_id             UUID REFERENCES referrals(id),
  stripe_invoice_id       TEXT,
  stripe_charge_id        TEXT,
  gross_usd               NUMERIC(12,2) NOT NULL,   -- customer payment amount
  commission_rate         NUMERIC(5,4) NOT NULL,
  commission_usd          NUMERIC(12,2) NOT NULL,   -- = gross_usd * commission_rate
  brand                   TEXT NOT NULL,
  plan_id                 TEXT,
  status                  TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','paid','reversed','disputed')),
  payout_id               UUID,                     -- FK set when paid
  approved_at             TIMESTAMPTZ,
  reversed_at             TIMESTAMPTZ,
  reversal_reason         TEXT,
  metadata                JSONB DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commissions_affiliate ON commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status    ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_invoice   ON commissions(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_commissions_payout    ON commissions(payout_id);

-- -----------------------------------------------
-- 6. PAYOUTS TABLE
-- Batches commissions into a single payout to an affiliate.
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id            UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  amount_usd              NUMERIC(12,2) NOT NULL,
  commission_count        INTEGER NOT NULL DEFAULT 0,
  method                  TEXT NOT NULL DEFAULT 'stripe_connect'
    CHECK (method IN ('stripe_connect','paypal','manual','bank_transfer')),
  stripe_transfer_id      TEXT,
  paypal_batch_id         TEXT,
  status                  TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','paid','failed','reversed')),
  period_start            TIMESTAMPTZ,
  period_end              TIMESTAMPTZ,
  notes                   TEXT,
  paid_at                 TIMESTAMPTZ,
  failed_at               TIMESTAMPTZ,
  failure_reason          TEXT,
  metadata                JSONB DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payouts_affiliate ON affiliate_payouts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status    ON affiliate_payouts(status);

-- FK from commissions.payout_id -> affiliate_payouts.id
ALTER TABLE commissions
  ADD CONSTRAINT fk_commissions_payout
  FOREIGN KEY (payout_id) REFERENCES affiliate_payouts(id) ON DELETE SET NULL;

-- -----------------------------------------------
-- 7. RLS POLICIES
-- Affiliates can only read their own data.
-- -----------------------------------------------
ALTER TABLE affiliates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_clicks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_payouts  ENABLE ROW LEVEL SECURITY;

-- Service role bypasses all RLS (used by server-side API)
-- Authenticated affiliates view their own rows via email match
CREATE POLICY "affiliate_self_read" ON affiliates
  FOR SELECT USING (email = auth.email());

CREATE POLICY "affiliate_clicks_self_read" ON affiliate_clicks
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM affiliates WHERE email = auth.email())
  );

CREATE POLICY "referrals_self_read" ON referrals
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM affiliates WHERE email = auth.email())
  );

CREATE POLICY "commissions_self_read" ON commissions
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM affiliates WHERE email = auth.email())
  );

CREATE POLICY "payouts_self_read" ON affiliate_payouts
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM affiliates WHERE email = auth.email())
  );

-- -----------------------------------------------
-- 8. UPDATED_AT TRIGGERS
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_affiliates') THEN
    CREATE TRIGGER set_updated_at_affiliates
      BEFORE UPDATE ON affiliates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_referrals') THEN
    CREATE TRIGGER set_updated_at_referrals
      BEFORE UPDATE ON referrals
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_commissions') THEN
    CREATE TRIGGER set_updated_at_commissions
      BEFORE UPDATE ON commissions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_payouts') THEN
    CREATE TRIGGER set_updated_at_payouts
      BEFORE UPDATE ON affiliate_payouts
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
