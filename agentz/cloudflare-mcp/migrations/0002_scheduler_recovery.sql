ALTER TABLE agentz_tasks ADD COLUMN lease_expires_at TEXT;
ALTER TABLE agentz_tasks ADD COLUMN lease_token TEXT;
ALTER TABLE agentz_tasks ADD COLUMN completed_at TEXT;
ALTER TABLE agentz_tasks ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3 CHECK(max_attempts BETWEEN 1 AND 10);
ALTER TABLE agentz_tasks ADD COLUMN authorization_class TEXT NOT NULL DEFAULT 'read_only_public' CHECK(authorization_class='read_only_public');
ALTER TABLE agentz_tasks ADD COLUMN expires_at TEXT NOT NULL DEFAULT '9999-12-31 23:59:59';

ALTER TABLE agentz_task_events ADD COLUMN event_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_agentz_events_event_key
  ON agentz_task_events(event_key) WHERE event_key IS NOT NULL;

UPDATE agentz_tasks
SET status=CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
    updated_at=CURRENT_TIMESTAMP,
    last_error=CASE
      WHEN attempts >= max_attempts THEN 'legacy running task reached maximum attempts during migration'
      ELSE 'recovered legacy task without lease'
    END,
    completed_at=CASE WHEN attempts >= max_attempts THEN CURRENT_TIMESTAMP ELSE NULL END
WHERE status='running';

UPDATE agentz_tasks
SET expires_at=COALESCE(datetime(created_at,'+1 day'),'1970-01-02 00:00:00')
WHERE expires_at='9999-12-31 23:59:59';

INSERT OR IGNORE INTO agentz_task_events(task_id,event_type,outcome,detail,event_key)
SELECT id,'lease_recovery',
       CASE WHEN status='failed' THEN 'failed' ELSE 'requeued' END,
       last_error,
       'legacy-recovery:'||id||':'||attempts
FROM agentz_tasks
WHERE last_error IN (
  'recovered legacy task without lease',
  'legacy running task reached maximum attempts during migration'
);
