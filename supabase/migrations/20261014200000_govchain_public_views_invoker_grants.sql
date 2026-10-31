-- Restore govchain.us/opportunities after the public views went invoker-mode.
--
-- On 2026-10-14, between 18:14 and 19:19 UTC, gov_opportunities_public and
-- gov_proposals_public were switched to security_invoker=true out-of-band (no
-- migration did it), clearing the Supabase advisor's SECURITY DEFINER view
-- error tracked in #1735. That is the right end state, but under invoker
-- semantics the anon role needs its own access to the base tables, and it has
-- none: 20260918000002 revoked anon's base-table grants and both tables have
-- RLS on with zero policies. PostgREST now answers 401 / 42501 "permission
-- denied for table gov_opportunities", and the Worker renders a 503
-- (ops alert #1854).
--
-- Fix without going back to SECURITY DEFINER:
--   * column-level SELECT for anon on exactly the columns each view exposes,
--     so a direct `select=*` on the base table still fails for anon and
--     contact_email, raw, key_requirements, recommended_action and
--     ai_reasoning stay unreachable;
--   * an anon SELECT policy whose USING clause repeats the view's row filter,
--     so status='skipped' rows stay hidden even when the base table is
--     queried directly.
--
-- Exposure is the same set of rows and columns the definer views already
-- published; nothing new becomes readable. No write grants are added.

alter view public.gov_opportunities_public set (security_invoker = true);
alter view public.gov_proposals_public set (security_invoker = true);

grant select (
  notice_id,
  title,
  agency,
  deadline,
  naics_code,
  description,
  sam_url,
  status,
  fit_score,
  estimated_value,
  ingested_at
) on public.gov_opportunities to anon;

drop policy if exists gov_opportunities_anon_public_read on public.gov_opportunities;
create policy gov_opportunities_anon_public_read
  on public.gov_opportunities
  for select
  to anon
  using (status = any (array['new'::text, 'scored'::text, 'qualified'::text, 'proposal_drafted'::text]));

grant select (notice_id) on public.gov_proposals to anon;

drop policy if exists gov_proposals_anon_count_read on public.gov_proposals;
create policy gov_proposals_anon_count_read
  on public.gov_proposals
  for select
  to anon
  using (true);
