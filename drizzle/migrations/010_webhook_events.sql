-- drizzle/migrations/010_webhook_events.sql
-- Adds the webhook_events table backing the atomic-claim dedup pattern in
-- server/webhooks/stripe.ts (replaces the broken hasWebhookEventProcessed
-- activity-log scan). Race-safe via UNIQUE(provider, eventId) + INSERT ...
-- ON CONFLICT DO NOTHING.
--
-- Idempotent: safe to re-run.
--
-- Apply to Supabase via MCP apply_migration ("010_webhook_events") at deploy.

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id           SERIAL PRIMARY KEY,
  provider     VARCHAR(32)  NOT NULL,
  "eventId"    VARCHAR(128) NOT NULL,
  "eventType"  VARCHAR(128) NOT NULL,
  "receivedAt" TIMESTAMP    NOT NULL DEFAULT now(),
  "processedAt" TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_provider_eventId_uniq
  ON public.webhook_events (provider, "eventId");
