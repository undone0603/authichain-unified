-- Migration: 003_missions_tasks
-- Adds mission orchestration tables and extends leads for segmentation.
-- Apply via Supabase SQL editor or psql.

CREATE TABLE IF NOT EXISTS missions (
  id          VARCHAR(36)  PRIMARY KEY,
  type        VARCHAR(50)  NOT NULL,
  title       TEXT         NOT NULL,
  status      VARCHAR(20)  NOT NULL DEFAULT 'PLANNED',
  priority    INTEGER      NOT NULL DEFAULT 5,
  "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mission_tasks (
  id            VARCHAR(36)  PRIMARY KEY,
  "missionId"   VARCHAR(36)  NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  kind          VARCHAR(60)  NOT NULL,
  payload       JSONB        NOT NULL DEFAULT '{}',
  status        VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
  "runAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "lastError"   TEXT,
  "retryCount"  INTEGER      NOT NULL DEFAULT 0,
  "retryAfter"  TIMESTAMPTZ,
  "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mission_tasks_pending_idx
  ON mission_tasks (status, "runAt")
  WHERE status = 'PENDING';

-- Extend leads table
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS segment       VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "nextActionAt" TIMESTAMPTZ;
