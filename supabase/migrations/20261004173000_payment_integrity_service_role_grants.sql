-- Idempotent Data API grants for tables created by
-- 20261001000001_payment_integrity_and_checkout_controls.sql.
-- Supabase Oct 30 stops auto-granting new public tables. These four are
-- server-only (RLS on, no client policies). service_role only.
-- Safe to re-run. Does not change Stripe prices or checkout amounts.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affiliate_commission_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affiliate_payout_claims TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gated_checkout_attempts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.checkout_rate_limits TO service_role;
