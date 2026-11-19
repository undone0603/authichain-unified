-- Restore owner (definer) semantics on the GovChain public projections.
--
-- Found 2026-10-15: both views carried security_invoker=true, so anon queries were
-- checked against the base tables, where anon holds no grants (see 20260918000002).
-- Result: PostgREST 401 / 42501 "permission denied for table gov_opportunities",
-- the govchain-us Worker mapped it to 502 supabase_unavailable, and
-- govchain.us/opportunities served 503.
--
-- The views are the intentional public door: column-scoped, status-filtered,
-- SELECT-only for anon/authenticated (see 20261010180000). The base tables stay
-- deny-all for anon (RLS on, no policies, no anon grants). RLS is not FORCEd on
-- the base tables, so the view owner (postgres) can read through them.
--
-- Rollback: alter view public.gov_opportunities_public set (security_invoker = true);
--           alter view public.gov_proposals_public     set (security_invoker = true);
-- Expected side effect: Supabase advisor "security_definer_view" will flag both views.
-- This is intentional and should be documented, not "fixed" by flipping the option back.

alter view public.gov_opportunities_public set (security_invoker = false);
alter view public.gov_proposals_public     set (security_invoker = false);
