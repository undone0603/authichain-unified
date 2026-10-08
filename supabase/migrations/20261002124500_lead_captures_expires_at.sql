-- AE-20261002-CFD-04 | Tier 0 (additive migration) | Acted-by: CF Deploy
-- 12-month retention marker for public.lead_captures (QRON-v2, nhdnkzhtadfkkluiulhs).
--
-- ADDITIVE ONLY: one new column + one index. No drops, no UPDATEs, no deletes.
-- expires_at is a STORED generated column, so existing rows get
-- created_at + 12 months computed by Postgres without any data-rewrite UPDATE,
-- and new rows get it automatically. created_at is `timestamp without time zone`
-- holding UTC (default now() on a UTC database), hence timezone('UTC', ...).
-- Both functions used are IMMUTABLE (timestamp_pl_interval, timezone(text,timestamp)),
-- which generated columns require.
--
-- This file does NOT delete anything. The purge job is a separate, NOT APPLIED
-- draft (ops/retention/lead-captures-purge.NOT-APPLIED.sql) that needs an
-- Advisor/Zac decision.
--
-- Down (rollback):
--   DROP INDEX IF EXISTS public.idx_lead_captures_expires_at;
--   ALTER TABLE public.lead_captures DROP COLUMN IF EXISTS expires_at;

ALTER TABLE public.lead_captures
  ADD COLUMN IF NOT EXISTS expires_at timestamptz
  GENERATED ALWAYS AS (timezone('UTC', created_at + interval '12 months')) STORED;

COMMENT ON COLUMN public.lead_captures.expires_at IS
  '12-month retention marker (created_at + 12 months, UTC). Purge job not applied; see ops/retention/lead-captures-purge.NOT-APPLIED.sql.';

CREATE INDEX IF NOT EXISTS idx_lead_captures_expires_at
  ON public.lead_captures (expires_at);
