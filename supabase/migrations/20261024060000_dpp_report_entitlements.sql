-- Phase 3 PR-C (2026-10-24): DPP readiness report $29 one-time entitlement.
-- NOT APPLIED. Zac applies to live Supabase before the webhook deploy.
-- Idempotency: one row per Stripe checkout session (UNIQUE), written with
-- ON CONFLICT DO NOTHING, so duplicate deliveries add no second row.
-- public.payments is NOT touched: the live table (uuid id PK, amount numeric,
-- session_id without a unique index) is written by lookup-then-insert.
--
-- Down: DROP TABLE IF EXISTS public.dpp_report_entitlements;

CREATE TABLE IF NOT EXISTS public.dpp_report_entitlements (
  id                 BIGSERIAL   PRIMARY KEY,
  stripe_session_id  TEXT        NOT NULL,
  customer_email     TEXT        NOT NULL,
  stripe_customer_id TEXT,
  sku                TEXT        NOT NULL DEFAULT 'dpp_report',
  tier               TEXT        NOT NULL DEFAULT 'dpp_report'
                     CHECK (tier IN ('dpp_report')),
  catalog_limit      INTEGER     NOT NULL DEFAULT 200 CHECK (catalog_limit > 0),
  price_id           TEXT,
  granted_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at         TIMESTAMPTZ,
  CONSTRAINT dpp_report_entitlements_session_uniq UNIQUE (stripe_session_id)
);
CREATE INDEX IF NOT EXISTS idx_dpp_report_entitlements_email
  ON public.dpp_report_entitlements (lower(customer_email));

-- Service role only; no anon/authenticated policies.
ALTER TABLE public.dpp_report_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dpp_report_entitlements FROM anon, authenticated;
