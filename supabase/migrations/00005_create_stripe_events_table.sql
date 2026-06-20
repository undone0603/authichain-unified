-- Migration: 00005_create_stripe_events_table
--
-- Creates the `stripe_events` ledger that the Stripe webhook handlers and the
-- post-checkout fulfillment backstop use as an idempotency guard.
--
-- WHY THIS MIGRATION EXISTS (revenue correctness):
--   /api/stripe/webhook and src/lib/fulfillment.ts both insert/select against
--   `stripe_events` to ensure a given Stripe event — or a given checkout session
--   fulfillment — is processed EXACTLY ONCE. Stripe retries deliveries on any
--   non-2xx response, and our success-page backstop can race the webhook, so
--   without a unique guard a customer could be granted credits twice (margin
--   loss) or have their subscription flipped repeatedly. The table was assumed
--   to exist but was never declared in source control; this makes it explicit
--   and reproducible.
--
-- event_id holds either a real Stripe event id (evt_...) or a synthetic
-- fulfillment-guard key of the form `fulfill:<checkout_session_id>`. The PRIMARY
-- KEY enforces single-processing for both.

CREATE TABLE IF NOT EXISTS public.stripe_events (
  event_id     TEXT PRIMARY KEY,
  event_type   TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_at
  ON public.stripe_events (processed_at);

-- Server-side only. Webhooks run with the service role.
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.stripe_events FROM PUBLIC;
REVOKE ALL ON TABLE public.stripe_events FROM anon;
REVOKE ALL ON TABLE public.stripe_events FROM authenticated;
GRANT  ALL ON TABLE public.stripe_events TO service_role;
