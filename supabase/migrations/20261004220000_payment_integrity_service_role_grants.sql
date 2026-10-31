-- The creating migration may already be applied. These grants are what
-- service_role needs after the Oct 30 default. No client role is granted.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affiliate_commission_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affiliate_payout_claims TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gated_checkout_attempts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.checkout_rate_limits TO service_role;
