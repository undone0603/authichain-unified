-- Phase A of closing the anon-readable suppression list (see #1227 review note).
-- Additive and safe to apply before LaunchCheck changes: nothing LaunchCheck
-- uses today is removed.
--
-- 1. is_email_suppressed(email): a point lookup the anon key can call via
--    rpc('is_email_suppressed', { p_email }) instead of SELECTing the table.
--    SECURITY DEFINER so it can read email_suppressions once the anon SELECT
--    policy is dropped in Phase B. Case-insensitive: a suppression recorded in
--    any case still suppresses.
-- 2. email_drafts: the anon insert policy allowed any row from any role. It is
--    narrowed to LaunchCheck's own rows (from_email = launchcheck@agentmail.to,
--    which matches all 12 existing LaunchCheck rows). Service-role writers
--    (outreach scripts, AgentZ) bypass RLS and are unaffected.
--
-- Phase B (separate migration, only after LaunchCheck calls the RPC):
--   drop policy if exists "launchcheck suppress select" on public.email_suppressions;

create or replace function public.is_email_suppressed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.email_suppressions
    where lower(email) = lower(trim(p_email))
  );
$$;

revoke all on function public.is_email_suppressed(text) from public;
grant execute on function public.is_email_suppressed(text) to anon, authenticated;

drop policy if exists "launchcheck drafts insert" on public.email_drafts;
create policy "launchcheck drafts insert" on public.email_drafts
  for insert to anon, authenticated
  with check (from_email = 'launchcheck@agentmail.to');
