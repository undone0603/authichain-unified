-- Restore owner (definer) semantics on the GovChain public projections.
-- Applied live on QRON-v2 (nhdnkzhtadfkkluiulhs) 2026-10-15 as migration
-- govchain_public_views_restore_definer_semantics; this file keeps the repo in sync.
--
-- Both views carried security_invoker=true, so anon queries were checked against the
-- base tables, where anon holds no grants (see 20260918000002). PostgREST answered
-- 401 42501 permission denied for table gov_opportunities, the govchain-us Worker
-- mapped it to 502 supabase_unavailable, and govchain.us/opportunities served 503.
--
-- The views are the intentional public door: column-scoped, status-filtered, and
-- SELECT-only for anon/authenticated. The base tables stay deny-all for anon
-- (RLS on, no policies, no anon grants). RLS is not FORCEd on the base tables,
-- so the view owner can read through them.
--
-- Idempotent. Rollback: set (security_invoker = true) on both views.
-- Expected side effect: the Supabase advisor flags both as security_definer_view.

alter view public.gov_opportunities_public set (security_invoker = false);
alter view public.gov_proposals_public     set (security_invoker = false);
