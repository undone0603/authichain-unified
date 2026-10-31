-- AE-20261002-CFD-04 | Tier 0 (additive migration) | Acted-by: CF Deploy
-- Nullable columns so POST /api/leads/capture stops dropping the lead-form
-- fields (company, role, battery categories, target date, message).
-- QRON-v2 (nhdnkzhtadfkkluiulhs, us-east-2), table public.lead_captures.
--
-- Down (rollback) — written first:
--   ALTER TABLE public.lead_captures
--     DROP COLUMN IF EXISTS message,
--     DROP COLUMN IF EXISTS target_date,
--     DROP COLUMN IF EXISTS battery_categories,
--     DROP COLUMN IF EXISTS role,
--     DROP COLUMN IF EXISTS company;
--
-- ADDITIVE ONLY: nullable columns, no defaults, no UPDATEs, no deletes.
-- Safe in either deploy order: the handler retries the insert without these
-- columns if PostgREST reports them missing (worker-app/lead-routes.ts).

ALTER TABLE public.lead_captures
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS battery_categories text[],
  ADD COLUMN IF NOT EXISTS target_date text,
  ADD COLUMN IF NOT EXISTS message text;
