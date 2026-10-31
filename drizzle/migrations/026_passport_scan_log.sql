-- Additive passport scan log. Applied by pnpm db:migrate. No backfill.
CREATE TABLE IF NOT EXISTS "passport_scan_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"digital_identity" text,
	"verdict" text NOT NULL,
	"binding_method" text,
	"binding_pass" boolean,
	"recorded_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "passport_scan_log_recorded_at_idx" ON "passport_scan_log" ("recorded_at");
