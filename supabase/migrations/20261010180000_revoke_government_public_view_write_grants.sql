-- Security hardening for public Government Chain projections.
--
-- Live QRON-v2 catalog inspection on 2026-10-10 found that anon and
-- authenticated had excessive write privileges on gov_*_public views.
-- The GovChain Worker uses gov_proposals_public only to count notice_id rows,
-- so preserve SELECT but remove all API-role write privileges.
-- gov_opportunities_public is a read-only public projection and retains SELECT.
--
-- This migration does not modify rows or the underlying table policies.
-- Rollback: restore only the reviewed privileges required by the application.
-- Do NOT blindly restore the previous broad INSERT/UPDATE/DELETE/TRUNCATE grants.

begin;

revoke all privileges on table public.gov_opportunities_public
  from public, anon, authenticated;
revoke all privileges on table public.gov_proposals_public
  from public, anon, authenticated;

grant select on table public.gov_opportunities_public to anon, authenticated;
grant select on table public.gov_proposals_public to anon, authenticated;

do $$
begin
  if has_table_privilege('anon', 'public.gov_opportunities_public', 'INSERT')
     or has_table_privilege('anon', 'public.gov_opportunities_public', 'UPDATE')
     or has_table_privilege('anon', 'public.gov_opportunities_public', 'DELETE')
     or has_table_privilege('authenticated', 'public.gov_opportunities_public', 'INSERT')
     or has_table_privilege('authenticated', 'public.gov_opportunities_public', 'UPDATE')
     or has_table_privilege('authenticated', 'public.gov_opportunities_public', 'DELETE') then
    raise exception 'gov_opportunities_public still has API-role write privileges';
  end if;

  if has_table_privilege('anon', 'public.gov_proposals_public', 'INSERT')
     or has_table_privilege('anon', 'public.gov_proposals_public', 'UPDATE')
     or has_table_privilege('anon', 'public.gov_proposals_public', 'DELETE')
     or has_table_privilege('authenticated', 'public.gov_proposals_public', 'INSERT')
     or has_table_privilege('authenticated', 'public.gov_proposals_public', 'UPDATE')
     or has_table_privilege('authenticated', 'public.gov_proposals_public', 'DELETE') then
    raise exception 'gov_proposals_public still has API-role write privileges';
  end if;

  if not has_table_privilege('anon', 'public.gov_opportunities_public', 'SELECT')
     or not has_table_privilege('authenticated', 'public.gov_opportunities_public', 'SELECT')
     or not has_table_privilege('anon', 'public.gov_proposals_public', 'SELECT')
     or not has_table_privilege('authenticated', 'public.gov_proposals_public', 'SELECT') then
    raise exception 'public GovChain read-only projections must remain readable by intended API roles';
  end if;
end $$;

commit;
