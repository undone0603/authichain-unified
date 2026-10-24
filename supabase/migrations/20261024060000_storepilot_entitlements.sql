-- Phase 3 PR-C (2026-10-24): StorePilot Pro $29 one-time entitlement.
-- NOT APPLIED. Zac applies to live Supabase before the webhook deploy.
-- payments already exists in 00003_stripe_payment_tracking.sql; recreated
-- here only IF NOT EXISTS so a schema missing it still works.
CREATE TABLE IF NOT EXISTS public.payments (
  session_id     TEXT        PRIMARY KEY,
  customer_email TEXT        NOT NULL,
  amount_cents   INTEGER     NOT NULL,
  currency       TEXT        NOT NULL DEFAULT 'usd',
  status         TEXT        NOT NULL DEFAULT 'paid'
                 CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.storepilot_entitlements (
  id                 BIGSERIAL   PRIMARY KEY,
  stripe_session_id  TEXT        NOT NULL UNIQUE,
  customer_email     TEXT        NOT NULL,
  stripe_customer_id TEXT,
  sku                TEXT        NOT NULL DEFAULT 'storepilot_pro',
  tier               TEXT        NOT NULL CHECK (tier IN ('pro')),
  catalog_limit      INTEGER     NOT NULL DEFAULT 200 CHECK (catalog_limit > 0),
  price_id           TEXT        NOT NULL,
  granted_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_storepilot_entitlements_email
  ON public.storepilot_entitlements (lower(customer_email));

-- Service role only; no anon/authenticated policies.
ALTER TABLE public.storepilot_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.storepilot_entitlements FROM anon, authenticated;
