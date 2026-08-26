-- Backfill 5 columns that src/db/schema.ts (and the original 0000 migration)
-- have always defined on "users" but that were never actually applied to the
-- live database: generations_used, generations_limit, affiliate_id,
-- referred_by, story_mode_enabled. Discovered via /api/cron/pipeline failing
-- with Postgres error 42703 ("column \"generations_used\" does not exist").
-- generations_limit's default is 0 here (not the original migration's 10)
-- to match schema.ts's current .default(0), which is what the app code
-- assumes going forward.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "generations_used" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "generations_limit" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "affiliate_id" text,
  ADD COLUMN IF NOT EXISTS "referred_by" text,
  ADD COLUMN IF NOT EXISTS "story_mode_enabled" boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_affiliate_id_unique" UNIQUE ("affiliate_id");
