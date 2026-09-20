-- Reputation engine (salvaged 2026-07-15; adapted from auth.users(uuid) to the
-- app's public.users(serial) identity — this app uses Google OAuth + JWT with
-- its own users table, not Supabase Auth).

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
