CREATE TABLE IF NOT EXISTS tool_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool TEXT NOT NULL,
  event TEXT NOT NULL,
  email TEXT,
  sku_target TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_tool_events_lookup ON tool_events(tool, event, created_at);
CREATE INDEX IF NOT EXISTS idx_tool_events_email ON tool_events(email) WHERE email IS NOT NULL;
