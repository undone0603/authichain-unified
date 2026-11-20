-- This is only for a dedicated AgentZ D1. Never apply to shared staging/production.
-- Scheduler recovery from #2455, ported onto #2536's claim_id lease fencing
-- (0002). Adds only what 0002 lacks: per-task retry limit, expiry, an
-- authorization class the worker must match, and a completion time.
ALTER TABLE agentz_tasks ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3 CHECK(max_attempts BETWEEN 1 AND 10);
ALTER TABLE agentz_tasks ADD COLUMN authorization_class TEXT NOT NULL DEFAULT 'read_only_public' CHECK(authorization_class = 'read_only_public');
ALTER TABLE agentz_tasks ADD COLUMN expires_at TEXT;
ALTER TABLE agentz_tasks ADD COLUMN completed_at TEXT;
CREATE INDEX IF NOT EXISTS idx_agentz_task_expiry ON agentz_tasks(status, expires_at);

-- Rows left 'running' from before lease fencing have no lease_expires_at, so
-- recoverLeases (lease_expires_at <= now) would never see them. Their outcome
-- is unknown: requeue them, or fail them when out of attempts.
UPDATE agentz_tasks
SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
    updated_at = CURRENT_TIMESTAMP,
    last_error = 'legacy running task without lease recovered during migration',
    completed_at = CASE WHEN attempts >= max_attempts THEN CURRENT_TIMESTAMP ELSE NULL END
WHERE status = 'running' AND lease_expires_at IS NULL;

INSERT OR IGNORE INTO agentz_task_events(task_id, event_type, outcome, evidence_url, detail, event_key)
SELECT id, 'lease_recovered', 'unknown', NULL, last_error, 'legacy-recovery:' || id || ':' || attempts
FROM agentz_tasks
WHERE last_error = 'legacy running task without lease recovered during migration';
