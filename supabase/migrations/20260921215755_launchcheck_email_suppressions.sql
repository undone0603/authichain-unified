-- Restored verbatim from supabase_migrations.schema_migrations on project
-- nhdnkzhtadfkkluiulhs (2026-09-24). It was applied to the database directly on
-- 2026-09-21 without a file, which broke Supabase Preview migration history.

create table if not exists public.email_suppressions (email text primary key, reason text not null default '', created_at timestamptz not null default now()); alter table public.email_suppressions enable row level security; drop policy if exists "launchcheck suppress insert" on public.email_suppressions; create policy "launchcheck suppress insert" on public.email_suppressions for insert with check (true); drop policy if exists "launchcheck suppress select" on public.email_suppressions; create policy "launchcheck suppress select" on public.email_suppressions for select using (true);
