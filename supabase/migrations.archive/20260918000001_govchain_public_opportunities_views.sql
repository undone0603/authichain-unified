-- Repair the public read surface behind govchain.us/opportunities.
--
-- Two independent faults stacked, and either alone was enough to make the page
-- render "No opportunities are scored at or above fit 70 right now" while 26
-- qualifying rows sat in the database:
--
--   1. The govchain-us Worker read the BASE tables with the anon key. Both have
--      RLS enabled with zero policies — deny-all — and PostgREST reports that
--      denial as 200 with an empty array, so it looked like "no rows".
--      Fixed in workers/govchain-us/src/supabase.ts by reading these views.
--
--   2. This view already existed (created out-of-band; it appears in no
--      migration and nothing in the repo referenced it) and its status filter
--      excluded every high-fit row. All 26 opportunities at fit >= 70 carry
--      status 'proposal_drafted', which the filter omitted. It also allowed
--      'qualified', a status nothing ever writes — see
--      20260711000001_gov_opportunities_qualified_at.sql, where setting
--      status='qualified' was found to violate the check constraint and was
--      replaced by the separate qualified_at column.
--
-- The column list and its order are preserved EXACTLY as the out-of-band view
-- defined them, so `create or replace` succeeds and any consumer outside this
-- repo keeps the shape it expects. Only the WHERE clause changes.
--
-- Note ai_reasoning is deliberately NOT exposed, matching the original view's
-- choice: it is the engine's scoring rationale. The opportunity detail page
-- falls back to `description`, which is the public SAM.gov text.
--
-- Still excluded, as before: contact_email (third-party procurement PII), raw
-- (full SAM payload), key_requirements, recommended_action (internal
-- pursue/skip verdict). 'skipped' rows stay hidden — a deliberate no-bid is
-- not something to publish.

create or replace view public.gov_opportunities_public as
  select
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
  from public.gov_opportunities
  where status = any (array['new'::text, 'scored'::text, 'qualified'::text, 'proposal_drafted'::text]);

comment on view public.gov_opportunities_public is
  'Column-scoped public read surface for the govchain-us Worker (anon key). Excludes contact_email, raw, key_requirements, recommended_action and ai_reasoning. Hides status=skipped. See workers/govchain-us/src/supabase.ts.';

-- New: the homepage stats bar counts drafted proposals. Only ever counted,
-- never listed, so one column is all it needs.
create or replace view public.gov_proposals_public as
  select notice_id
  from public.gov_proposals;

comment on view public.gov_proposals_public is
  'Count-only public read surface for the govchain-us stats endpoint (anon key).';

grant select on public.gov_opportunities_public to anon, authenticated;
grant select on public.gov_proposals_public   to anon, authenticated;
