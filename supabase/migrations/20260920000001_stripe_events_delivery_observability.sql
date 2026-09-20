-- Optional observability columns on stripe_events.
-- Live table is event_id + event_type + processed_at (00003). The apex
-- webhook writes those three immediately. If this migration is applied,
-- the same upsert also stores session id, HTTP outcome, and the last error
-- so silent checkout.session.completed misses are queryable.
-- Handler falls back to the three base columns when these are absent.

ALTER TABLE public.stripe_events
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS http_status integer,
  ADD COLUMN IF NOT EXISTS error text;

CREATE INDEX IF NOT EXISTS idx_stripe_events_session
  ON public.stripe_events (session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stripe_events_status
  ON public.stripe_events (status)
  WHERE status IS NOT NULL;
