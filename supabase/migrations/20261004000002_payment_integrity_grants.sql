-- The payment-integrity tables were created in an already-applied migration.
-- Keep that migration immutable and grant only the server role prospectively.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affiliate_commission_events
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affiliate_payout_claims
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gated_checkout_attempts
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.checkout_rate_limits
  TO service_role;
