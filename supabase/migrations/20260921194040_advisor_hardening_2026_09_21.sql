-- Restored verbatim from supabase_migrations.schema_migrations on project
-- nhdnkzhtadfkkluiulhs (2026-09-24). It was applied to the database directly on
-- 2026-09-21 without a file, which broke Supabase Preview migration history.

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
alter function public.set_signature_requests_updated_at() set search_path = public, pg_temp;
alter function public.tag_data_origin() set search_path = public, pg_temp;
alter function public.gov_fit_score(text, text, text) set search_path = public, pg_temp;
