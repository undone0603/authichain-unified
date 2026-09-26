-- Restored verbatim from supabase_migrations.schema_migrations on project
-- nhdnkzhtadfkkluiulhs (2026-09-24). It was applied to the database directly on
-- 2026-09-21 without a file, which broke Supabase Preview migration history.

create index if not exists gov_opportunities_status_fit_score_idx on public.gov_opportunities (status, fit_score desc);
