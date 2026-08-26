CREATE TABLE IF NOT EXISTS "guardrail_suppression_list" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"reason" varchar(32) NOT NULL,
	"source" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "guardrail_suppression_list_email_uniq" ON "guardrail_suppression_list" USING btree ("email");
