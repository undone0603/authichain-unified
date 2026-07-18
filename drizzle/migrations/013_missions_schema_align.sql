-- Migration 013: Align missions / mission_tasks with the Drizzle schema
--
-- Migration 003 created these tables in an earlier shape. The application
-- schema (src/db/schema.ts, re-exported via drizzle/schema.ts and used by
-- server/db.ts) has since gained columns that 003 never created:
--
--   missions:       description, metadata
--   mission_tasks:  title, description, priority, "order", result, error, scheduledAt
--
-- Without these columns, missions.create / createTask insert into columns that
-- do not exist, and getTasksByMission / getPendingTasks ORDER BY "order" fail,
-- so every missions.* endpoint throws a PostgreSQL "column does not exist"
-- error on any database provisioned from 003.
--
-- This migration is additive and idempotent (ADD COLUMN IF NOT EXISTS), safe to
-- run against databases in any prior state. Column names are quoted to preserve
-- the camelCase / reserved-word identifiers the Drizzle schema expects.
--
-- Run once on Supabase: Dashboard → SQL Editor → paste → Run.

-- ── missions ─────────────────────────────────────────────────────────────────
ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS metadata    JSONB;

-- ── mission_tasks ────────────────────────────────────────────────────────────
ALTER TABLE mission_tasks
  ADD COLUMN IF NOT EXISTS title         VARCHAR(256) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description   TEXT,
  ADD COLUMN IF NOT EXISTS priority      INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "order"       INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS result        JSONB,
  ADD COLUMN IF NOT EXISTS error         TEXT,
  ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMPTZ;

-- Backfill a sensible title for any rows seeded before this column existed
-- (e.g. the missions inserted by migration 006), so the NOT NULL default of ''
-- does not leave blank titles on historical tasks.
UPDATE mission_tasks SET title = kind WHERE title = '';
