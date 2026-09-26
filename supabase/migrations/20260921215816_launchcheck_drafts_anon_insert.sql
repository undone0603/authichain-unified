-- Restored verbatim from supabase_migrations.schema_migrations on project
-- nhdnkzhtadfkkluiulhs (2026-09-24). It was applied to the database directly on
-- 2026-09-21 without a file, which broke Supabase Preview migration history.

drop policy if exists "launchcheck drafts insert" on public.email_drafts; create policy "launchcheck drafts insert" on public.email_drafts for insert with check (true);
