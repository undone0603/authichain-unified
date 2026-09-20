-- anon held a blanket ALL PRIVILEGES grant on the gov_opportunities and
-- gov_proposals base tables (INSERT/SELECT/UPDATE/DELETE/TRUNCATE/
-- REFERENCES/TRIGGER), left over from a schema-wide default privilege.
-- RLS on both tables currently has zero policies, so it denies every
-- anon read/write and returns them as empty results rather than errors --
-- but the grant and the RLS posture disagree. If a permissive policy is
-- ever added later (e.g. to "fix" an empty page), the table becomes
-- writable/readable by anon instantly, silently, with no code change
-- to review. Revoking here makes the grant match the RLS intent: deny.
--
-- The public read surface is gov_opportunities_public (see
-- 20260918000001_govchain_public_opportunities_views.sql), which anon also
-- held excess INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER on despite
-- being read-only by design. Anon keeps SELECT on that view only.

revoke all on public.gov_opportunities from anon;
revoke all on public.gov_proposals from anon;

revoke all on public.gov_opportunities_public from anon;
grant select on public.gov_opportunities_public to anon;
