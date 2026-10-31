-- Dedicated tables; never claim the fulfillment handler's stripe_events IDs.
CREATE TABLE IF NOT EXISTS stripe_dunning_events (
  id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('test', 'live')),
  type TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  PRIMARY KEY (id, mode)
);

CREATE TABLE IF NOT EXISTS stripe_dunning_state (
  invoice_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('test', 'live')),
  customer_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','retrying','paid','failed_final','stopped','needs_action','review')),
  attempt INTEGER NOT NULL DEFAULT 0 CHECK (attempt BETWEEN 0 AND 5),
  next_retry_at INTEGER,
  active_started_at INTEGER,
  transport_failures INTEGER NOT NULL DEFAULT 0,
  lease_token TEXT,
  lease_until INTEGER,
  dispatch_token TEXT,
  dispatch_after INTEGER NOT NULL DEFAULT 0,
  last_result TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (invoice_id, mode)
);

CREATE INDEX IF NOT EXISTS stripe_dunning_due
  ON stripe_dunning_state(mode, status, next_retry_at, dispatch_after);
