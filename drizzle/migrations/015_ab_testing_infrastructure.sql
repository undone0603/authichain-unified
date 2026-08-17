CREATE TABLE IF NOT EXISTS "ab_tests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"type" varchar(64) NOT NULL,
	"status" varchar(50) DEFAULT 'draft',
	"hypothesis" text,
	"variant_a" text,
	"variant_b" text,
	"hypothesis_type" varchar(64),
	"metric_type" varchar(64),
	"conversion_a" numeric(10, 4) DEFAULT '0',
	"conversion_b" numeric(10, 4) DEFAULT '0',
	"p_value" numeric(5, 4),
	"variants" json,
	"winnerVariant" varchar(64),
	"totalParticipants" integer DEFAULT 0,
	"startedAt" timestamp,
	"endedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "ab_test_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"ab_test_id" integer NOT NULL,
	"lead_id" integer NOT NULL,
	"variant_assigned" varchar(1) NOT NULL,
	"email_sent" boolean DEFAULT false,
	"email_opened" boolean DEFAULT false,
	"email_clicked" boolean DEFAULT false,
	"email_replied" boolean DEFAULT false,
	"linkedin_impression" integer DEFAULT 0,
	"linkedin_like" integer DEFAULT 0,
	"linkedin_comment" integer DEFAULT 0,
	"linkedin_share" integer DEFAULT 0,
	"pricing_viewed" boolean DEFAULT false,
	"pricing_selected" varchar(64),
	"pricing_purchased" boolean DEFAULT false,
	"deal_converted" boolean DEFAULT false,
	"deal_size" numeric(12, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "ab_test_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"ab_test_id" integer NOT NULL,
	"variant_name" varchar(1) NOT NULL,
	"variant_type" varchar(64) NOT NULL,
	"template_name" varchar(256),
	"subject" varchar(512),
	"html_content" text,
	"text_content" text,
	"linkedin_text" text,
	"linkedin_image_url" text,
	"pricing_json" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "daily_ab_test_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"ab_test_id" integer NOT NULL,
	"metric_date" text NOT NULL,
	"variant_a_participants" integer DEFAULT 0,
	"variant_b_participants" integer DEFAULT 0,
	"variant_a_conversions" integer DEFAULT 0,
	"variant_b_conversions" integer DEFAULT 0,
	"variant_a_revenue" numeric(12, 2) DEFAULT '0',
	"variant_b_revenue" numeric(12, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_ab_test_results_test_id" ON "ab_test_results" ("ab_test_id");
CREATE INDEX IF NOT EXISTS "idx_ab_test_results_lead_id" ON "ab_test_results" ("lead_id");
CREATE INDEX IF NOT EXISTS "idx_ab_test_results_variant" ON "ab_test_results" ("variant_assigned");
CREATE INDEX IF NOT EXISTS "idx_ab_test_variants_test_id" ON "ab_test_variants" ("ab_test_id");
CREATE INDEX IF NOT EXISTS "idx_ab_test_variants_variant" ON "ab_test_variants" ("variant_name");
CREATE INDEX IF NOT EXISTS "idx_daily_metrics_test_id" ON "daily_ab_test_metrics" ("ab_test_id");
CREATE INDEX IF NOT EXISTS "idx_daily_metrics_date" ON "daily_ab_test_metrics" ("metric_date");
