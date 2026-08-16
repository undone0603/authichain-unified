CREATE TABLE IF NOT EXISTS "webhook_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "provider" text NOT NULL,
  "eventId" text NOT NULL,
  "eventType" text NOT NULL,
  "receivedAt" timestamp DEFAULT now() NOT NULL,
  "processedAt" timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_provider_eventId_uniq" 
  ON "webhook_events" ("provider", "eventId");
