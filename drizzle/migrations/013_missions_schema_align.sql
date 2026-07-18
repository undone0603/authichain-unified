-- Migration 013: Align mission_tasks with the application schema (additive-only)
--
-- The live Postgres database provisions missions / mission_tasks with a
-- snake_case, uuid-keyed shape:
--
--   missions(id uuid, type, title, description, status, created_at, updated_at)
--   mission_tasks(id uuid, mission_id, title, description, status, task_order,
--                 payload jsonb, result jsonb, created_at, updated_at)
--
-- The Drizzle schema (src/db/schema.ts) is mapped to exactly those columns, but
-- the application also needs four columns the live table does not yet have:
--
--   kind          — task dispatch discriminator (server/jobs/task-runner.ts)
--   priority      — task ordering
--   error         — failure message recorded by failTask
--   scheduled_at  — due-gating in getPendingTasks
--
-- Because getMissions / getTasksByMission / getPendingTasks read via SELECT *,
-- these columns must exist in the database for the missions endpoints and the
-- AgentZ pipeline to run at all.
--
-- This migration is additive and idempotent — nullable / defaulted columns only,
-- no renames, no type changes, no data rewrites. The existing rows keep their
-- data (priority defaults to 0; kind / error / scheduled_at are NULL).
--
-- Run once on Supabase: Dashboard -> SQL Editor -> paste -> Run.

ALTER TABLE mission_tasks
  ADD COLUMN IF NOT EXISTS kind         VARCHAR(128),
  ADD COLUMN IF NOT EXISTS priority     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error        TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
