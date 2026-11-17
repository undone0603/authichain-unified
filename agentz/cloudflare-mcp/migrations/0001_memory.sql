CREATE TABLE IF NOT EXISTS agentz_tasks (
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('public_probe')),
 target TEXT NOT NULL,
 priority INTEGER NOT NULL DEFAULT 50 CHECK(priority BETWEEN 0 AND 100),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','succeeded','failed')),
 attempts INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 next_run_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_agentz_tasks_queue ON agentz_tasks(status,next_run_at,priority DESC);
CREATE TABLE IF NOT EXISTS agentz_task_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 task_id TEXT NOT NULL,
 event_type TEXT NOT NULL,
 outcome TEXT NOT NULL,
 evidence_url TEXT,
 detail TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(task_id) REFERENCES agentz_tasks(id)
);
CREATE INDEX IF NOT EXISTS idx_agentz_events_task ON agentz_task_events(task_id,created_at DESC);
CREATE TABLE IF NOT EXISTS agentz_learnings (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 task_kind TEXT NOT NULL,
 fingerprint TEXT NOT NULL,
 outcome TEXT NOT NULL CHECK(outcome IN ('success','failure')),
 strategy TEXT NOT NULL,
 observation TEXT NOT NULL,
 source_event_id INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(task_kind,fingerprint,outcome,strategy,source_event_id),
 FOREIGN KEY(source_event_id) REFERENCES agentz_task_events(id)
);
