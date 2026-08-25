-- drizzle/migrations/016_guardrail_layer.sql
-- Guardrail / Caps Layer tables.
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS public.guardrail_channels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  category VARCHAR(32) NOT NULL,
  daily_cap INTEGER NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  spend_ceiling_cents INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS guardrail_channels_name_uniq
  ON public.guardrail_channels (name);

CREATE TABLE IF NOT EXISTS public.guardrail_counters (
  id SERIAL PRIMARY KEY,
  channel_id INTEGER NOT NULL,
  day DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS guardrail_counters_channel_day_uniq
  ON public.guardrail_counters (channel_id, day);

CREATE TABLE IF NOT EXISTS public.suppression_list (
  id SERIAL PRIMARY KEY,
  email VARCHAR(320) NOT NULL,
  reason VARCHAR(32) NOT NULL,
  source VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS suppression_list_email_uniq
  ON public.suppression_list (email);

CREATE TABLE IF NOT EXISTS public.kill_switches (
  id SERIAL PRIMARY KEY,
  scope VARCHAR(128) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  updated_by VARCHAR(64) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS kill_switches_scope_uniq
  ON public.kill_switches (scope);

CREATE TABLE IF NOT EXISTS public.guardrail_events (
  id SERIAL PRIMARY KEY,
  channel_id INTEGER,
  action VARCHAR(32) NOT NULL,
  allowed BOOLEAN,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guardrail_events_channel
  ON public.guardrail_events (channel_id);

CREATE INDEX IF NOT EXISTS idx_guardrail_events_created
  ON public.guardrail_events (created_at);
