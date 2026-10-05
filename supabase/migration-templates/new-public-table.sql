-- TEMPLATE, NOT A MIGRATION. Copy into supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql
-- and replace public.your_table. This folder is never applied.
--
-- From 2026-10-30 Supabase no longer auto-grants Data API privileges on new
-- tables in `public` (existing tables keep theirs). Grants, RLS and policies
-- ship together in the SAME migration that creates the table.
-- Sources: https://github.com/orgs/supabase/discussions/45329
--          https://supabase.com/docs/guides/api/securing-your-api
-- Enforced by scripts/ci/check-supabase-grants.mjs (CI job "Schema and AgentZ checks").

create table if not exists public.your_table (
  id bigint generated always as identity primary key, -- identity: no sequence grant needed
  created_at timestamptz not null default now()
);

-- 1. RLS on, always.
alter table public.your_table enable row level security;

-- 2. Grants. Least privilege; never wider than the old auto-grant
--    (select, insert, update, delete to anon, authenticated, service_role).
--
-- DEFAULT for this repo: server-only table (writes via SUPABASE_SERVICE_ROLE_KEY,
-- RLS on with no policies, like growth_loop_events / ops_bot_log).
grant select, insert, update, delete on table public.your_table to service_role;

-- OPTIONAL, only together with a matching policy below:
-- grant select on table public.your_table to anon;
-- grant select, insert, update, delete on table public.your_table to authenticated;

-- If a column is serial/bigserial (not identity) and a role INSERTs:
-- grant usage, select on sequence public.your_table_id_seq to service_role;

-- 3. Policies (only for client roles you granted above).
-- create policy "users can read their own rows"
--   on public.your_table for select to authenticated
--   using (auth.uid() = user_id);

-- Table reached ONLY over a direct Postgres connection (DATABASE_URL / Drizzle),
-- never via supabase-js? Skip the grants and state it instead:
-- -- supabase-grants-exempt: public.your_table direct-connection only (reason)
