CREATE TABLE IF NOT EXISTS "guardrail_channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"category" varchar(32) NOT NULL,
	"daily_cap" integer NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"spend_ceiling_cents" integer DEFAULT 0 NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "guardrail_channels_name_uniq" ON "guardrail_channels" USING btree ("name");

CREATE TABLE IF NOT EXISTS "guardrail_counters" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" integer NOT NULL,
	"day" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "guardrail_counters_channel_day_uniq" ON "guardrail_counters" USING btree ("channel_id","day");

CREATE TABLE IF NOT EXISTS "suppression_list" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"reason" varchar(32) NOT NULL,
	"source" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "suppression_list_email_uniq" ON "suppression_list" USING btree ("email");

CREATE TABLE IF NOT EXISTS "kill_switches" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope" varchar(128) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"reason" text,
	"updated_by" varchar(64) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "kill_switches_scope_uniq" ON "kill_switches" USING btree ("scope");

CREATE TABLE IF NOT EXISTS "guardrail_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" integer,
	"action" varchar(32) NOT NULL,
	"allowed" boolean,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_guardrail_events_channel" ON "guardrail_events" USING btree ("channel_id");
CREATE INDEX IF NOT EXISTS "idx_guardrail_events_created" ON "guardrail_events" USING btree ("created_at");
