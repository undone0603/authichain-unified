-- Reputation engine schema promoted from the legacy Supabase migration.
-- Production already contains these tables; IF NOT EXISTS makes this migration
-- safe during baseline reconciliation and for fresh environments.

CREATE TABLE IF NOT EXISTS "user_reputation" (
    "user_id" integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    "points" integer DEFAULT 0 NOT NULL,
    "trust_level" text DEFAULT 'novice' NOT NULL,
    "last_updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "reputation_events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "event_type" text NOT NULL,
    "points_delta" integer NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_reputation_events_user" ON "reputation_events" ("user_id");
