-- Restored verbatim from supabase_migrations.schema_migrations on project
-- nhdnkzhtadfkkluiulhs (2026-09-24). It was applied to the database directly on
-- 2026-09-21 without a file, which broke Supabase Preview migration history.

CREATE POLICY service_orders_launchcheck_anon_insert ON public.service_orders FOR INSERT TO anon WITH CHECK ("serviceType" = 'launchcheck_teardown'); CREATE POLICY service_orders_launchcheck_anon_update ON public.service_orders FOR UPDATE TO anon USING ("serviceType" = 'launchcheck_teardown') WITH CHECK ("serviceType" = 'launchcheck_teardown');
