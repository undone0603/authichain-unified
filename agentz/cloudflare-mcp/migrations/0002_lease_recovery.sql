-- This is only for a dedicated AgentZ D1. Never apply to shared staging/production.
-- Add nullable columns to preserve existing rows during a protected migration.
ALTER TABLE agentz_tasks ADD COLUMN claim_id TEXT;
ALTER TABLE agentz_tasks ADD COLUMN audit_marker TEXT;
ALTER TABLE agentz_tasks ADD COLUMN lease_expires_at TEXT;
ALTER TABLE agentz_tasks ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_agentz_task_dedupe ON agentz_tasks(kind,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agentz_task_lease ON agentz_tasks(status,lease_expires_at);
ALTER TABLE agentz_task_events ADD COLUMN event_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_agentz_event_key ON agentz_task_events(event_key) WHERE event_key IS NOT NULL;
